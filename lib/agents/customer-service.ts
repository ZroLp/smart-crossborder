import { BaseAgent } from '@/lib/framework/base-agent';
import { MessageBus } from '@/lib/framework/message-bus';
import { SharedContext } from '@/lib/framework/shared-context';
import { AgentResult } from '@/lib/framework/types';
import { callOpenAIJSON, isOpenAIAvailable } from '@/lib/ai/openai-client';
import { PROMPTS } from '@/lib/ai/prompts';

type Intent = 'shipping' | 'return' | 'payment' | 'product' | 'customs' | 'other';

const INTENT_KEYWORDS: Record<Exclude<Intent, 'other'>, string[]> = {
  shipping: ['物流', '快递', '配送', 'shipping', 'delivery', 'track', '追踪', '到货', '包裹'],
  return: ['退货', '退款', '换货', 'return', 'refund', 'exchange', '退换', '售后'],
  payment: ['支付', '付款', '结账', 'payment', 'pay', 'checkout', '信用卡', 'credit card', '支付宝'],
  product: ['尺寸', '规格', '参数', 'size', 'spec', 'material', '材质', '颜色', 'color', '重量', 'weight'],
  customs: ['关税', '清关', '报关', 'customs', 'duty', 'tax', '税费', '进口'],
};

const RESPONSE_TEMPLATES: Record<string, Record<Intent, string>> = {
  zh: {
    shipping: '您的包裹正在运输中，预计3-7个工作日到达。',
    return: '我们支持7天无理由退换货，请提供订单号以便处理。',
    payment: '我们支持多种支付方式，包括信用卡、PayPal等。',
    product: '请提供您想了解的具体产品信息。',
    customs: '关税根据目的地国家政策而定，我们会在发货前提供预估税费。',
    other: '感谢您的咨询，我们的客服团队将尽快为您解答。',
  },
  en: {
    shipping: 'Your package is in transit, estimated delivery in 3-7 business days.',
    return: 'We support 7-day hassle-free returns. Please provide your order number.',
    payment: 'We accept multiple payment methods including credit cards and PayPal.',
    product: 'Please specify the product information you would like to know.',
    customs: 'Customs duties vary by destination country. We provide estimated taxes before shipping.',
    other: 'Thank you for your inquiry. Our team will respond shortly.',
  },
};

const ESCALATION_KEYWORDS = ['投诉', 'complaint', 'urgent', '紧急', 'manager', '经理'];

export class CustomerServiceAgent extends BaseAgent {
  constructor(messageBus: MessageBus) {
    super(
      { name: '客服Agent', type: 'customer-service', description: '多语种智能跨境客服智能体' },
      messageBus,
    );
  }

  validate(input: Record<string, unknown>): boolean {
    return typeof input.message === 'string' && input.message.length > 0;
  }

  async execute(input: Record<string, unknown>): Promise<AgentResult> {
    if (!this.validate(input)) {
      return this.fail('Invalid input: message is required');
    }

    const message = input.message as string;
    const language = (input.language as string) || 'zh';
    const startTime = Date.now();

    try {
      if (isOpenAIAvailable()) {
        const aiResult = await callOpenAIJSON({
          systemPrompt: PROMPTS.customerService.system,
          userPrompt: `Customer message: "${message}"\nLanguage: ${language}`,
        });

        if (aiResult) {
          const responseTime = Date.now() - startTime;
          const intent = (aiResult as any).intent || 'other';
          const response = (aiResult as any).response || '';
          const needsHumanEscalation = (aiResult as any).escalationNeeded === true;

          const resultData = {
            intent,
            response,
            language,
            needsHumanEscalation,
            confidence: (aiResult as any).sentiment ? 0.9 : 0.85,
            sentiment: (aiResult as any).sentiment,
            suggestedActions: (aiResult as any).suggestedActions || [],
          };

          if (this.sharedContext) {
            this.writeToSharedContext('service-feedback', resultData);
          }

          return {
            success: true,
            data: resultData as Record<string, unknown>,
            ai_provider: 'openai',
            response_time_ms: responseTime,
            error: undefined,
          };
        }
      }
    } catch (error) {
      console.error('[CustomerServiceAgent] OpenAI call failed:', error);
    }

    const fallbackStartTime = Date.now();
    const intent = this.recognizeIntent(message);
    const response = RESPONSE_TEMPLATES[language]?.[intent] ?? RESPONSE_TEMPLATES.zh[intent];
    const needsHumanEscalation = intent === 'other' && ESCALATION_KEYWORDS.some((kw) => message.includes(kw));

    this.emit('intent-recognized', { intent, message });

    const resultData = { intent, resolved: !needsHumanEscalation, timestamp: new Date().toISOString() };

    if (this.sharedContext) {
      this.writeToSharedContext('service-feedback', resultData);
    }

    const responseTime = Date.now() - fallbackStartTime;

    return {
      success: true,
      data: { intent, response, language, needsHumanEscalation, confidence: 0.85 },
      ai_provider: 'fallback',
      response_time_ms: responseTime,
      error: undefined,
    };
  }

  private recognizeIntent(message: string): Intent {
    const lowerMessage = message.toLowerCase();
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      if (keywords.some((kw) => lowerMessage.includes(kw.toLowerCase()))) {
        return intent as Intent;
      }
    }
    return 'other';
  }
}
