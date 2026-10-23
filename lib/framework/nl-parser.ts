import { AgentType } from './types';
import { callOpenAIJSON, isOpenAIAvailable } from '@/lib/ai/openai-client';
import { PROMPTS } from '@/lib/ai/prompts';

export interface ParsedCommand {
  agentType: AgentType;
  params: Record<string, unknown>;
  confidence: number;
}

export interface CommandTemplate {
  keywords: string[];
  agentType: AgentType;
  defaultParams: Record<string, unknown>;
}

const CATEGORY_KEYWORDS: Record<string, string> = {
  '服装': 'clothing',
  '电子产品': 'electronics',
  '家居': 'home',
  '美妆': 'beauty',
};

const MARKET_KEYWORDS: Record<string, string> = {
  '美国': 'US',
  '欧洲': 'EU',
  '东南亚': 'SEA',
  '北美': 'NA',
  '拉美': 'LATAM',
};

const LANGUAGE_KEYWORDS: Record<string, string> = {
  '英文': 'en',
  '西班牙语': 'es',
  '法语': 'fr',
  '德语': 'de',
};

const VALID_AGENT_TYPES: AgentType[] = ['selection', 'store-builder', 'content', 'ad-optimizer', 'customer-service', 'fulfillment'];

export class NLCommandParser {
  private templates: CommandTemplate[];

  constructor() {
    this.templates = [
      {
        keywords: ['选品', '爆款', '推荐', '推荐商品', 'product', 'trending', 'hot item'],
        agentType: 'selection',
        defaultParams: { action: 'analyze' },
      },
      {
        keywords: ['建站', '店铺', '模板', 'store', 'shop', 'template', 'website'],
        agentType: 'store-builder',
        defaultParams: { action: 'build' },
      },
      {
        keywords: ['文案', '素材', '生成', '翻译', 'content', 'copy', 'translate', 'generate'],
        agentType: 'content',
        defaultParams: { action: 'generate' },
      },
      {
        keywords: ['投流', '广告', '投放', '优化', 'ad', 'campaign', 'optimize', 'roas'],
        agentType: 'ad-optimizer',
        defaultParams: { action: 'optimize' },
      },
      {
        keywords: ['客服', '回复', '咨询', 'customer', 'support', 'reply', 'chat'],
        agentType: 'customer-service',
        defaultParams: { action: 'reply' },
      },
      {
        keywords: ['发货', '物流', '履约', '报关', 'fulfillment', 'shipping', 'logistics', 'customs'],
        agentType: 'fulfillment',
        defaultParams: { action: 'process' },
      },
    ];
  }

  async parse(input: string): Promise<ParsedCommand | null> {
    if (!input || !input.trim()) {
      return null;
    }

    if (isOpenAIAvailable()) {
      try {
        const result = await callOpenAIJSON({
          systemPrompt: PROMPTS.nlpParser.system,
          userPrompt: input,
        });

        if (result && typeof result === 'object' && 'agentType' in result && 'params' in result && 'confidence' in result) {
          const r = result as { agentType: string; params: Record<string, unknown>; confidence: number };
          if (VALID_AGENT_TYPES.includes(r.agentType as AgentType)) {
            return {
              agentType: r.agentType as AgentType,
              params: { ...this.extractParams(input), ...r.params },
              confidence: r.confidence ?? 0,
            };
          }
        }
      } catch {
        // Fall back to keyword matching
      }
    }

    const normalizedInput = input.toLowerCase().trim();
    let bestMatch: ParsedCommand | null = null;
    let bestScore = 0;

    for (const template of this.templates) {
      let matchCount = 0;
      for (const keyword of template.keywords) {
        if (normalizedInput.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const confidence = matchCount / template.keywords.length;
        if (confidence > bestScore) {
          bestScore = confidence;
          const params = { ...template.defaultParams, ...this.extractParams(input) };
          bestMatch = {
            agentType: template.agentType,
            params,
            confidence,
          };
        }
      }
    }

    return bestMatch;
  }

  extractParams(input: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    for (const [keyword, value] of Object.entries(CATEGORY_KEYWORDS)) {
      if (input.includes(keyword)) {
        params.category = value;
        break;
      }
    }

    for (const [keyword, value] of Object.entries(MARKET_KEYWORDS)) {
      if (input.includes(keyword)) {
        params.market = value;
        break;
      }
    }

    for (const [keyword, value] of Object.entries(LANGUAGE_KEYWORDS)) {
      if (input.includes(keyword)) {
        params.language = value;
        break;
      }
    }

    return params;
  }

  getTemplates(): CommandTemplate[] {
    return this.templates;
  }
}
