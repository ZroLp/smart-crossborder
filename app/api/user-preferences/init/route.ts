import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';

export async function POST(request: NextRequest) {
  try {
    let body: { userId?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      // body 可省略，身份以会话为准
    }

    const auth = requireUser(request, body.userId);
    if (auth.response) return auth.response;

    const db = getDb();
    const existing = db
      .prepare('SELECT id FROM user_preferences WHERE user_id = ?')
      .get(auth.user.id);

    if (existing) {
      return NextResponse.json({ success: true, created: false });
    }

    db.prepare(
      'INSERT INTO user_preferences (user_id, locale, timezone, currency) VALUES (?, ?, ?, ?)'
    ).run(auth.user.id, 'zh', 'Asia/Shanghai', 'CNY');

    return NextResponse.json({ success: true, created: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
