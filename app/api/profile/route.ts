import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { getSessionToken, hashSessionToken } from '@/lib/auth/session';

interface UserRow {
  id: number;
  username: string;
  email: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

interface PreferenceRow {
  locale: string;
  timezone: string;
  currency: string;
}

interface SessionRow {
  token_hash: string;
  created_at: string;
  expires_at: number;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const user = (await db
      .prepare('SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?')
      .get(auth.user.id)) as UserRow | undefined;

    if (!user) {
      return NextResponse.json(
        { success: false, code: 'USER_NOT_FOUND', error: 'User not found' },
        { status: 404 }
      );
    }

    const preferences =
      ((await db
        .prepare('SELECT locale, timezone, currency FROM user_preferences WHERE user_id = ?')
        .get(auth.user.id)) as PreferenceRow | undefined) ?? null;

    // 会话列表只含当前用户，且绝不返回 token_hash。
    const currentHash = hashSessionToken(getSessionToken(request) ?? '');
    const sessionRows = (await db
      .prepare('SELECT token_hash, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC, token_hash ASC')
      .all(auth.user.id)) as SessionRow[];

    const sessions = sessionRows.map((row, index) => {
      const current = row.token_hash === currentHash;
      return {
        id: index + 1,
        device: current ? '当前设备' : '未知',
        ip: '未知',
        current,
        createdAt: row.created_at,
        expiresAt: new Date(row.expires_at).toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: { user, preferences, sessions },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
