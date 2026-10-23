import { BaseAgent } from '@/lib/framework/base-agent';
import { MessageBus } from '@/lib/framework/message-bus';
import { callOpenAIJSON, isOpenAIAvailable } from '@/lib/ai/openai-client';
import { PROMPTS } from '@/lib/ai/prompts';

interface Campaign {
  id: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

interface AdData {
  campaigns: Campaign[];
  shopRevenue?: number;
}

export class AdOptimizerAgent extends BaseAgent {
  constructor(messageBus: MessageBus) {
    super(
      { name: '投流Agent', type: 'ad-optimizer', description: '全域广告智能优化智能体' },
      messageBus
    );
  }

  validate(input: Record<string, unknown>): boolean {
    return typeof input.adData === 'object' && input.adData !== null && Array.isArray((input.adData as AdData).campaigns);
  }

  async execute(input: Record<string, unknown>) {
    if (!this.validate(input)) {
      return this.fail('Invalid input: adData with campaigns array is required');
    }

    const adData = input.adData as AdData;
    const { campaigns, shopRevenue } = adData;
    const startTime = Date.now();

    try {
      if (isOpenAIAvailable()) {
        const userPrompt = `Analyze the following campaign data and provide optimization recommendations:

${JSON.stringify({ campaigns, shopRevenue }, null, 2)}`;

        const aiResult = await callOpenAIJSON({
          systemPrompt: PROMPTS.adOptimizer.system,
          userPrompt,
        });

        if (aiResult !== null) {
          const responseTime = Date.now() - startTime;
          return {
            success: true,
            data: aiResult as Record<string, unknown>,
            ai_provider: 'openai' as const,
            response_time_ms: responseTime,
            error: undefined,
            nextAgent: 'fulfillment' as const,
            nextAgentInput: { campaigns: adData.campaigns },
          };
        }
      }
    } catch (error) {
    }

    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);

    const campaignAnalysis = campaigns.map((campaign) => {
      const roas = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;

      const realRevenue = shopRevenue
        ? shopRevenue * (campaign.conversions / (totalConversions || 1))
        : campaign.revenue;
      const realRoas = campaign.spend > 0 ? realRevenue / campaign.spend : 0;

      const cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
      const ctr = campaign.impressions > 0 ? campaign.clicks / campaign.impressions : 0;
      const conversionRate = campaign.clicks > 0 ? campaign.conversions / campaign.clicks : 0;

      const inefficient = roas < 1.0 || ctr < 0.01;

      let suggestion: { action: string; factor?: number };
      if (roas >= 3.0 && ctr >= 0.03) {
        suggestion = { action: 'increase_bid', factor: 1.2 };
      } else if (roas >= 1.5 && roas < 3.0) {
        suggestion = { action: 'maintain_bid' };
      } else if (roas < 0.5) {
        suggestion = { action: 'pause' };
      } else if (roas < 1.0) {
        suggestion = { action: 'decrease_bid', factor: 0.7 };
      } else {
        suggestion = { action: 'maintain_bid' };
      }

      return {
        id: campaign.id,
        platform: campaign.platform,
        spend: campaign.spend,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        conversions: campaign.conversions,
        revenue: campaign.revenue,
        roas,
        realRoas,
        cpc,
        ctr,
        conversionRate,
        inefficient,
        suggestion,
      };
    });

    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
    const totalROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const efficientCampaigns = campaignAnalysis.filter((c) => !c.inefficient).length;
    const inefficientCampaigns = campaignAnalysis.filter((c) => c.inefficient).length;

    const summary = {
      totalSpend,
      totalRevenue,
      totalROAS,
      efficientCampaigns,
      inefficientCampaigns,
    };

    const suggestions = campaignAnalysis.map((c) => ({
      id: c.id,
      suggestion: c.suggestion,
    }));

    const responseTime = Date.now() - startTime;

    return {
      success: true,
      data: { campaignAnalysis, summary, suggestions },
      ai_provider: 'fallback' as const,
      response_time_ms: responseTime,
      error: undefined,
      nextAgent: 'fulfillment' as const,
      nextAgentInput: { campaigns: adData.campaigns },
    };
  }
}
