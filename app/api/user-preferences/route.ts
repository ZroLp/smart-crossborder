import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userIdStr = searchParams.get('userId');
    if (!userIdStr) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }
    const userId = parseInt(userIdStr, 10);
    const db = getDb();
    const prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId) as
      | { id: number; user_id: number; locale: string; timezone: string; currency: string }
      | undefined;

    if (!prefs) {
      return NextResponse.json({ success: false, error: 'Preferences not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      preferences: {
        locale: prefs.locale,
        timezone: prefs.timezone,
        currency: prefs.currency,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, locale, timezone, currency } = body as {
      userId: string;
      locale?: string;
      timezone?: string;
      currency?: string;
    };

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(parseInt(userId, 10));

    if (!existing) {
      db.prepare(
        'INSERT INTO user_preferences (user_id, locale, timezone, currency) VALUES (?, ?, ?, ?)'
      ).run(
        parseInt(userId, 10),
        locale ?? 'zh',
        timezone ?? 'Asia/Shanghai',
        currency ?? 'CNY'
      );
    } else {
      const updates: string[] = [];
      const values: (string | number)[] = [];
      if (locale !== undefined) { updates.push('locale = ?'); values.push(locale); }
      if (timezone !== undefined) { updates.push('timezone = ?'); values.push(timezone); }
      if (currency !== undefined) { updates.push('currency = ?'); values.push(currency); }
      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        values.push(parseInt(userId, 10));
        db.prepare(`UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
