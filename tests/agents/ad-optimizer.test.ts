import { MessageBus } from '@/lib/framework/message-bus';
import { AdOptimizerAgent } from '@/lib/agents/ad-optimizer';

describe('AdOptimizerAgent', () => {
  let agent: AdOptimizerAgent;
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
    agent = new AdOptimizerAgent(bus);
  });

  describe('validate', () => {
    test('valid with adData', () => {
      expect(agent.validate({ adData: { campaigns: [] } })).toBe(true);
    });

    test('invalid without adData', () => {
      expect(agent.validate({})).toBe(false);
      expect(agent.validate({ adData: null })).toBe(false);
      expect(agent.validate({ adData: 'not-object' })).toBe(false);
      expect(agent.validate({ adData: {} })).toBe(false);
    });
  });

  describe('execute', () => {
    const campaigns = [
      { id: 'c1', platform: 'google', spend: 100, impressions: 10000, clicks: 500, conversions: 25, revenue: 300 },
      { id: 'c2', platform: 'facebook', spend: 200, impressions: 20000, clicks: 200, conversions: 10, revenue: 150 },
    ];

    test('ROAS calculation correct', async () => {
      const result = await agent.execute({ adData: { campaigns } });
      expect(result.success).toBe(true);
      const analysis = result.data!.campaignAnalysis as Array<Record<string, unknown>>;
      expect(analysis[0].roas).toBeCloseTo(3.0);
      expect(analysis[1].roas).toBeCloseTo(0.75);
    });

    test('realROAS with shopRevenue', async () => {
      const result = await agent.execute({
        adData: { campaigns, shopRevenue: 1000 },
      });
      expect(result.success).toBe(true);
      const analysis = result.data!.campaignAnalysis as Array<Record<string, unknown>>;
      const totalConversions = 25 + 10;
      const expectedRealRoas0 = (1000 * (25 / totalConversions)) / 100;
      const expectedRealRoas1 = (1000 * (10 / totalConversions)) / 200;
      expect(analysis[0].realRoas).toBeCloseTo(expectedRealRoas0);
      expect(analysis[1].realRoas).toBeCloseTo(expectedRealRoas1);
    });

    test('CPC and CTR calculation', async () => {
      const result = await agent.execute({ adData: { campaigns } });
      expect(result.success).toBe(true);
      const analysis = result.data!.campaignAnalysis as Array<Record<string, unknown>>;
      expect(analysis[0].cpc).toBeCloseTo(100 / 500);
      expect(analysis[0].ctr).toBeCloseTo(500 / 10000);
      expect(analysis[0].conversionRate).toBeCloseTo(25 / 500);
    });

    test('inefficient ad identification (low ROAS)', async () => {
      const result = await agent.execute({ adData: { campaigns } });
      expect(result.success).toBe(true);
      const analysis = result.data!.campaignAnalysis as Array<Record<string, unknown>>;
      expect(analysis[0].inefficient).toBe(false);
      expect(analysis[1].inefficient).toBe(true);
    });

    test('inefficient ad identification (low CTR)', async () => {
      const lowCtrCampaigns = [
        { id: 'c3', platform: 'tiktok', spend: 50, impressions: 10000, clicks: 50, conversions: 5, revenue: 200 },
      ];
      const result = await agent.execute({ adData: { campaigns: lowCtrCampaigns } });
      expect(result.success).toBe(true);
      const analysis = result.data!.campaignAnalysis as Array<Record<string, unknown>>;
      expect(analysis[0].inefficient).toBe(true);
    });

    test('bid suggestions - increase_bid for high ROAS and CTR', async () => {
      const highPerforming = [
        { id: 'c4', platform: 'google', spend: 100, impressions: 10000, clicks: 500, conversions: 50, revenue: 500 },
      ];
      const result = await agent.execute({ adData: { campaigns: highPerforming } });
      expect(result.success).toBe(true);
      const analysis = result.data!.campaignAnalysis as Array<Record<string, unknown>>;
      expect((analysis[0].suggestion as Record<string, unknown>).action).toBe('increase_bid');
      expect((analysis[0].suggestion as Record<string, unknown>).factor).toBe(1.2);
    });

    test('bid suggestions - maintain_bid for moderate ROAS', async () => {
      const moderate = [
        { id: 'c5', platform: 'facebook', spend: 100, impressions: 10000, clicks: 300, conversions: 15, revenue: 200 },
      ];
      const result = await agent.execute({ adData: { campaigns: moderate } });
      expect(result.success).toBe(true);
      const analysis = result.data!.campaignAnalysis as Array<Record<string, unknown>>;
      expect((analysis[0].suggestion as Record<string, unknown>).action).toBe('maintain_bid');
    });

    test('bid suggestions - decrease_bid for low ROAS', async () => {
      const lowRoas = [
        { id: 'c6', platform: 'tiktok', spend: 100, impressions: 5000, clicks: 200, conversions: 5, revenue: 80 },
      ];
      const result = await agent.execute({ adData: { campaigns: lowRoas } });
      expect(result.success).toBe(true);
      const analysis = result.data!.campaignAnalysis as Array<Record<string, unknown>>;
      expect((analysis[0].suggestion as Record<string, unknown>).action).toBe('decrease_bid');
      expect((analysis[0].suggestion as Record<string, unknown>).factor).toBe(0.7);
    });

    test('bid suggestions - pause for very low ROAS', async () => {
      const veryLowRoas = [
        { id: 'c7', platform: 'snapchat', spend: 100, impressions: 5000, clicks: 200, conversions: 2, revenue: 30 },
      ];
      const result = await agent.execute({ adData: { campaigns: veryLowRoas } });
      expect(result.success).toBe(true);
      const analysis = result.data!.campaignAnalysis as Array<Record<string, unknown>>;
      expect((analysis[0].suggestion as Record<string, unknown>).action).toBe('pause');
    });

    test('summary totals correct', async () => {
      const result = await agent.execute({ adData: { campaigns } });
      expect(result.success).toBe(true);
      const summary = result.data!.summary as Record<string, unknown>;
      expect(summary.totalSpend).toBe(300);
      expect(summary.totalRevenue).toBe(450);
      expect(summary.totalROAS).toBeCloseTo(450 / 300);
      expect(summary.efficientCampaigns).toBe(1);
      expect(summary.inefficientCampaigns).toBe(1);
    });

    test('nextAgent is fulfillment', async () => {
      const result = await agent.execute({ adData: { campaigns } });
      expect(result.success).toBe(true);
      expect(result.nextAgent).toBe('fulfillment');
    });

    test('zero spend edge case', async () => {
      const zeroSpend = [
        { id: 'c8', platform: 'google', spend: 0, impressions: 1000, clicks: 50, conversions: 5, revenue: 100 },
      ];
      const result = await agent.execute({ adData: { campaigns: zeroSpend } });
      expect(result.success).toBe(true);
      const analysis = result.data!.campaignAnalysis as Array<Record<string, unknown>>;
      expect(analysis[0].roas).toBe(0);
      expect(analysis[0].realRoas).toBe(0);
      expect(analysis[0].cpc).toBe(0);
    });
  });
});
