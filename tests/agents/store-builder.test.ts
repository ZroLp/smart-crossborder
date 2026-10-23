import { StoreBuilderAgent } from '@/lib/agents/store-builder';
import { MessageBus } from '@/lib/framework/message-bus';

describe('StoreBuilderAgent', () => {
  let agent: StoreBuilderAgent;
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
    agent = new StoreBuilderAgent(bus);
  });

  describe('validate', () => {
    test('returns true when input has selectedProducts array', () => {
      expect(agent.validate({ selectedProducts: [] })).toBe(true);
    });

    test('returns false when input has no selectedProducts', () => {
      expect(agent.validate({})).toBe(false);
      expect(agent.validate({ selectedProducts: null })).toBe(false);
      expect(agent.validate({ selectedProducts: 'not-array' })).toBe(false);
    });
  });

  describe('execute', () => {
    test('matches templates by product category', async () => {
      const result = await agent.execute({
        selectedProducts: [
          { name: 'Phone Case', category: 'electronics', price: 20 },
        ],
      });

      expect(result.success).toBe(true);
      const templates = result.data!.matchedTemplates as any[];
      expect(templates.some((t) => t.category === 'electronics')).toBe(true);
    });

    test('matches templates by targetMarket when provided', async () => {
      const result = await agent.execute({
        selectedProducts: [
          { name: 'General Item', category: 'general', price: 20 },
        ],
        targetMarket: 'SEA',
      });

      expect(result.success).toBe(true);
      const templates = result.data!.matchedTemplates as any[];
      expect(templates.some((t) => t.market === 'SEA')).toBe(true);
    });

    test('generates product pages for each selected product', async () => {
      const result = await agent.execute({
        selectedProducts: [
          { name: 'Phone Case', category: 'electronics', price: 20 },
          { name: 'T-Shirt', category: 'fashion', price: 30 },
        ],
      });

      expect(result.success).toBe(true);
      const pages = result.data!.generatedPages as any[];
      expect(pages).toHaveLength(2);
      expect(pages[0].pageTitle).toBe('Phone Case');
      expect(pages[1].pageTitle).toBe('T-Shirt');
      expect(pages[0].pageStructure).toEqual(['hero-banner', 'product-info', 'reviews', 'related']);
      expect(pages[0].status).toBe('generated');
      expect(pages[0].productId).toBeDefined();
    });

    test('generates auto config', async () => {
      const result = await agent.execute({
        selectedProducts: [
          { name: 'Phone Case', category: 'electronics', price: 20 },
        ],
      });

      expect(result.success).toBe(true);
      const config = result.data!.autoConfig as any;
      expect(config.domain).toBe('auto-generated');
      expect(config.payment).toBe('shopify-payments');
      expect(config.shipping).toBe('standard-intl');
      expect(config.tax).toBe('auto-calculate');
    });

    test('sets nextAgent to content', async () => {
      const result = await agent.execute({
        selectedProducts: [
          { name: 'Phone Case', category: 'electronics', price: 20 },
        ],
      });

      expect(result.nextAgent).toBe('content');
      expect(result.nextAgentInput).toBeDefined();
      expect(result.nextAgentInput!.products).toBeDefined();
      expect(result.nextAgentInput!.templates).toBeDefined();
    });

    test('returns fail for empty selectedProducts array', async () => {
      const result = await agent.execute({ selectedProducts: [] });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
