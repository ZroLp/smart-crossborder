import Database from 'better-sqlite3';
import { SharedContext } from '@/lib/framework/shared-context';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_type TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_shared_context_agent_key ON shared_context(agent_type, key);
    CREATE TABLE IF NOT EXISTS agent_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_type TEXT NOT NULL,
      task_id TEXT NOT NULL,
      steps TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_agent_progress_task ON agent_progress(agent_type, task_id);
  `);
  return db;
}

describe('Agent Closure: Ad Optimizer → Fulfillment → Customer Service → Product Selection Feedback', () => {
  let db: Database.Database;
  let sharedContext: SharedContext;
  let progressTracker: AgentProgressTracker;

  beforeEach(() => {
    db = createTestDb();
    sharedContext = new SharedContext(db);
    progressTracker = new AgentProgressTracker(db);
  });

  afterEach(() => {
    db.close();
  });

  test('ad-optimizer writes ad-campaign data', () => {
    sharedContext.setData('ad-optimizer', 'ad-campaign', {
      campaignId: 'camp-001',
      budget: 500,
      targetAudience: '25-35 years old',
      platforms: ['google', 'facebook'],
    });
    const data = sharedContext.getData('ad-optimizer', 'ad-campaign') as { campaignId: string; budget: number; platforms: string[] };
    expect(data).not.toBeNull();
    expect(data!.campaignId).toBe('camp-001');
    expect(data!.budget).toBe(500);
    expect(data!.platforms).toContain('google');
  });

  test('fulfillment reads ad-campaign and writes order-data', () => {
    sharedContext.setData('ad-optimizer', 'ad-campaign', {
      campaignId: 'camp-002',
      budget: 1000,
    });
    const adCampaign = sharedContext.getData('ad-optimizer', 'ad-campaign') as { campaignId: string; budget: number };
    expect(adCampaign).not.toBeNull();
    sharedContext.setData('fulfillment', 'order-data', {
      orders: [
        { orderId: 'ORD-001', product: 'Shoes', quantity: 2, source: adCampaign!.campaignId },
        { orderId: 'ORD-002', product: 'Hat', quantity: 1, source: adCampaign!.campaignId },
      ],
    });
    const orderData = sharedContext.getData('fulfillment', 'order-data') as { orders: Array<{ source: string }> };
    expect(orderData).not.toBeNull();
    expect(orderData!.orders).toHaveLength(2);
    expect((orderData!.orders[0] as { source: string }).source).toBe('camp-002');
  });

  test('customer-service reads order-data and writes service-feedback', () => {
    sharedContext.setData('fulfillment', 'order-data', {
      orders: [{ orderId: 'ORD-100', product: 'Laptop', rating: 4.5 }],
    });
    const orderData = sharedContext.getData('fulfillment', 'order-data') as { orders: Array<{ orderId: string }> };
    expect(orderData).not.toBeNull();
    sharedContext.setData('customer-service', 'service-feedback', {
      feedback: [
        { orderId: (orderData!.orders[0] as { orderId: string }).orderId, rating: 5, comment: 'Great product!' },
      ],
      satisfactionRate: 0.95,
    });
    const feedback = sharedContext.getData('customer-service', 'service-feedback') as { feedback: Array<{ orderId: string }>; satisfactionRate: number };
    expect(feedback).not.toBeNull();
    expect((feedback!.feedback[0] as { orderId: string }).orderId).toBe('ORD-100');
    expect(feedback!.satisfactionRate).toBe(0.95);
  });

  test('product-selection reads service-feedback for feedback loop', () => {
    sharedContext.setData('customer-service', 'service-feedback', {
      feedback: [
        { productId: 'PROD-1', rating: 4.8, comment: 'Love it' },
        { productId: 'PROD-2', rating: 2.1, comment: 'Not as expected' },
      ],
      topComplaints: ['size issue', 'color mismatch'],
    });
    const feedback = sharedContext.getData('customer-service', 'service-feedback') as {
      feedback: Array<{ productId: string; rating: number }>;
      topComplaints: string[];
    };
    expect(feedback).not.toBeNull();
    sharedContext.setData('selection', 'feedback-analysis', {
      lowRatedProducts: (feedback!.feedback as Array<{ productId: string; rating: number }>).filter((f: { rating: number }) => f.rating < 3),
      topComplaints: feedback!.topComplaints,
    });
    const analysis = sharedContext.getData('selection', 'feedback-analysis') as { lowRatedProducts: Array<{ productId: string }>; topComplaints: string[] };
    expect(analysis).not.toBeNull();
    expect(analysis!.lowRatedProducts).toHaveLength(1);
    expect(analysis!.lowRatedProducts[0].productId).toBe('PROD-2');
    expect(analysis!.topComplaints).toContain('size issue');
  });

  test('full closure chain with progress tracking', () => {
    progressTracker.startTask('ad-optimizer', 'closure-task-1');
    progressTracker.startStep('ad-optimizer', 'closure-task-1', AgentStep.Execution);
    sharedContext.setData('ad-optimizer', 'ad-campaign', {
      id: 'C-999',
      impressions: 10000,
      clicks: 500,
      conversions: 50,
    });
    progressTracker.completeStep('ad-optimizer', 'closure-task-1', AgentStep.Execution);
    const adData = sharedContext.getData('ad-optimizer', 'ad-campaign') as { conversions: number; id: string };
    expect(adData!.conversions).toBe(50);
    progressTracker.startTask('fulfillment', 'closure-task-2');
    progressTracker.startStep('fulfillment', 'closure-task-2', AgentStep.Execution);
    sharedContext.setData('fulfillment', 'order-data', {
      orders: [{ id: 'O-1', adCampaign: adData!.id, value: 100 }],
    });
    progressTracker.completeStep('fulfillment', 'closure-task-2', AgentStep.Execution);
    const orderData = sharedContext.getData('fulfillment', 'order-data') as { orders: Array<{ adCampaign: string }> };
    expect(orderData).not.toBeNull();
    expect((orderData!.orders[0] as { adCampaign: string }).adCampaign).toBe('C-999');
    progressTracker.startTask('customer-service', 'closure-task-3');
    progressTracker.startStep('customer-service', 'closure-task-3', AgentStep.ResultCallback);
    sharedContext.setData('customer-service', 'service-feedback', {
      satisfaction: 0.88,
      orders: orderData,
    });
    progressTracker.completeStep('customer-service', 'closure-task-3', AgentStep.ResultCallback);
    const feedback = sharedContext.getData('customer-service', 'service-feedback') as { satisfaction: number; orders: { orders: Array<{ id: string }> } };
    expect(feedback).not.toBeNull();
    expect(feedback!.satisfaction).toBe(0.88);
    expect((feedback!.orders as { orders: Array<{ id: string }> }).orders[0].id).toBe('O-1');
    progressTracker.startTask('selection', 'closure-task-4');
    progressTracker.startStep('selection', 'closure-task-4', AgentStep.DataCollection);
    sharedContext.setData('selection', 'feedback-loop', {
      satisfaction: feedback!.satisfaction,
      recommendation: feedback!.satisfaction > 0.8 ? 'continue' : 'review',
    });
    progressTracker.completeStep('selection', 'closure-task-4', AgentStep.DataCollection);
    const loopData = sharedContext.getData('selection', 'feedback-loop') as { recommendation: string; satisfaction: number };
    expect(loopData).not.toBeNull();
    expect(loopData!.recommendation).toBe('continue');
    expect(loopData!.satisfaction).toBe(0.88);
  });

  test('feedback data from customer-service is accessible by product-selection', () => {
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
    sharedContext.setData('customer-service', 'service-feedback', serviceFeedback);
    const retrieved = sharedContext.getData('customer-service', 'service-feedback') as {
      metrics: { customerSatisfaction: number };
      productIssues: Array<{ product: string }>;
    };
    expect(retrieved).not.toBeNull();
    expect((retrieved!.metrics as { customerSatisfaction: number }).customerSatisfaction).toBe(4.6);
    expect((retrieved!.productIssues as Array<{ product: string }>)).toHaveLength(2);
    sharedContext.setData('selection', 'improvement-data', {
      productsToReview: retrieved!.productIssues,
      overallSatisfaction: retrieved!.metrics.customerSatisfaction,
    });
    const improvement = sharedContext.getData('selection', 'improvement-data') as {
      productsToReview: Array<{ product: string }>;
      overallSatisfaction: number;
    };
    expect(improvement).not.toBeNull();
    expect((improvement!.productsToReview as Array<{ product: string }>)[0].product).toBe('Item A');
    expect(improvement!.overallSatisfaction).toBe(4.6);
  });
});
