import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { UserRepository } from '@/lib/db/user-repository';
import { requireAdmin } from '@/lib/auth/guards';
import { getClientIp } from '@/lib/auth/device';
import { fetchUserSnapshot, recordAudit } from '@/lib/admin/audit';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;
    const body = await request.json();
    const { userId, role } = body as { userId: number; role: string };

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or role' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'operator', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    const db = getDb();
    const userRepo = new UserRepository(db);
    const before = await fetchUserSnapshot(db, userId);
    await userRepo.updateRole(userId, role);
    // P8-02: 写操作审计（角色变更前/后快照）
    const after = await fetchUserSnapshot(db, userId);
    await recordAudit(db, {
      actorId: auth.user.id,
      action: 'user.role_changed',
      resource: 'user',
      resourceId: String(userId),
      before,
      after,
      ip: getClientIp(request),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
