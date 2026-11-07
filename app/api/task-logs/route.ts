import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { formatDisplayId } from '@/lib/agents/task-service';
import { requireUser } from '@/lib/auth/guards';

export async function GET(request: NextRequest) {
  try {
    // 身份只取会话；query userId 仅在 AUTH_LEGACY_COMPAT=1 时兜底。
    const auth = requireUser(request, request.nextUrl.searchParams.get('userId'));
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const agentType = searchParams.get('agentType');
    const status = searchParams.get('status');

    const repo = new TaskLogRepository(getDb());
    let rows = repo.findByUserId(auth.user.id, 1000, 0);

    if (agentType) rows = rows.filter((row) => row.agent_type === agentType);
    if (status) rows = rows.filter((row) => row.status === status);

    rows.sort((a, b) => b.id - a.id);
    const total = rows.length;
    const offset = (page - 1) * limit;
    const pageRows = rows.slice(offset, offset + limit);

    const data = pageRows.map((row) => ({
      taskId: String(row.id),
      displayId: formatDisplayId(row),
      agentType: row.agent_type,
      taskName: row.task_name,
      status: row.status,
      userId: row.user_id ?? null,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data,
      tasks: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
