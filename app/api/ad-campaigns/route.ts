import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { AdCampaignRow, AdSuggestionRow, mapCampaign, mapSuggestion } from '@/lib/api/ad-mappers';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const campaigns = (
      (await db
        .prepare('SELECT * FROM ad_campaigns WHERE user_id = ? ORDER BY id')
        .all(auth.user.id)) as AdCampaignRow[]
    ).map(mapCampaign);

    const suggestions = (
      (await db
        .prepare('SELECT * FROM ad_suggestions WHERE user_id = ? ORDER BY id')
        .all(auth.user.id)) as AdSuggestionRow[]
    ).map(mapSuggestion);

    return NextResponse.json({ success: true, data: { campaigns, suggestions } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
