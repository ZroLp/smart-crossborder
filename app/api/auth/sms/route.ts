import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { getClientIp } from '@/lib/auth/device';
import { issueCaptcha, sendSmsCode, verifySmsCode } from '@/lib/sms/sms-service';

/**
 * P6-02: SMS verification (dual provider + anti-bombing + captcha).
 * GET  → issue an arithmetic captcha challenge
 * POST {action:'send', phone, captchaId, answer} → send a 6-digit code
 * POST {action:'verify', phone, code} → verify the code
 */
// Next 14 的路由类型校验要求首参必须是 Request | NextRequest（不可为可选），否则 next build 报 ParamCheck 错误。
export async function GET(_request: NextRequest) {
  const challenge = await issueCaptcha(getDb());
  return NextResponse.json({ success: true, ...challenge });
}

export async function POST(request: NextRequest) {
  let body: { action?: unknown; phone?: unknown; captchaId?: unknown; answer?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const db = getDb();

  if (body.action === 'send') {
    const { phone, captchaId, answer } = body;
    if (typeof phone !== 'string' || typeof captchaId !== 'string' || typeof answer !== 'string') {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing phone, captchaId, or answer' },
        { status: 400 }
      );
    }

    const result = await sendSmsCode(db, {
      phone,
      ip: getClientIp(request),
      captchaId,
      answer: answer.trim(),
    });

    if (!result.ok) {
      const codes: Record<string, string> = {
        'captcha': 'CAPTCHA_INVALID',
        'validation': 'INVALID_INPUT',
        'phone-cooldown': 'SMS_RATE_LIMITED',
        'phone-daily': 'SMS_RATE_LIMITED',
        'ip-hourly': 'SMS_RATE_LIMITED',
      };
      const isClientError = result.reason === 'captcha' || result.reason === 'validation';
      return NextResponse.json(
        { success: false, code: codes[result.reason ?? ''] ?? 'INVALID_INPUT', error: `reason=${result.reason}` },
        { status: isClientError ? 400 : 429 }
      );
    }

    return NextResponse.json({ success: true, delivery: result.delivery, ...(result.devCode ? { devCode: result.devCode } : {}) });
  }

  if (body.action === 'verify') {
    const { phone, code } = body;
    if (typeof phone !== 'string' || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing phone or code' },
        { status: 400 }
      );
    }

    const outcome = await verifySmsCode(db, phone.trim(), code.trim());
    if (outcome === 'not-found') {
      return NextResponse.json(
        { success: false, code: 'NO_CODE', error: 'No pending code for this phone' },
        { status: 400 }
      );
    }
    if (outcome === 'invalid') {
      return NextResponse.json(
        { success: false, code: 'INVALID_CODE', error: 'Incorrect code' },
        { status: 400 }
      );
    }
    if (outcome === 'expired') {
      return NextResponse.json(
        { success: false, code: 'CODE_EXPIRED', error: 'Code expired' },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, verified: true });
  }

  return NextResponse.json(
    { success: false, code: 'INVALID_INPUT', error: 'Missing or invalid action' },
    { status: 400 }
  );
}
