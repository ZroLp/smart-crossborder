import { BaseAgent } from '@/lib/framework/base-agent';
import { MessageBus } from '@/lib/framework/message-bus';
import { callOpenAIJSON, isOpenAIAvailable } from '@/lib/ai/openai-client';
import { PROMPTS } from '@/lib/ai/prompts';

const LANGUAGE_TEMPLATES: Record<string, { titlePrefix: string; bulletPrefix: string; descStart: string }> = {
  en: { titlePrefix: 'Premium', bulletPrefix: '•', descStart: 'Introducing the' },
  es: { titlePrefix: 'Premium', bulletPrefix: '•', descStart: 'Presentamos el' },
  fr: { titlePrefix: 'Premium', bulletPrefix: '•', descStart: 'Découvrez le' },
  de: { titlePrefix: 'Premium', bulletPrefix: '•', descStart: 'Entdecken Sie das' },
  zh: { titlePrefix: '优质', bulletPrefix: '•', descStart: '为您推荐' },
};

const SENSITIVE_WORDS = ['guarantee', 'cure', 'FDA', '保证治愈', '治愈', '违禁'];

const STYLE_MODIFIERS: Record<string, { titleAdjective: string; tone: string }> = {
  professional: { titleAdjective: 'Professional-Grade', tone: 'professional' },
  casual: { titleAdjective: 'Everyday', tone: 'casual' },
  luxury: { titleAdjective: 'Luxury', tone: 'luxury' },
};

interface Product {
  name: string;
  category: string;
  price: number;
  description?: string;
}

export class ContentCreatorAgent extends BaseAgent {
  constructor(messageBus: MessageBus) {
    super(
      { name: '内容Agent', type: 'content', description: '跨境多语种素材智能创作智能体' },
      messageBus
    );
  }

  validate(input: Record<string, unknown>): boolean {
    return Array.isArray(input.products);
  }

  async execute(input: Record<string, unknown>) {
    if (!this.validate(input)) {
      return this.fail('Invalid input: products array is required');
    }

    const products = input.products as Product[];
    const targetLanguage = (input.targetLanguage as string) || 'en';
    const style = input.style as string | undefined;

    if (products.length === 0) {
      return this.fail('No products provided');
    }

    if (isOpenAIAvailable()) {
      const startTime = Date.now();
      try {
        const userPrompt = `Generate marketing content for the following products:\n${products.map((p) => `- Name: ${p.name}, Category: ${p.category}, Price: $${p.price}${p.description ? `, Description: ${p.description}` : ''}`).join('\n')}\n\nTarget language: ${targetLanguage}`;
        const aiResult = await callOpenAIJSON({
          systemPrompt: PROMPTS.contentCreator.system,
          userPrompt,
        });
        const responseTimeMs = Date.now() - startTime;

        if (aiResult) {
          const template = LANGUAGE_TEMPLATES[targetLanguage] || LANGUAGE_TEMPLATES.en;
          const generatedContent = products.map((product, index) => {
            const aiData = Array.isArray(aiResult) ? aiResult[index] : aiResult;
            const title = (aiData?.title as string) || product.name;
            const description = (aiData?.description as string) || '';
            const bulletPoints = (aiData?.tags as string[]) || [];

            const allText = `${title} ${bulletPoints.join(' ')} ${description}`;
            const complianceWarnings = SENSITIVE_WORDS.filter((word) =>
              allText.toLowerCase().includes(word.toLowerCase())
            );
            const compliancePassed = complianceWarnings.length === 0;

            return {
              productId: index,
              title,
              bulletPoints: bulletPoints.length > 0 ? bulletPoints : [`• ${product.name}`],
              detailDescription: description || '',
              language: targetLanguage,
              compliancePassed,
              complianceWarnings,
              seoKeywords: (aiData?.seoKeywords as string[]) || [],
            };
          });

            return {
            success: true,
            data: { generatedContent, style: style || 'default' },
            ai_provider: 'openai' as const,
            response_time_ms: responseTimeMs,
            error: undefined,
          };
        }
      } catch (error) {
        console.error('[ContentCreator] OpenAI call failed:', error);
      }
    }

    const template = LANGUAGE_TEMPLATES[targetLanguage] || LANGUAGE_TEMPLATES.en;
    const styleModifier = style && STYLE_MODIFIERS[style] ? STYLE_MODIFIERS[style] : null;

    const generatedContent = products.map((product, index) => {
      const titleParts = [template.titlePrefix];
      if (styleModifier) {
        titleParts.push(styleModifier.titleAdjective);
      }
      titleParts.push(product.name, product.category);

      const title = titleParts.join(' ');

      const bulletPoints = [
        `${template.bulletPrefix} High-quality ${product.category} product`,
        `${template.bulletPrefix} ${product.name} - excellent value at $${product.price}`,
        `${template.bulletPrefix} Sourced for international markets`,
        `${template.bulletPrefix} Reliable and durable construction`,
        `${template.bulletPrefix} ${product.description || 'Premium selection for discerning buyers'}`,
      ];

      const detailDescription = `${template.descStart} ${product.name}, a top-tier ${product.category} product priced at $${product.price}. ${product.description || 'Crafted with quality materials for the global marketplace.'}`;

      const allText = `${title} ${bulletPoints.join(' ')} ${detailDescription}`;
      const complianceWarnings = SENSITIVE_WORDS.filter((word) =>
        allText.toLowerCase().includes(word.toLowerCase())
      );
      const compliancePassed = complianceWarnings.length === 0;

      return {
        productId: index,
        title,
        bulletPoints,
        detailDescription,
        language: targetLanguage,
        compliancePassed,
        complianceWarnings,
      };
    });

    return {
      success: true,
      data: { generatedContent, style: style || 'default' },
      ai_provider: 'fallback' as const,
      response_time_ms: 0,
      error: undefined,
      nextAgent: 'ad-optimizer' as const,
      nextAgentInput: { products, generatedContent },
    };
  }
}
