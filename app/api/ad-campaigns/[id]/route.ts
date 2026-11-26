import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { AdCampaignRow, AdSuggestionRow, mapCampaign, mapSuggestion } from '@/lib/api/ad-mappers';
import { AdCampaignRepository, AdCampaign as RepoAdCampaign } from '@/lib/db/ad-campaign-repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const numericId = /^\d+$/.test(id) ? Number(id) : -1;
    const db = getDb();

    const campaign = (await db
      .prepare('SELECT * FROM ad_campaigns WHERE user_id = ? AND (id = ? OR external_id = ?)')
      .get(auth.user.id, numericId, id)) as AdCampaignRow | undefined;

    // 跨用户或不存在统一 404，避免泄露资源存在性。
    if (!campaign) {
      return NextResponse.json(
        { success: false, code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const suggestions = (
      (await db
        .prepare(
          'SELECT * FROM ad_suggestions WHERE user_id = ? AND campaign_external_id = ? ORDER BY id'
        )
        .all(auth.user.id, campaign.external_id)) as AdSuggestionRow[]
    ).map(mapSuggestion);

    return NextResponse.json({
      success: true,
      data: { campaign: mapCampaign(campaign), suggestions },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// P5-04：PATCH 支持编辑 + 启停（status 切换）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const db = getDb();
    const repo = new AdCampaignRepository(db);

    const campaign = await repo.update(auth.user.id, id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      platform: typeof body.platform === 'string' ? body.platform : undefined,
      status:
        typeof body.status === 'string' &&
        ['active', 'paused', 'ended'].includes(body.status)
          ? body.status
          : undefined,
      budget: typeof body.budget === 'number' ? body.budget : undefined,
      audience_json: body.audience !== undefined ? JSON.stringify(body.audience) : undefined,
      creatives_json: body.creatives !== undefined ? JSON.stringify(body.creatives) : undefined,
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mapCampaign(campaign as unknown as AdCampaignRow),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// P5-04：DELETE 删除广告计划
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const db = getDb();
    const repo = new AdCampaignRepository(db);

    const deleted = await repo.delete(auth.user.id, id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
