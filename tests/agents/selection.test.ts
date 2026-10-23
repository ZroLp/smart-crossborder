import { SelectionAgent } from '@/lib/agents/product-selection';
import { MessageBus } from '@/lib/framework/message-bus';

describe('SelectionAgent', () => {
  let agent: SelectionAgent;
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
    agent = new SelectionAgent(bus);
  });

  describe('validate', () => {
    test('returns true when input has products array', () => {
      expect(agent.validate({ products: [] })).toBe(true);
    });

    test('returns false when input has no products', () => {
      expect(agent.validate({})).toBe(false);
      expect(agent.validate({ products: null })).toBe(false);
      expect(agent.validate({ products: 'not-array' })).toBe(false);
    });
  });

  describe('execute', () => {
    test('calculates four-dimensional scores correctly', async () => {
      const result = await agent.execute({
        products: [
          { name: 'T-Shirt', category: 'fashion', price: 50, cost: 20, sales: 500 },
        ],
      });

      expect(result.success).toBe(true);
      const product = (result.data!.products as any[])[0];
      expect(product.scores.marketHeat).toBe(50);
      expect(product.scores.competitionLevel).toBe(0);
      expect(product.scores.profitMargin).toBeCloseTo(120 > 100 ? 100 : 120);
      expect(product.scores.complianceSafety).toBe(80);
    });

    test('adds risk labels for compliance, competition, and profit issues', async () => {
      const result = await agent.execute({
        products: [
          { name: 'patent gadget', category: 'electronics', price: 30, cost: 28, sales: 800 },
        ],
      });

      expect(result.success).toBe(true);
      const product = (result.data!.products as any[])[0];
      expect(product.riskLabels).toContain('compliance-risk');
      expect(product.riskLabels).toContain('low-profit');
    });

    test('adds high-competition label when competitionLevel < 40', async () => {
      const result = await agent.execute({
        products: [
          { name: 'Widget', category: 'home', price: 50, cost: 20, sales: 800 },
        ],
      });

      expect(result.success).toBe(true);
      const product = (result.data!.products as any[])[0];
      expect(product.scores.competitionLevel).toBeLessThan(40);
      expect(product.riskLabels).toContain('high-competition');
    });

    test('applies SEA region bonus to marketHeat', async () => {
      const result = await agent.execute({
        products: [
          { name: 'Item A', category: 'general', price: 50, cost: 20, sales: 500, region: 'SEA' },
          { name: 'Item B', category: 'general', price: 50, cost: 20, sales: 500 },
        ],
      });

      const products = result.data!.products as any[];
      expect(products[0].scores.marketHeat).toBe(products[1].scores.marketHeat + 10);
    });

    test('applies LATAM region bonus to profitMargin', async () => {
      const result = await agent.execute({
        products: [
          { name: 'Item A', category: 'general', price: 50, cost: 20, sales: 500, region: 'LATAM' },
          { name: 'Item B', category: 'general', price: 50, cost: 20, sales: 500 },
        ],
      });

      const products = result.data!.products as any[];
      expect(products[0].scores.profitMargin).toBe(products[1].scores.profitMargin + 5);
    });

    test('applies EUROPE region bonus to complianceSafety', async () => {
      const result = await agent.execute({
        products: [
          { name: 'Item A', category: 'general', price: 50, cost: 20, sales: 500, region: 'EUROPE' },
          { name: 'Item B', category: 'general', price: 50, cost: 20, sales: 500 },
        ],
      });

      const products = result.data!.products as any[];
      expect(products[0].scores.complianceSafety).toBe(products[1].scores.complianceSafety + 5);
    });

    test('sorts products by totalScore descending', async () => {
      const result = await agent.execute({
        products: [
          { name: 'Low', category: 'home', price: 30, cost: 28, sales: 100 },
          { name: 'High', category: 'fashion', price: 100, cost: 20, sales: 900 },
          { name: 'Mid', category: 'electronics', price: 60, cost: 30, sales: 500 },
        ],
      });

      const products = result.data!.products as any[];
      expect(products[0].scores.totalScore).toBeGreaterThanOrEqual(products[1].scores.totalScore);
      expect(products[1].scores.totalScore).toBeGreaterThanOrEqual(products[2].scores.totalScore);
    });

    test('sets nextAgent to store-builder with top 3 products', async () => {
      const result = await agent.execute({
        products: [
          { name: 'A', category: 'fashion', price: 100, cost: 20, sales: 900 },
          { name: 'B', category: 'electronics', price: 80, cost: 30, sales: 700 },
          { name: 'C', category: 'home', price: 60, cost: 25, sales: 500 },
          { name: 'D', category: 'beauty', price: 40, cost: 35, sales: 200 },
          { name: 'E', category: 'general', price: 30, cost: 28, sales: 100 },
        ],
      });

      expect(result.nextAgent).toBe('store-builder');
      expect((result.nextAgentInput!.selectedProducts as any[]).length).toBe(3);
    });

    test('returns fail for empty products array', async () => {
      const result = await agent.execute({ products: [] });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
