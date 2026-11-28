import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';

/**
 * P7-07 Do Not Sell/Share（CCPA/CPRA + 加州隐私法）。
 * GET  /api/privacy/dnss → { doNotSell, jurisdiction }
 * POST /api/privacy/dnss  { doNotSell: boolean } 写入 users.do_not_sell。
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const row = (await getDb()
      .prepare('SELECT do_not_sell FROM users WHERE id = ?')
      .get(auth.user.id)) as { do_not_sell: boolean } | undefined;
    return NextResponse.json({
      success: true,
      data: { doNotSell: Boolean(row?.do_not_sell), jurisdiction: 'CA/US' },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let body: { doNotSell?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { doNotSell } = body;
  if (typeof doNotSell !== 'boolean') {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'doNotSell must be a boolean' },
      { status: 400 }
    );
  }

  try {
    await getDb()
      .prepare('UPDATE users SET do_not_sell = ? WHERE id = ?')
      .run(doNotSell, auth.user.id);
    return NextResponse.json({ success: true, data: { doNotSell, jurisdiction: 'CA/US' } });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
