import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { AdCampaignRepository } from '@/lib/db/ad-campaign-repository';

// P5-04：同步到平台（模拟调用外部广告 API；平台未连接时返回 409）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const db = getDb();
    const repo = new AdCampaignRepository(db);

    const campaign = await repo.findByIdOrExternalId(auth.user.id, id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const connected = await repo.isPlatformConnected(auth.user.id, campaign.platform);
    if (!connected) {
      return NextResponse.json(
        {
          success: false,
          code: 'PLATFORM_NOT_CONNECTED',
          error: `Ad platform "${campaign.platform}" is not connected. Connect the platform first.`,
        },
        { status: 409 }
      );
    }

    // MVP：模拟同步成功，返回服务端时间戳
    return NextResponse.json({
      success: true,
      data: { syncedAt: new Date().toISOString() },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
