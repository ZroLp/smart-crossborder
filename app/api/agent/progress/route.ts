import { NextRequest, NextResponse } from 'next/server';
import { findOwnedTask, getTaskProgress } from '@/lib/agents/task-service';
import { requireUser } from '@/lib/auth/guards';

export async function GET(request: NextRequest) {
  try {
    const auth = requireUser(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing taskId' },
        { status: 400 }
      );
    }

    // 跨用户访问统一 404。
    if (!findOwnedTask(taskId, auth.user.id)) {
      return NextResponse.json(
        { success: false, code: 'TASK_NOT_FOUND', error: 'Progress not found' },
        { status: 404 }
      );
    }

    const progress = getTaskProgress(taskId);
    if (!progress) {
      return NextResponse.json(
        { success: false, code: 'TASK_NOT_FOUND', error: 'Progress not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: progress.taskId,
        displayId: progress.displayId,
        agentType: progress.agentType,
        taskStatus: progress.taskStatus,
        status: progress.status,
        steps: progress.steps,
        createdAt: progress.createdAt,
        updatedAt: progress.updatedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
