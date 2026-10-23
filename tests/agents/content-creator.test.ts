import { MessageBus } from '@/lib/framework/message-bus';
import { ContentCreatorAgent } from '@/lib/agents/content-creator';

describe('ContentCreatorAgent', () => {
  let agent: ContentCreatorAgent;
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
    agent = new ContentCreatorAgent(bus);
  });

  describe('validate', () => {
    test('valid with products array', () => {
      expect(agent.validate({ products: [] })).toBe(true);
    });

    test('invalid without products', () => {
      expect(agent.validate({})).toBe(false);
      expect(agent.validate({ products: 'not-array' })).toBe(false);
      expect(agent.validate({ products: 123 })).toBe(false);
    });
  });

  describe('execute', () => {
    const products = [
      { name: 'Widget', category: 'Electronics', price: 29.99, description: 'A useful widget' },
    ];

    test('generates content for each product', async () => {
      const result = await agent.execute({ products });
      expect(result.success).toBe(true);
      const content = result.data!.generatedContent as Array<Record<string, unknown>>;
      expect(content).toHaveLength(1);
      expect(content[0]).toHaveProperty('title');
      expect(content[0]).toHaveProperty('bulletPoints');
      expect(content[0]).toHaveProperty('detailDescription');
      expect(content[0]).toHaveProperty('language');
      expect(content[0]).toHaveProperty('compliancePassed');
      expect(content[0]).toHaveProperty('complianceWarnings');
    });

    test('default language is en', async () => {
      const result = await agent.execute({ products });
      expect(result.success).toBe(true);
      const content = result.data!.generatedContent as Array<Record<string, unknown>>;
      expect(content[0].language).toBe('en');
      expect((content[0].title as string)).toContain('Premium');
    });

    test('different language templates (es)', async () => {
      const result = await agent.execute({ products, targetLanguage: 'es' });
      expect(result.success).toBe(true);
      const content = result.data!.generatedContent as Array<Record<string, unknown>>;
      expect(content[0].language).toBe('es');
      expect((content[0].detailDescription as string)).toContain('Presentamos el');
    });

    test('different language templates (fr)', async () => {
      const result = await agent.execute({ products, targetLanguage: 'fr' });
      expect(result.success).toBe(true);
      const content = result.data!.generatedContent as Array<Record<string, unknown>>;
      expect(content[0].language).toBe('fr');
      expect((content[0].detailDescription as string)).toContain('Découvrez le');
    });

    test('different language templates (de)', async () => {
      const result = await agent.execute({ products, targetLanguage: 'de' });
      expect(result.success).toBe(true);
      const content = result.data!.generatedContent as Array<Record<string, unknown>>;
      expect(content[0].language).toBe('de');
      expect((content[0].detailDescription as string)).toContain('Entdecken Sie das');
    });

    test('different language templates (zh)', async () => {
      const result = await agent.execute({ products, targetLanguage: 'zh' });
      expect(result.success).toBe(true);
      const content = result.data!.generatedContent as Array<Record<string, unknown>>;
      expect(content[0].language).toBe('zh');
      expect((content[0].title as string)).toContain('优质');
      expect((content[0].detailDescription as string)).toContain('为您推荐');
    });

    test('compliance detection flags sensitive words', async () => {
      const sensitiveProducts = [
        { name: 'FDA Cure', category: 'Health', price: 99.99, description: 'guarantee cure for everything' },
      ];
      const result = await agent.execute({ products: sensitiveProducts });
      expect(result.success).toBe(true);
      const content = result.data!.generatedContent as Array<Record<string, unknown>>;
      expect(content[0].compliancePassed).toBe(false);
      expect((content[0].complianceWarnings as string[]).length).toBeGreaterThan(0);
    });

    test('compliance passed when no sensitive words', async () => {
      const result = await agent.execute({ products });
      expect(result.success).toBe(true);
      const content = result.data!.generatedContent as Array<Record<string, unknown>>;
      expect(content[0].compliancePassed).toBe(true);
      expect(content[0].complianceWarnings).toEqual([]);
    });

    test('style override works', async () => {
      const result = await agent.execute({ products, style: 'luxury' });
      expect(result.success).toBe(true);
      const content = result.data!.generatedContent as Array<Record<string, unknown>>;
      expect((content[0].title as string)).toContain('Luxury');
      expect(result.data!.style).toBe('luxury');
    });

    test('nextAgent is ad-optimizer', async () => {
      const result = await agent.execute({ products });
      expect(result.success).toBe(true);
      expect(result.nextAgent).toBe('ad-optimizer');
    });

    test('empty products returns fail', async () => {
      const result = await agent.execute({ products: [] });
      expect(result.success).toBe(false);
      expect(result.error).toBe('No products provided');
    });
  });
});
