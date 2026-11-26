import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { AdCampaignRow, AdSuggestionRow, mapCampaign, mapSuggestion } from '@/lib/api/ad-mappers';
import { AdCampaignRepository } from '@/lib/db/ad-campaign-repository';

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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const platform = typeof body.platform === 'string' ? body.platform.trim() : '';
    const budget = typeof body.budget === 'number' && Number.isFinite(body.budget) ? body.budget : 0;

    if (!name || !platform) {
      return NextResponse.json(
        { success: false, error: 'name and platform are required', code: 'VALIDATION' },
        { status: 400 }
      );
    }

    const db = getDb();
    const repo = new AdCampaignRepository(db);
    const externalId =
      typeof body.external_id === 'string' && body.external_id.trim()
        ? body.external_id.trim()
        : `camp-${platform.slice(0, 3)}-${Date.now()}`;

    const campaign = await repo.create(auth.user.id, {
      external_id: externalId,
      name,
      platform,
      status: typeof body.status === 'string' ? (body.status as string) : 'active',
      budget,
      audience_json: body.audience ? JSON.stringify(body.audience) : null,
      creatives_json: body.creatives ? JSON.stringify(body.creatives) : null,
    });

    return NextResponse.json(
      { success: true, data: mapCampaign(campaign as unknown as AdCampaignRow) },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
