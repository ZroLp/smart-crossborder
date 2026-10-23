import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { TaskLogRepository } from '@/lib/db/task-log-repository';

function formatTaskId(task: { id: number; created_at?: string }): string {
  const datePart = task.created_at?.slice(0, 10).replace(/-/g, '') || '00000000';
  return `TSK-${datePart}${String(task.id).padStart(2, '0')}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const db = getDb();
    const taskLogRepo = new TaskLogRepository(db);

    let task: any = null;

    const numericId = Number(taskId);
    if (!isNaN(numericId)) {
      task = taskLogRepo.findById(numericId);
    }

    if (!task) {
      const allTasks = taskLogRepo.findAll(1000, 0);
      task = allTasks.find((t: any) => formatTaskId(t) === taskId);
    }

    if (!task) {
      return NextResponse.json(
        { success: false, error: '任务不存在' },
        { status: 404 }
      );
    }

    const formattedTask = {
      id: formatTaskId(task),
      db_id: task.id,
      agent_module: task.agent_type,
      task_name: task.task_name,
      status: task.status,
      input: task.input,
      output: task.output,
      error: task.error,
      created_at: task.created_at,
      updated_at: task.updated_at,
    };

    return NextResponse.json({ success: true, task: formattedTask });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
