import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { AdCampaignRepository } from '@/lib/db/ad-campaign-repository';

// P5-04：POST 更新建议状态（adopt / reject）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const status =
      typeof body.status === 'string' && ['accepted', 'rejected'].includes(body.status)
        ? (body.status as 'accepted' | 'rejected')
        : null;

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'status must be "accepted" or "rejected"', code: 'VALIDATION' },
        { status: 400 }
      );
    }

    const suggestionId = Number(id);
    if (!Number.isFinite(suggestionId)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_ID', error: 'Invalid suggestion id' },
        { status: 400 }
      );
    }

    const db = getDb();
    const repo = new AdCampaignRepository(db);
    const updated = await repo.updateSuggestionStatus(auth.user.id, suggestionId, status);

    if (!updated) {
      return NextResponse.json(
        { success: false, code: 'SUGGESTION_NOT_FOUND', error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { id: updated.id, status: updated.status } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
