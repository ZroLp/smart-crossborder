import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { QuotaRepository } from '@/lib/db/quota-repository';
import { requireAdmin } from '@/lib/auth/guards';

/**
 * Admin: per-user AI-task quota usage + totals.
 * GET /api/admin/quota/usage
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    const repo = new QuotaRepository(getDb());
    const summary = await repo.usageSummary();

    return NextResponse.json({
      success: true,
      users: summary.users,
      totals: summary.totals,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
