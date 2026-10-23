import { MessageBus } from '@/lib/framework/message-bus';
import { FulfillmentAgent } from '@/lib/agents/fulfillment';

describe('FulfillmentAgent', () => {
  let agent: FulfillmentAgent;
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
    agent = new FulfillmentAgent(bus);
  });

  describe('validate', () => {
    test('valid with order', () => {
      expect(agent.validate({ order: { orderNumber: 'ORD-001' } })).toBe(true);
    });

    test('invalid without order', () => {
      expect(agent.validate({})).toBe(false);
      expect(agent.validate({ order: null })).toBe(false);
      expect(agent.validate({ order: 'invalid' })).toBe(false);
    });
  });

  describe('execute - logistics channel matching', () => {
    test('matches channels for SEA region', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-001', shippingRegion: 'SEA', shippingWeight: 1, totalAmount: 100 },
      });
      expect(result.success).toBe(true);
      const channels = result.data?.recommendedChannels as Array<{ id: string; regions: string[] }>;
      expect(channels.length).toBeGreaterThan(0);
      channels.forEach((ch) => {
        expect(ch.regions).toContain('SEA');
      });
    });

    test('matches channels for EUROPE region', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-002', shippingRegion: 'EUROPE', shippingWeight: 1, totalAmount: 100 },
      });
      expect(result.success).toBe(true);
      const channels = result.data?.recommendedChannels as Array<{ id: string; regions: string[] }>;
      expect(channels.length).toBeGreaterThan(0);
      channels.forEach((ch) => {
        expect(ch.regions).toContain('EUROPE');
      });
    });

    test('matches channels for NORTH_AMERICA region', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-003', shippingRegion: 'NORTH_AMERICA', shippingWeight: 1, totalAmount: 100 },
      });
      expect(result.success).toBe(true);
      const channels = result.data?.recommendedChannels as Array<{ id: string; regions: string[] }>;
      expect(channels.length).toBeGreaterThan(0);
      channels.forEach((ch) => {
        expect(ch.regions).toContain('NORTH_AMERICA');
      });
    });

    test('filters channels by weight limit', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-004', shippingRegion: 'SEA', shippingWeight: 5, totalAmount: 100 },
      });
      expect(result.success).toBe(true);
      const channels = result.data?.recommendedChannels as Array<{ id: string; maxWeight: number }>;
      channels.forEach((ch) => {
        expect(ch.maxWeight).toBeGreaterThanOrEqual(5);
      });
    });
  });

  describe('execute - customs document generation', () => {
    test('generates customs documents', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-005', shippingRegion: 'EUROPE', shippingWeight: 1, totalAmount: 200 },
      });
      expect(result.success).toBe(true);
      const docs = result.data?.customsDocuments as Record<string, unknown>;
      expect(docs.orderId).toBe('ORD-005');
      expect(docs.commercialInvoice).toBe(true);
      expect(docs.packingList).toBe(true);
      expect(docs.customsDeclaration).toBe(true);
      expect(docs.hsCode).toBe('auto-detect');
      expect(docs.declaredValue).toBe(140);
    });
  });

  describe('execute - inventory status check', () => {
    test('checks inventory status for items', async () => {
      const result = await agent.execute({
        order: {
          orderNumber: 'ORD-006',
          shippingRegion: 'SEA',
          shippingWeight: 1,
          items: [{ itemId: 'item-1' }, { itemId: 'item-2' }],
        },
      });
      expect(result.success).toBe(true);
      const inventory = result.data?.inventoryStatus as Array<{ itemId: string; currentStock: number; status: string }>;
      expect(inventory).toHaveLength(2);
      expect(inventory[0].itemId).toBe('item-1');
      expect(inventory[0].currentStock).toBeGreaterThanOrEqual(10);
      expect(inventory[0].status).toBe('available');
    });
  });

  describe('execute - abnormal order detection', () => {
    test('detects heavy weight as abnormal', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-007', shippingRegion: 'EUROPE', shippingWeight: 35, totalAmount: 100 },
      });
      expect(result.success).toBe(true);
      expect(result.data?.isAbnormal).toBe(true);
      expect((result.data?.abnormalReasons as string[]).length).toBeGreaterThan(0);
    });

    test('detects empty region as abnormal', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-008', shippingRegion: '', shippingWeight: 1, totalAmount: 100 },
      });
      expect(result.success).toBe(true);
      expect(result.data?.isAbnormal).toBe(true);
      expect((result.data?.abnormalReasons as string[])).toContain('缺少配送区域');
    });

    test('detects high amount as abnormal', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-009', shippingRegion: 'EUROPE', shippingWeight: 1, totalAmount: 15000 },
      });
      expect(result.success).toBe(true);
      expect(result.data?.isAbnormal).toBe(true);
      expect((result.data?.abnormalReasons as string[])).toContain('高额订单');
    });

    test('normal order not flagged as abnormal', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-010', shippingRegion: 'EUROPE', shippingWeight: 1, totalAmount: 100 },
      });
      expect(result.success).toBe(true);
      expect(result.data?.isAbnormal).toBe(false);
      expect(result.data?.abnormalReasons).toEqual([]);
    });
  });

  describe('execute - nextAgent chain', () => {
    test('nextAgent is customer-service', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-011', shippingRegion: 'SEA', shippingWeight: 1, totalAmount: 100 },
      });
      expect(result.success).toBe(true);
      expect(result.nextAgent).toBe('customer-service');
    });

    test('nextAgentInput contains order and fulfillment data', async () => {
      const result = await agent.execute({
        order: { orderNumber: 'ORD-012', shippingRegion: 'SEA', shippingWeight: 1, totalAmount: 100 },
      });
      expect(result.success).toBe(true);
      expect(result.nextAgentInput).toBeDefined();
      expect(result.nextAgentInput!.order).toBeDefined();
      expect(result.nextAgentInput!.recommendedChannels).toBeDefined();
      expect(result.nextAgentInput!.customsDocuments).toBeDefined();
      expect(result.nextAgentInput!.inventoryStatus).toBeDefined();
    });
  });
});
