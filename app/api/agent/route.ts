import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator, VALID_AGENT_TYPES } from '@/lib/api/agent-service';
import { AgentType } from '@/lib/framework/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentType, input, chain } = body as {
      agentType: AgentType;
      input: Record<string, unknown>;
      chain?: boolean;
    };

    if (!agentType || !input) {
      return NextResponse.json(
        { success: false, error: 'Missing agentType or input' },
        { status: 400 }
      );
    }

    if (!VALID_AGENT_TYPES.includes(agentType)) {
      return NextResponse.json(
        { success: false, error: `Invalid agentType: ${agentType}` },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();

    if (chain) {
      const results = await orchestrator.executeChain(agentType, input);
      return NextResponse.json({ success: true, data: results });
    }

    const result = await orchestrator.executeTask(agentType, input);
    return NextResponse.json({ success: result.success, data: result.data, error: result.error });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
