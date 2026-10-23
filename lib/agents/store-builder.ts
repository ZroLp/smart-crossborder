import { BaseAgent } from '@/lib/framework/base-agent';
import { MessageBus } from '@/lib/framework/message-bus';
import { callOpenAIJSON, isOpenAIAvailable } from '@/lib/ai/openai-client';
import { PROMPTS } from '@/lib/ai/prompts';

interface Template {
  id: string;
  name: string;
  category: string;
  market: string;
  matchScore: number;
}

const TEMPLATES: Template[] = [
  { id: 'tpl-001', name: '时尚服饰模板', category: 'fashion', market: 'global', matchScore: 85 },
  { id: 'tpl-002', name: '3C电子模板', category: 'electronics', market: 'global', matchScore: 90 },
  { id: 'tpl-003', name: '家居生活模板', category: 'home', market: 'global', matchScore: 80 },
  { id: 'tpl-004', name: '美妆个护模板', category: 'beauty', market: 'global', matchScore: 88 },
  { id: 'tpl-005', name: '东南亚专属模板', category: 'general', market: 'SEA', matchScore: 92 },
  { id: 'tpl-006', name: '欧美简约模板', category: 'general', market: 'EUROPE', matchScore: 87 },
];

interface SelectedProduct {
  name: string;
  category: string;
  price: number;
  [key: string]: unknown;
}

function hashName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

export class StoreBuilderAgent extends BaseAgent {
  constructor(messageBus: MessageBus) {
    super(
      { name: '建站Agent', type: 'store-builder', description: '零代码智能店铺搭建智能体' },
      messageBus
    );
  }

  validate(input: Record<string, unknown>): boolean {
    return Array.isArray(input.selectedProducts);
  }

  async execute(input: Record<string, unknown>) {
    const selectedProducts = input.selectedProducts as SelectedProduct[];
    const targetMarket = input.targetMarket as string | undefined;

    if (!selectedProducts || selectedProducts.length === 0) {
      return this.fail('选品列表为空');
    }

    if (isOpenAIAvailable()) {
      const startTime = Date.now();
      try {
        const userPrompt = `Product selection: ${JSON.stringify(selectedProducts.map(p => ({ name: p.name, category: p.category })))}
Target market: ${targetMarket || 'not specified'}`;

        const aiResult = await callOpenAIJSON({
          systemPrompt: PROMPTS.storeBuilder.system,
          userPrompt,
        }) as Record<string, unknown> | null;

        if (aiResult) {
          return {
            success: true,
            data: aiResult as Record<string, unknown>,
            ai_provider: 'openai' as const,
            response_time_ms: Date.now() - startTime,
            error: undefined,
            nextAgent: 'content' as const,
            nextAgentInput: { products: selectedProducts, ai_result: aiResult },
          };
        }
      } catch (error) {
        console.error('[StoreBuilder] OpenAI call failed:', error);
      }
    }

    const categories = [...new Set(selectedProducts.map((p) => p.category))];

    let matched = TEMPLATES.filter((t) => categories.includes(t.category));

    if (targetMarket) {
      const marketMatched = matched.filter((t) => t.market === targetMarket);
      if (marketMatched.length > 0) {
        matched = marketMatched;
      }
    }

    if (matched.length === 0) {
      matched = TEMPLATES.filter((t) => t.market === 'global');
    }

    matched.sort((a, b) => b.matchScore - a.matchScore);

    const matchedTemplates = matched;

    const generatedPages = selectedProducts.map((product) => ({
      productId: hashName(product.name),
      pageTitle: product.name,
      pageStructure: ['hero-banner', 'product-info', 'reviews', 'related'],
      status: 'generated',
    }));

    const autoConfig = {
      domain: 'auto-generated',
      payment: 'shopify-payments',
      shipping: 'standard-intl',
      tax: 'auto-calculate',
    };

    return {
      success: true,
      data: { matchedTemplates, generatedPages, autoConfig },
      ai_provider: 'fallback' as const,
      response_time_ms: 0,
      error: undefined,
      nextAgent: 'content' as const,
      nextAgentInput: { products: selectedProducts, templates: matchedTemplates },
    };
  }
}
