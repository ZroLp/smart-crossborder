import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { AdCampaignRow, AdSuggestionRow, mapCampaign, mapSuggestion } from '@/lib/api/ad-mappers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = requireUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const numericId = /^\d+$/.test(id) ? Number(id) : -1;
    const db = getDb();

    const campaign = db
      .prepare('SELECT * FROM ad_campaigns WHERE user_id = ? AND (id = ? OR external_id = ?)')
      .get(auth.user.id, numericId, id) as AdCampaignRow | undefined;

    // 跨用户或不存在统一 404，避免泄露资源存在性。
    if (!campaign) {
      return NextResponse.json(
        { success: false, code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const suggestions = (
      db
        .prepare(
          'SELECT * FROM ad_suggestions WHERE user_id = ? AND campaign_external_id = ? ORDER BY id'
        )
        .all(auth.user.id, campaign.external_id) as AdSuggestionRow[]
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
