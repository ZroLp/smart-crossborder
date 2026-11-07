import { NextRequest, NextResponse } from 'next/server';
import { findTask, formatDisplayId, getTaskProgress } from '@/lib/agents/task-service';
import { requireUser } from '@/lib/auth/guards';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireUser(request, request.nextUrl.searchParams.get('userId'));
    if (auth.response) return auth.response;

    const taskId = params.id;
    const task = findTask(taskId);

    // 跨用户访问统一返回 404，避免泄露资源存在性。
    if (!task || task.user_id !== auth.user.id) {
      return NextResponse.json(
        { success: false, code: 'TASK_NOT_FOUND', error: '任务不存在' },
        { status: 404 }
      );
    }

    const progress = getTaskProgress(String(task.id));
    const displayId = formatDisplayId(task);

    const formattedTask = {
      id: displayId,
      task_id: String(task.id),
      display_id: displayId,
      db_id: task.id,
      agent_module: task.agent_type,
      task_name: task.task_name,
      status: task.status,
      user_id: task.user_id ?? null,
      input: task.input,
      output: task.output,
      error: task.error,
      created_at: task.created_at,
      updated_at: task.updated_at,
      steps: progress?.steps ?? [],
    };

    return NextResponse.json({ success: true, task: formattedTask });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
