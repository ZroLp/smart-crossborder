import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';

/**
 * P7-04 跨境数据区域化选项：POST 选择数据驻留区域（白名单 CN/EU/US，否则 400）。
 */
const RESIDENCY_REGIONS = ['CN', 'EU', 'US'] as const;
type ResidencyRegion = (typeof RESIDENCY_REGIONS)[number];

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let body: { region?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { region } = body;
  if (typeof region !== 'string' || !(RESIDENCY_REGIONS as readonly string[]).includes(region)) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REGION', error: `region must be one of: ${RESIDENCY_REGIONS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    await getDb()
      .prepare('UPDATE users SET data_residency = ? WHERE id = ?')
      .run(region as ResidencyRegion, auth.user.id);
    return NextResponse.json({ success: true, data: { data_residency: region } });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
