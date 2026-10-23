export type AgentType = 'selection' | 'store-builder' | 'content' | 'ad-optimizer' | 'customer-service' | 'fulfillment';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentTask {
  id: number;
  agentType: AgentType;
  taskName: string;
  status: TaskStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  nextAgent?: AgentType;
  nextAgentInput?: Record<string, unknown>;
  ai_provider?: 'openai' | 'fallback';
  response_time_ms?: number;
  status?: 'success' | 'partial' | 'failed';
}

export interface AgentConfig {
  name: string;
  type: AgentType;
  description: string;
}

export type MessageHandler = (event: string, data: unknown) => void;
