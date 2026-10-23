import { NLCommandParser, ParsedCommand } from '@/lib/framework/nl-parser';
import { AgentType } from '@/lib/framework/types';
import { POST } from '@/app/api/command/route';
import { NextRequest } from 'next/server';

describe('NLCommandParser', () => {
  let parser: NLCommandParser;

  beforeEach(() => {
    parser = new NLCommandParser();
  });

  describe('Chinese commands', () => {
    test('parses selection agent - 选品', async () => {
      const result = await parser.parse('帮我选品');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('selection');
      expect(result!.params.action).toBe('analyze');
    });

    test('parses selection agent - 爆款', async () => {
      const result = await parser.parse('找爆款商品');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('selection');
    });

    test('parses store-builder agent - 建站', async () => {
      const result = await parser.parse('帮我建站');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('store-builder');
      expect(result!.params.action).toBe('build');
    });

    test('parses store-builder agent - 店铺', async () => {
      const result = await parser.parse('创建店铺');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('store-builder');
    });

    test('parses content agent - 文案', async () => {
      const result = await parser.parse('写文案');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('content');
      expect(result!.params.action).toBe('generate');
    });

    test('parses content agent - 翻译', async () => {
      const result = await parser.parse('翻译产品描述');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('content');
    });

    test('parses ad-optimizer agent - 投流', async () => {
      const result = await parser.parse('帮我投流');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('ad-optimizer');
      expect(result!.params.action).toBe('optimize');
    });

    test('parses ad-optimizer agent - 广告', async () => {
      const result = await parser.parse('优化广告投放');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('ad-optimizer');
    });

    test('parses customer-service agent - 客服', async () => {
      const result = await parser.parse('处理客服问题');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('customer-service');
      expect(result!.params.action).toBe('reply');
    });

    test('parses customer-service agent - 回复', async () => {
      const result = await parser.parse('自动回复客户');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('customer-service');
    });

    test('parses fulfillment agent - 发货', async () => {
      const result = await parser.parse('安排发货');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('fulfillment');
      expect(result!.params.action).toBe('process');
    });

    test('parses fulfillment agent - 物流', async () => {
      const result = await parser.parse('查询物流状态');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('fulfillment');
    });
  });

  describe('English commands', () => {
    test('parses selection agent - product', async () => {
      const result = await parser.parse('find a product for me');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('selection');
    });

    test('parses selection agent - trending', async () => {
      const result = await parser.parse('show me trending items');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('selection');
    });

    test('parses store-builder agent - store', async () => {
      const result = await parser.parse('build a store');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('store-builder');
    });

    test('parses content agent - content', async () => {
      const result = await parser.parse('generate content');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('content');
    });

    test('parses ad-optimizer agent - campaign', async () => {
      const result = await parser.parse('create a campaign');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('ad-optimizer');
    });

    test('parses customer-service agent - customer', async () => {
      const result = await parser.parse('handle customer inquiry');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('customer-service');
    });

    test('parses fulfillment agent - shipping', async () => {
      const result = await parser.parse('arrange shipping');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('fulfillment');
    });
  });

  describe('parameter extraction', () => {
    test('extracts category - 服装', async () => {
      const result = await parser.parse('选品服装类目');
      expect(result).not.toBeNull();
      expect(result!.params.category).toBe('clothing');
    });

    test('extracts category - 电子产品', async () => {
      const result = await parser.parse('推荐电子产品');
      expect(result).not.toBeNull();
      expect(result!.params.category).toBe('electronics');
    });

    test('extracts category - 家居', async () => {
      const result = await parser.parse('选品家居用品');
      expect(result).not.toBeNull();
      expect(result!.params.category).toBe('home');
    });

    test('extracts category - 美妆', async () => {
      const result = await parser.parse('推荐美妆产品');
      expect(result).not.toBeNull();
      expect(result!.params.category).toBe('beauty');
    });

    test('extracts market - 美国', async () => {
      const result = await parser.parse('选品美国市场');
      expect(result).not.toBeNull();
      expect(result!.params.market).toBe('US');
    });

    test('extracts market - 欧洲', async () => {
      const result = await parser.parse('投放欧洲市场广告');
      expect(result).not.toBeNull();
      expect(result!.params.market).toBe('EU');
    });

    test('extracts market - 东南亚', async () => {
      const result = await parser.parse('东南亚市场选品');
      expect(result).not.toBeNull();
      expect(result!.params.market).toBe('SEA');
    });

    test('extracts language - 英文', async () => {
      const result = await parser.parse('生成英文文案');
      expect(result).not.toBeNull();
      expect(result!.params.language).toBe('en');
    });

    test('extracts language - 西班牙语', async () => {
      const result = await parser.parse('翻译成西班牙语');
      expect(result).not.toBeNull();
      expect(result!.params.language).toBe('es');
    });

    test('extracts multiple params', async () => {
      const result = await parser.parse('选品美国市场服装类目');
      expect(result).not.toBeNull();
      expect(result!.params.category).toBe('clothing');
      expect(result!.params.market).toBe('US');
    });
  });

  describe('confidence scoring', () => {
    test('single keyword match has lower confidence', async () => {
      const result = await parser.parse('选品');
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThanOrEqual(1);
    });

    test('multiple keyword matches have higher confidence', async () => {
      const singleResult = await parser.parse('选品');
      const multiResult = await parser.parse('选品推荐商品爆款');
      expect(multiResult!.confidence).toBeGreaterThan(singleResult!.confidence);
    });

    test('confidence is between 0 and 1', async () => {
      const result = await parser.parse('帮我投流优化广告');
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('unrecognized input', () => {
    test('returns null for empty string', async () => {
      expect(await parser.parse('')).toBeNull();
    });

    test('returns null for whitespace only', async () => {
      expect(await parser.parse('   ')).toBeNull();
    });

    test('returns null for unrecognized input', async () => {
      expect(await parser.parse('今天天气怎么样')).toBeNull();
    });

    test('returns null for random English text', async () => {
      expect(await parser.parse('what is the meaning of life')).toBeNull();
    });
  });

  describe('getTemplates', () => {
    test('returns all 6 templates', () => {
      const templates = parser.getTemplates();
      expect(templates).toHaveLength(6);
    });

    test('templates cover all agent types', () => {
      const templates = parser.getTemplates();
      const agentTypes = templates.map((t) => t.agentType);
      expect(agentTypes).toContain('selection');
      expect(agentTypes).toContain('store-builder');
      expect(agentTypes).toContain('content');
      expect(agentTypes).toContain('ad-optimizer');
      expect(agentTypes).toContain('customer-service');
      expect(agentTypes).toContain('fulfillment');
    });

    test('each template has keywords and defaultParams', () => {
      const templates = parser.getTemplates();
      for (const template of templates) {
        expect(template.keywords.length).toBeGreaterThan(0);
        expect(template.defaultParams).toBeDefined();
        expect(template.defaultParams.action).toBeDefined();
      }
    });
  });

  describe('mixed Chinese/English input', () => {
    test('parses mixed 选品 and product', async () => {
      const result = await parser.parse('帮我选品 find product');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('selection');
    });

    test('parses mixed 建站 and store', async () => {
      const result = await parser.parse('建站 build store');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('store-builder');
    });

    test('parses mixed 广告 and optimize', async () => {
      const result = await parser.parse('广告投放 optimize campaign');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('ad-optimizer');
    });

    test('parses mixed 物流 and shipping', async () => {
      const result = await parser.parse('物流 shipping');
      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('fulfillment');
    });
  });
});

describe('Command API Route', () => {
  function createRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost:3000/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  test('returns parsed command for valid input', async () => {
    const request = createRequest({ command: '帮我选品' });
    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.agentType).toBe('selection');
    expect(data.params).toBeDefined();
    expect(data.confidence).toBeGreaterThan(0);
  });

  test('returns error for unrecognized command', async () => {
    const request = createRequest({ command: '今天天气怎么样' });
    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe('无法识别指令意图');
  });

  test('returns error for missing command', async () => {
    const request = createRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe('Missing or invalid command');
  });

  test('returns error for empty command', async () => {
    const request = createRequest({ command: '' });
    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
  });

  test('returns params with extracted category and market', async () => {
    const request = createRequest({ command: '选品美国市场服装类目' });
    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.params.category).toBe('clothing');
    expect(data.params.market).toBe('US');
  });
});
