import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { AdCampaignRepository } from '@/lib/db/ad-campaign-repository';

const KNOWN_PLATFORMS = ['facebook', 'google', 'tiktok'] as const;

// P5-04：GET 查询平台连接状态（已知 3 家平台）
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const repo = new AdCampaignRepository(db);
    const connections = await repo.listPlatformConnections(auth.user.id);
    const map = new Map(connections.map((c) => [c.platform, c]));

    const data = KNOWN_PLATFORMS.map((platform) => {
      const conn = map.get(platform);
      return {
        platform,
        connected: conn?.status === 'connected',
        connectedAt: conn?.connected_at ?? null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// P5-04：POST 连接/断开平台（MVP：本地标记，无需真实 OAuth）
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
    const action =
      typeof body.action === 'string' && ['connect', 'disconnect'].includes(body.action)
        ? (body.action as 'connect' | 'disconnect')
        : 'connect';

    if (!KNOWN_PLATFORMS.includes(platform as (typeof KNOWN_PLATFORMS)[number])) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown platform "${platform}". Supported: ${KNOWN_PLATFORMS.join(', ')}`,
          code: 'VALIDATION',
        },
        { status: 400 }
      );
    }

    const status = action === 'connect' ? 'connected' : 'disconnected';
    const db = getDb();
    const repo = new AdCampaignRepository(db);
    const conn = await repo.upsertPlatformConnection(auth.user.id, platform, status);

    return NextResponse.json({
      success: true,
      data: {
        platform,
        connected: status === 'connected',
        connectedAt: conn.connected_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
