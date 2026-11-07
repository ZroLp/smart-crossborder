import { NextRequest, NextResponse } from 'next/server';
import { VALID_AGENT_TYPES } from '@/lib/api/agent-service';
import { AgentType } from '@/lib/framework/types';
import { runAgentTask } from '@/lib/agents/task-service';
import { AgentInputError, adaptAgentInput } from '@/lib/agents/input-adapter';
import { requireUser } from '@/lib/auth/guards';

export async function POST(request: NextRequest) {
  try {
    let body: {
      agentType?: unknown;
      input?: unknown;
      chain?: unknown;
      userId?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 身份只取会话；body.userId / x-user-id 仅 AUTH_LEGACY_COMPAT=1 时兜底。
    const auth = requireUser(request, body.userId ?? request.headers.get('x-user-id'));
    if (auth.response) return auth.response;

    if (
      body.userId !== undefined &&
      body.userId !== null &&
      String(body.userId) !== String(auth.user.id)
    ) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', error: 'Cannot run tasks for another user' },
        { status: 403 }
      );
    }

    const { agentType, input, chain } = body;

    if (!agentType || !input || typeof input !== 'object') {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing agentType or input' },
        { status: 400 }
      );
    }

    if (!VALID_AGENT_TYPES.includes(agentType as AgentType)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: `Invalid agentType: ${agentType}` },
        { status: 400 }
      );
    }

    // 页面真实载荷 → Agent 原生入参；空商品/订单库返回 400，不伪造数据。
    let adaptedInput: Record<string, unknown>;
    try {
      adaptedInput = adaptAgentInput(
        agentType as AgentType,
        input as Record<string, unknown>,
        auth.user.id
      ).input;
    } catch (error) {
      if (error instanceof AgentInputError) {
        return NextResponse.json(
          {
            success: false,
            code: error.code,
            error: error.message,
            hint: error.hint,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const task = await runAgentTask({
      agentType: agentType as AgentType,
      input: adaptedInput,
      userId: auth.user.id,
      chain: Boolean(chain),
    });

    const success = task.status === 'completed';

    return NextResponse.json({
      success,
      data: {
        taskId: task.taskId,
        displayId: task.displayId,
        agentType: task.agentType,
        status: task.status,
        result: task.result,
      },
      error: success ? undefined : task.error ?? `Task ${task.status}`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
