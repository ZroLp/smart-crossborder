import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';

interface ComplianceRow {
  id: number;
  kind: string;
  payload: string;
  created_at: string;
}

const GROUP_BY_KIND: Record<string, string> = {
  policy: 'policyUpdates',
  tax: 'taxReminders',
  check: 'complianceChecks',
  risk: 'riskItems',
  suggestion: 'suggestions',
};

const GROUP_KEYS = [
  'policyUpdates',
  'taxReminders',
  'complianceChecks',
  'riskItems',
  'suggestions',
] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = requireUser(request);
    if (auth.response) return auth.response;

    const data: Record<string, Array<Record<string, unknown>>> = {
      policyUpdates: [],
      taxReminders: [],
      complianceChecks: [],
      riskItems: [],
      suggestions: [],
    };

    const rows = getDb()
      .prepare(
        'SELECT id, kind, payload, created_at FROM compliance_items WHERE user_id = ? ORDER BY id'
      )
      .all(auth.user.id) as ComplianceRow[];

    for (const row of rows) {
      const groupKey = GROUP_BY_KIND[row.kind];
      if (!groupKey || !GROUP_KEYS.includes(groupKey as (typeof GROUP_KEYS)[number])) continue;

      let payload: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(row.payload);
        if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
      } catch {
        // ignore malformed payload, keep row identity only
      }

      data[groupKey].push({ id: row.id, ...payload, createdAt: row.created_at });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
