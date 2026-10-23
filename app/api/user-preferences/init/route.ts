import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(parseInt(userId, 10));

    if (existing) {
      return NextResponse.json({ success: true, created: false });
    }

    db.prepare(
      'INSERT INTO user_preferences (user_id, locale, timezone, currency) VALUES (?, ?, ?, ?)'
    ).run(parseInt(userId, 10), 'zh', 'Asia/Shanghai', 'CNY');

    return NextResponse.json({ success: true, created: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
