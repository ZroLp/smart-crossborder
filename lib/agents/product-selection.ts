import { BaseAgent } from '@/lib/framework/base-agent';
import { MessageBus } from '@/lib/framework/message-bus';
import { callOpenAIJSON, isOpenAIAvailable } from '@/lib/ai/openai-client';
import { PROMPTS } from '@/lib/ai/prompts';

const RISK_KEYWORDS = ['patent', 'trademark', 'copyright', '专利', '商标', '版权', '仿品', 'counterfeit'];

interface ProductInput {
  name: string;
  category: string;
  price: number;
  cost: number;
  sales: number;
  region?: string;
}

interface ScoredProduct extends ProductInput {
  scores: {
    marketHeat: number;
    competitionLevel: number;
    profitMargin: number;
    complianceSafety: number;
    totalScore: number;
  };
  riskLabels: string[];
}

export class SelectionAgent extends BaseAgent {
  constructor(messageBus: MessageBus) {
    super(
      { name: '选品Agent', type: 'selection', description: '爆款挖掘与风险风控智能体' },
      messageBus
    );
  }

  validate(input: Record<string, unknown>): boolean {
    return Array.isArray(input.products);
  }

  async execute(input: Record<string, unknown>) {
    const startTime = Date.now();
    const products = input.products as ProductInput[];

    if (!products || products.length === 0) {
      return this.fail('产品列表为空');
    }

    if (isOpenAIAvailable()) {
      try {
        const userPrompt = JSON.stringify({ products });
        const result = await callOpenAIJSON({
          systemPrompt: PROMPTS.productSelection.system,
          userPrompt,
          model: 'gpt-4o-mini',
          maxTokens: 2048,
          temperature: 0.7,
        });

        if (result && typeof result === 'object' && 'products' in result) {
          const aiProducts = (result as { products: unknown[] }).products;
          const aiScored: ScoredProduct[] = aiProducts.map((p) => {
            const prod = p as Record<string, number | string | string[]>;
            return {
              name: (prod.name as string) || '',
              category: (prod.category as string) || '',
              price: (prod.price as number) || 0,
              cost: (prod.cost as number) || 0,
              sales: (prod.sales as number) || 0,
              region: (prod.region as string) || undefined,
              scores: {
                marketHeat: (prod.marketHeat as number) || 0,
                competitionLevel: (prod.competitionLevel as number) || 0,
                profitMargin: (prod.profitMargin as number) || 0,
                complianceSafety: (prod.complianceSafety as number) || 80,
                totalScore: (prod.totalScore as number) || 0,
              },
              riskLabels: Array.isArray(prod.riskLabels) ? (prod.riskLabels as string[]) : [],
            };
          });

          aiScored.sort((a, b) => b.scores.totalScore - a.scores.totalScore);
          const top3 = aiScored.slice(0, 3);

          return {
            success: true,
            data: { products: aiScored },
            ai_provider: 'openai' as const,
            response_time_ms: Date.now() - startTime,
            error: undefined,
            nextAgent: 'store-builder' as const,
            nextAgentInput: { selectedProducts: top3 },
          };
        }
      } catch (error) {
        console.warn('[SelectionAgent] OpenAI call failed, falling back to formula:', error);
      }
    }

    let categoryBoost: Record<string, number> = {};

    if (this.sharedContext) {
      const feedback = this.readFromSharedContext('customer-service', 'service-feedback');
      if (feedback && feedback.resolved === true && feedback.intent) {
        const intentCategoryMap: Record<string, string[]> = {
          shipping: ['home', 'general'],
          return: ['fashion', 'electronics'],
          payment: ['electronics', 'beauty'],
          product: ['fashion', 'home'],
          customs: ['general', 'home'],
        };
        const categories = intentCategoryMap[feedback.intent as string] || [];
        categories.forEach((cat) => {
          categoryBoost[cat] = (categoryBoost[cat] || 0) + 5;
        });
      }
    }

    const scoredProducts: ScoredProduct[] = products.map((product) => {
      let marketHeat = Math.min(100, product.sales / 10);
      let competitionLevel = Math.max(0, 100 - product.sales / 5);
      let profitMargin = product.price > 0 ? Math.min(100, ((product.price - product.cost) / product.price) * 200) : 0;
      let complianceSafety = 80;

      const nameLower = product.name.toLowerCase();
      if (RISK_KEYWORDS.some((kw) => nameLower.includes(kw.toLowerCase()))) {
        complianceSafety -= 30;
      }

      if (product.region === 'SEA') marketHeat += 10;
      if (product.region === 'LATAM') profitMargin += 5;
      if (product.region === 'EUROPE') complianceSafety += 5;

      if (categoryBoost[product.category]) {
        marketHeat += categoryBoost[product.category];
      }

      const totalScore = marketHeat * 0.3 + competitionLevel * 0.2 + profitMargin * 0.3 + complianceSafety * 0.2;

      const riskLabels: string[] = [];
      if (complianceSafety < 60) riskLabels.push('compliance-risk');
      if (competitionLevel < 40) riskLabels.push('high-competition');
      if (profitMargin < 30) riskLabels.push('low-profit');

      return {
        ...product,
        scores: { marketHeat, competitionLevel, profitMargin, complianceSafety, totalScore },
        riskLabels,
      };
    });

    scoredProducts.sort((a, b) => b.scores.totalScore - a.scores.totalScore);

    const top3 = scoredProducts.slice(0, 3);

    return {
      success: true,
      data: { products: scoredProducts },
      ai_provider: 'fallback' as const,
      response_time_ms: Date.now() - startTime,
      error: undefined,
      nextAgent: 'store-builder' as const,
      nextAgentInput: { selectedProducts: top3 },
    };
  }
}
