import { BaseAgent } from '@/lib/framework/base-agent';
import { MessageBus } from '@/lib/framework/message-bus';
import { AgentResult } from '@/lib/framework/types';
import { callOpenAIJSON, isOpenAIAvailable } from '@/lib/ai/openai-client';
import { PROMPTS } from '@/lib/ai/prompts';

interface LogisticsChannel {
  id: string;
  name: string;
  regions: string[];
  maxWeight: number;
  estimatedDays: string;
  costPerKg: number;
  reliability: number;
}

interface Order {
  orderNumber: string;
  shippingRegion: string;
  shippingWeight: number;
  items?: Array<{ itemId: string; quantity?: number }>;
  totalAmount?: number;
}

const CHANNELS: LogisticsChannel[] = [
  { id: 'ch-001', name: '中邮小包', regions: ['SEA', 'EUROPE', 'LATAM'], maxWeight: 2, estimatedDays: '15-30', costPerKg: 50, reliability: 0.85 },
  { id: 'ch-002', name: 'DHL Express', regions: ['EUROPE', 'NORTH_AMERICA'], maxWeight: 30, estimatedDays: '3-7', costPerKg: 200, reliability: 0.98 },
  { id: 'ch-003', name: 'FedEx International', regions: ['NORTH_AMERICA', 'LATAM'], maxWeight: 30, estimatedDays: '5-10', costPerKg: 180, reliability: 0.96 },
  { id: 'ch-004', name: '东南亚专线', regions: ['SEA'], maxWeight: 10, estimatedDays: '7-15', costPerKg: 80, reliability: 0.90 },
  { id: 'ch-005', name: '拉美专线', regions: ['LATAM'], maxWeight: 5, estimatedDays: '20-35', costPerKg: 120, reliability: 0.82 },
];

export class FulfillmentAgent extends BaseAgent {
  constructor(messageBus: MessageBus) {
    super(
      { name: '履约Agent', type: 'fulfillment', description: '跨境订单合规履约智能体' },
      messageBus,
    );
  }

  validate(input: Record<string, unknown>): boolean {
    return typeof input.order === 'object' && input.order !== null;
  }

  async execute(input: Record<string, unknown>): Promise<AgentResult> {
    if (!this.validate(input)) {
      return this.fail('Invalid input: order is required');
    }

    const order = input.order as Order;
    const startTime = Date.now();

    if (isOpenAIAvailable()) {
      try {
        const { isAbnormal, abnormalReasons } = this.detectAbnormal(order);
        const aiResult = await callOpenAIJSON({
          systemPrompt: PROMPTS.fulfillment.system,
          userPrompt: `Order information: ${JSON.stringify(order)}`,
        });

        if (aiResult) {
          const responseTime = Date.now() - startTime;
          return {
            success: true,
            data: aiResult as Record<string, unknown>,
            ai_provider: 'openai' as const,
            response_time_ms: responseTime,
            error: undefined,
            nextAgent: 'customer-service' as const,
            nextAgentInput: { order, recommendedChannels: this.matchChannels(order), customsDocuments: this.generateCustomsDocuments(order), inventoryStatus: this.checkInventory(order), isAbnormal, abnormalReasons },
          };
        }
      } catch {
      }
    }

    const recommendedChannels = this.matchChannels(order);
    const customsDocuments = this.generateCustomsDocuments(order);
    const inventoryStatus = this.checkInventory(order);
    const { isAbnormal, abnormalReasons } = this.detectAbnormal(order);

    this.emit('fulfillment-completed', { orderNumber: order.orderNumber, isAbnormal });

    const responseTime = Date.now() - startTime;

    return {
      success: true,
      data: { recommendedChannels, customsDocuments, inventoryStatus, isAbnormal, abnormalReasons },
      ai_provider: 'fallback' as const,
      response_time_ms: responseTime,
      error: undefined,
      nextAgent: 'customer-service' as const,
      nextAgentInput: { order, recommendedChannels, customsDocuments, inventoryStatus, isAbnormal, abnormalReasons },
    };
  }

  private matchChannels(order: Order) {
    const matched = CHANNELS
      .filter((ch) => ch.regions.includes(order.shippingRegion) && order.shippingWeight <= ch.maxWeight)
      .map((ch) => {
        const estimatedCost = order.shippingWeight * ch.costPerKg;
        const score = ch.reliability * 0.4 + (1 / estimatedCost) * 0.6;
        return { ...ch, estimatedCost, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return matched.map(({ score, ...rest }) => rest);
  }

  private generateCustomsDocuments(order: Order) {
    return {
      orderId: order.orderNumber,
      commercialInvoice: true,
      packingList: true,
      customsDeclaration: true,
      hsCode: 'auto-detect',
      declaredValue: (order.totalAmount ?? 0) * 0.7,
    };
  }

  private checkInventory(order: Order) {
    if (!order.items || order.items.length === 0) return [];
    return order.items.map((item) => {
      const currentStock = Math.floor(Math.random() * 91) + 10;
      return {
        itemId: item.itemId,
        currentStock,
        status: currentStock > 0 ? 'available' : 'out-of-stock',
      };
    });
  }

  private detectAbnormal(order: Order) {
    const reasons: string[] = [];
    if (order.shippingWeight > 30) reasons.push('超重包裹');
    if (!order.shippingRegion) reasons.push('缺少配送区域');
    if (order.totalAmount && order.totalAmount > 10000) reasons.push('高额订单');
    return { isAbnormal: reasons.length > 0, abnormalReasons: reasons };
  }
}
