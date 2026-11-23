import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { ANALYTICS_EVENTS, AnalyticsRepository } from '@/lib/db/analytics-repository';

const MAX_SOURCE_LEN = 128;
const MAX_SESSION_LEN = 128;

/**
 * P5-02 客户端埋点上报（signup 等无法在服务端可靠捕获来源渠道的事件）。
 * 服务端事件（shop_connected / task_submitted / task_completed）由对应路由直接落库。
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    let body: {
      eventName?: unknown;
      properties?: unknown;
      source?: unknown;
      sessionId?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { eventName, properties, source, sessionId } = body;
    if (
      typeof eventName !== 'string' ||
      !(ANALYTICS_EVENTS as readonly string[]).includes(eventName)
    ) {
      return NextResponse.json(
        { success: false, code: 'INVALID_EVENT', error: `event must be one of: ${ANALYTICS_EVENTS.join(', ')}` },
        { status: 400 }
      );
    }

    let propertiesObj: Record<string, unknown> | undefined;
    if (properties !== undefined) {
      if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) {
        return NextResponse.json(
          { success: false, code: 'INVALID_INPUT', error: 'properties must be a plain object' },
          { status: 400 }
        );
      }
      propertiesObj = properties as Record<string, unknown>;
    }

    const sourceStr =
      typeof source === 'string' && source.length > 0 ? source.slice(0, MAX_SOURCE_LEN) : null;
    const sessionStr =
      typeof sessionId === 'string' && sessionId.length > 0 ? sessionId.slice(0, MAX_SESSION_LEN) : null;

    const db = getDb();
    await AnalyticsRepository.of(db).trackSafe(auth.user.id, eventName as (typeof ANALYTICS_EVENTS)[number], {
      properties: propertiesObj,
      source: sourceStr,
      sessionId: sessionStr,
    });

    return NextResponse.json({ success: true, ok: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
