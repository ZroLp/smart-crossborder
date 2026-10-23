import { MessageBus } from '@/lib/framework/message-bus';
import { CustomerServiceAgent } from '@/lib/agents/customer-service';
import { SharedContext } from '@/lib/framework/shared-context';

describe('CustomerServiceAgent', () => {
  let agent: CustomerServiceAgent;
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
    agent = new CustomerServiceAgent(bus);
  });

  describe('validate', () => {
    test('valid with message', () => {
      expect(agent.validate({ message: '你好' })).toBe(true);
    });

    test('invalid without message', () => {
      expect(agent.validate({})).toBe(false);
      expect(agent.validate({ message: 123 })).toBe(false);
      expect(agent.validate({ message: '' })).toBe(false);
    });
  });

  describe('execute - intent recognition', () => {
    test('recognizes shipping intent', async () => {
      const result = await agent.execute({ message: '我的物流到哪了' });
      expect(result.success).toBe(true);
      expect(result.data?.intent).toBe('shipping');
    });

    test('recognizes return intent', async () => {
      const result = await agent.execute({ message: '我要退货' });
      expect(result.success).toBe(true);
      expect(result.data?.intent).toBe('return');
    });

    test('recognizes payment intent', async () => {
      const result = await agent.execute({ message: '支付方式有哪些' });
      expect(result.success).toBe(true);
      expect(result.data?.intent).toBe('payment');
    });

    test('recognizes product intent', async () => {
      const result = await agent.execute({ message: '这个产品的尺寸是多少' });
      expect(result.success).toBe(true);
      expect(result.data?.intent).toBe('product');
    });

    test('recognizes customs intent', async () => {
      const result = await agent.execute({ message: '关税怎么算' });
      expect(result.success).toBe(true);
      expect(result.data?.intent).toBe('customs');
    });

    test('defaults to other intent', async () => {
      const result = await agent.execute({ message: '你好' });
      expect(result.success).toBe(true);
      expect(result.data?.intent).toBe('other');
    });
  });

  describe('execute - response templates', () => {
    test('returns Chinese response templates', async () => {
      const result = await agent.execute({ message: '物流查询', language: 'zh' });
      expect(result.success).toBe(true);
      expect(result.data?.response).toBe('您的包裹正在运输中，预计3-7个工作日到达。');
      expect(result.data?.language).toBe('zh');
    });

    test('returns English response templates', async () => {
      const result = await agent.execute({ message: 'shipping status', language: 'en' });
      expect(result.success).toBe(true);
      expect(result.data?.response).toBe('Your package is in transit, estimated delivery in 3-7 business days.');
      expect(result.data?.language).toBe('en');
    });
  });

  describe('execute - human escalation', () => {
    test('escalates for complaint/urgent messages', async () => {
      const result = await agent.execute({ message: '我要投诉' });
      expect(result.success).toBe(true);
      expect(result.data?.needsHumanEscalation).toBe(true);
    });

    test('no escalation for normal messages', async () => {
      const result = await agent.execute({ message: '物流查询' });
      expect(result.success).toBe(true);
      expect(result.data?.needsHumanEscalation).toBe(false);
    });
  });
});
