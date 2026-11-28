import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';

interface PreferencesRow {
  id: number;
  user_id: number;
  locale: string;
  timezone: string;
  currency: string;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const prefs = (await db
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .get(auth.user.id)) as PreferencesRow | undefined;

    if (!prefs) {
      return NextResponse.json(
        { success: false, code: 'PREFERENCES_NOT_FOUND', error: 'Preferences not found' },
        { status: 404 }
      );
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
    let body: {
      locale?: unknown;
      timezone?: unknown;
      currency?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 身份只取会话，不接受请求体中的 userId。
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { locale, timezone, currency } = body;
    const db = getDb();
    const existing = (await db
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .get(auth.user.id)) as PreferencesRow | undefined;

    if (!existing) {
      await db.prepare(
        'INSERT INTO user_preferences (user_id, locale, timezone, currency) VALUES (?, ?, ?, ?)'
      ).run(
        auth.user.id,
        typeof locale === 'string' ? locale : 'zh',
        typeof timezone === 'string' ? timezone : 'Asia/Shanghai',
        typeof currency === 'string' ? currency : 'CNY'
      );
    } else {
      const updates: string[] = [];
      const values: (string | number)[] = [];
      if (typeof locale === 'string') { updates.push('locale = ?'); values.push(locale); }
      if (typeof timezone === 'string') { updates.push('timezone = ?'); values.push(timezone); }
      if (typeof currency === 'string') { updates.push('currency = ?'); values.push(currency); }
      if (updates.length > 0) {
        updates.push('updated_at = now()');
        values.push(auth.user.id);
        await db.prepare(`UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
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
