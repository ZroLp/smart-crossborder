import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';

// 该路由依赖请求上下文与数据库，禁止 Next 在 build 期静态预渲染。
export const dynamic = 'force-dynamic';

/**
 * P7-04 跨境传输机制目录（按目标区域）+ 该用户当前 data_residency。
 * 跨境传输可举证：每个区域给出对应的合法传输机制。
 */
const TRANSFER_MECHANISMS = {
  EU: {
    mechanism: 'SCC',
    detail:
      'SCC（EU 2021/914 第 9 条第 4 款附录 1，模块 1 控制方-处理方标准合同条款）',
  },
  US: {
    mechanism: 'DPF',
    detail: 'DPF 认证（EU-US 数据隐私框架 / EU-US Data Privacy Framework），备选 SCC',
  },
  CN: {
    mechanism: 'Standard Contract',
    detail: 'PIPL 第 38/39 条 + 标准合同（CAC 备案，国家网信部门）',
  },
} as const;

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const row = (await getDb()
      .prepare('SELECT data_residency FROM users WHERE id = ?')
      .get(auth.user.id)) as { data_residency: string | null } | undefined;

    return NextResponse.json({
      success: true,
      data: {
        regions: TRANSFER_MECHANISMS,
        data_residency: row?.data_residency ?? 'CN',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
