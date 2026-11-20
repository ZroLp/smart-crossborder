﻿﻿﻿import { initDatabase } from '@/lib/db/init';
import { SharedContext } from '@/lib/framework/shared-context';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';

// taskId 用数字字符串：AgentProgressTracker.isStopped 以 task_logs.id
// (BIGINT) 查询，非数字 taskId 在 Postgres 下会使所有进度写操作抛错
// （lib 层迁移残留缺陷，见 tests/framework/agent-progress.test.ts 说明）。

describe('Agent Closure: Ad Optimizer → Fulfillment → Customer Service → Product Selection Feedback', () => {
  let db: ReturnType<typeof initDatabase>;
  let sharedContext: SharedContext;
  let progressTracker: AgentProgressTracker;

  beforeEach(() => {
    db = initDatabase(':memory:');
    sharedContext = new SharedContext(db);
    progressTracker = new AgentProgressTracker(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test('ad-optimizer writes ad-campaign data', async () => {
    await sharedContext.setData('ad-optimizer', 'ad-campaign', {
      campaignId: 'camp-001',
      budget: 500,
      targetAudience: '25-35 years old',
      platforms: ['google', 'facebook'],
    });
    const data = await sharedContext.getData('ad-optimizer', 'ad-campaign');
    expect(data).not.toBeNull();
    expect((data as { campaignId: string; budget: number; platforms: string[] })!.campaignId).toBe('camp-001');
    expect((data as { campaignId: string; budget: number; platforms: string[] })!.budget).toBe(500);
    expect((data as { campaignId: string; budget: number; platforms: string[] })!.platforms).toContain('google');
  });

  test('fulfillment reads ad-campaign and writes order-data', async () => {
    await sharedContext.setData('ad-optimizer', 'ad-campaign', {
      campaignId: 'camp-002',
      budget: 1000,
    });
    const adCampaign = await sharedContext.getData('ad-optimizer', 'ad-campaign');
    expect(adCampaign).not.toBeNull();
    await sharedContext.setData('fulfillment', 'order-data', {
      orders: [
        { orderId: 'ORD-001', product: 'Shoes', quantity: 2, source: (adCampaign as { campaignId: string })!.campaignId },
        { orderId: 'ORD-002', product: 'Hat', quantity: 1, source: (adCampaign as { campaignId: string })!.campaignId },
      ],
    });
    const orderData = await sharedContext.getData('fulfillment', 'order-data');
    expect(orderData).not.toBeNull();
    expect((orderData as { orders: Array<{ source: string }> })!.orders).toHaveLength(2);
    expect((orderData as { orders: Array<{ source: string }> })!.orders[0].source).toBe('camp-002');
  });

  test('customer-service reads order-data and writes service-feedback', async () => {
    await sharedContext.setData('fulfillment', 'order-data', {
      orders: [{ orderId: 'ORD-100', product: 'Laptop', rating: 4.5 }],
    });
    const orderData = await sharedContext.getData('fulfillment', 'order-data');
    expect(orderData).not.toBeNull();
    await sharedContext.setData('customer-service', 'service-feedback', {
      feedback: [
        { orderId: (orderData as { orders: Array<{ orderId: string }> })!.orders[0].orderId, rating: 5, comment: 'Great product!' },
      ],
      satisfactionRate: 0.95,
    });
    const feedback = await sharedContext.getData('customer-service', 'service-feedback');
    expect(feedback).not.toBeNull();
    expect(
      ((feedback as { feedback: Array<{ orderId: string }>; satisfactionRate: number })!.feedback[0]).orderId
    ).toBe('ORD-100');
    expect((feedback as { feedback: Array<{ orderId: string }>; satisfactionRate: number })!.satisfactionRate).toBe(0.95);
  });

  test('product-selection reads service-feedback for feedback loop', async () => {
    await sharedContext.setData('customer-service', 'service-feedback', {
      feedback: [
        { productId: 'PROD-1', rating: 4.8, comment: 'Love it' },
        { productId: 'PROD-2', rating: 2.1, comment: 'Not as expected' },
      ],
      topComplaints: ['size issue', 'color mismatch'],
    });
    const feedback = await sharedContext.getData('customer-service', 'service-feedback');
    expect(feedback).not.toBeNull();
    await sharedContext.setData('selection', 'feedback-analysis', {
      lowRatedProducts: ((feedback as { feedback: Array<{ productId: string; rating: number }> }).feedback as Array<{ productId: string; rating: number }> | undefined)
        ?.filter((f) => f.rating < 3) ?? [],
      topComplaints: (feedback as { topComplaints: string[] }).topComplaints,
    });
    const analysis = await sharedContext.getData('selection', 'feedback-analysis');
    expect(analysis).not.toBeNull();
    expect((analysis as { lowRatedProducts: Array<{ productId: string }> }).lowRatedProducts).toHaveLength(1);
    expect((analysis as { lowRatedProducts: Array<{ productId: string }> }).lowRatedProducts[0].productId).toBe('PROD-2');
    expect((analysis as { topComplaints: string[] }).topComplaints).toContain('size issue');
  });

  test('full closure chain with progress tracking', async () => {
    await progressTracker.startTask('ad-optimizer', '1');
    await progressTracker.startStep('ad-optimizer', '1', AgentStep.Execution);
    await sharedContext.setData('ad-optimizer', 'ad-campaign', {
      id: 'C-999',
      impressions: 10000,
      clicks: 500,
      conversions: 50,
    });
    await progressTracker.completeStep('ad-optimizer', '1', AgentStep.Execution);
    const adData = await sharedContext.getData('ad-optimizer', 'ad-campaign');
    expect((adData as { conversions: number; id: string })!.conversions).toBe(50);
    await progressTracker.startTask('fulfillment', '2');
    await progressTracker.startStep('fulfillment', '2', AgentStep.Execution);
    await sharedContext.setData('fulfillment', 'order-data', {
      orders: [{ id: 'O-1', adCampaign: (adData as { id: string })!.id, value: 100 }],
    });
    await progressTracker.completeStep('fulfillment', '2', AgentStep.Execution);
    const orderData = await sharedContext.getData('fulfillment', 'order-data');
    expect(orderData).not.toBeNull();
    expect(((orderData as { orders: Array<{ adCampaign: string }> })!.orders[0] as { adCampaign: string }).adCampaign).toBe('C-999');
    await progressTracker.startTask('customer-service', '3');
    await progressTracker.startStep('customer-service', '3', AgentStep.ResultCallback);
    await sharedContext.setData('customer-service', 'service-feedback', {
      satisfaction: 0.88,
      orders: orderData,
    });
    await progressTracker.completeStep('customer-service', '3', AgentStep.ResultCallback);
    const feedback = await sharedContext.getData('customer-service', 'service-feedback');
    expect(feedback).not.toBeNull();
    expect((feedback as { satisfaction: number })!.satisfaction).toBe(0.88);
    expect(((feedback as { orders: { orders: Array<{ id: string }> } })!.orders as { orders: Array<{ id: string }> }).orders[0].id).toBe('O-1');
    await progressTracker.startTask('selection', '4');
    await progressTracker.startStep('selection', '4', AgentStep.DataCollection);
    await sharedContext.setData('selection', 'feedback-loop', {
      satisfaction: (feedback as { satisfaction: number })!.satisfaction,
      recommendation: (feedback as { satisfaction: number })!.satisfaction > 0.8 ? 'continue' : 'review',
    });
    await progressTracker.completeStep('selection', '4', AgentStep.DataCollection);
    const loopData = await sharedContext.getData('selection', 'feedback-loop');
    expect(loopData).not.toBeNull();
    expect((loopData as { recommendation: string; satisfaction: number })!.recommendation).toBe('continue');
    expect((loopData as { recommendation: string; satisfaction: number })!.satisfaction).toBe(0.88);
  });

  test('feedback data from customer-service is accessible by product-selection', async () => {
    const serviceFeedback = {
      metrics: {
        responseTime: '2h',
        resolutionRate: 0.92,
        customerSatisfaction: 4.6,
      },
      productIssues: [
        { product: 'Item A', issue: 'packaging damage' },
        { product: 'Item B', issue: 'wrong color shipped' },
      ],
    };
    await sharedContext.setData('customer-service', 'service-feedback', serviceFeedback);
    const retrieved = await sharedContext.getData('customer-service', 'service-feedback');
    expect(retrieved).not.toBeNull();
    const typed = retrieved as { metrics: { customerSatisfaction: number }; productIssues: Array<{ product: string }> };
    expect(typed!.metrics.customerSatisfaction).toBe(4.6);
    expect(typed!.productIssues).toHaveLength(2);
    await sharedContext.setData('selection', 'improvement-data', {
      productsToReview: typed!.productIssues,
      overallSatisfaction: typed!.metrics.customerSatisfaction,
    });
    const improvement = await sharedContext.getData('selection', 'improvement-data');
    expect(improvement).not.toBeNull();
    const typedImprovement = improvement as { productsToReview: Array<{ product: string }>; overallSatisfaction: number };
    expect(typedImprovement!.productsToReview[0].product).toBe('Item A');
    expect(typedImprovement!.overallSatisfaction).toBe(4.6);
  });
});
