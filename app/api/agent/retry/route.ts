import { NextRequest, NextResponse } from 'next/server';
import {
  InvalidTaskStateError,
  TaskNotFoundError,
  findOwnedTask,
  retryTask,
} from '@/lib/agents/task-service';
import { requireUser } from '@/lib/auth/guards';

export async function POST(request: NextRequest) {
  try {
    const auth = requireUser(request);
    if (auth.response) return auth.response;

    let body: { taskId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (body.taskId === undefined || body.taskId === null || body.taskId === '') {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing taskId' },
        { status: 400 }
      );
    }

    if (!findOwnedTask(String(body.taskId), auth.user.id)) {
      return NextResponse.json(
        { success: false, code: 'TASK_NOT_FOUND', error: 'Task not found' },
        { status: 404 }
      );
    }

    const task = await retryTask(String(body.taskId));
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
    if (error instanceof TaskNotFoundError) {
      return NextResponse.json(
        { success: false, code: 'TASK_NOT_FOUND', error: error.message },
        { status: 404 }
      );
    }
    if (error instanceof InvalidTaskStateError) {
      return NextResponse.json(
        { success: false, code: 'INVALID_STATE', error: error.message },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
