import { NextRequest, NextResponse } from 'next/server';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hostFrom(request: NextRequest): string {
  const host = request.headers.get('host');
  if (host) return host;
  return new URL(request.url).host;
}

/**
 * P9-03: 纯函数判定请求是否跨站（应被 403 拒绝），与 middleware 原有行为一致。
 * host 解析：优先 Host 头，缺省时用 hostHint（middleware 里为 URL 的 host）。
 * 无法确定可信 host 时按跨站处理（保守拒绝）。
 */
export function isCrossSiteRequest(
  headers: { get(name: string): string | null },
  hostHint?: string | null
): boolean {
  const host = headers.get('host') || hostHint || null;
  if (!host) return true;

  // 明确的跨站来源特征直接拒绝。
  if (headers.get('sec-fetch-site') === 'cross-site') return true;

  const origin = headers.get('origin');
  if (origin) {
    try {
      // 允许 http/https 同源；仅比较 host，忽略端口差异由部署反代统一。
      if (new URL(origin).host === host) return false;
      return true;
    } catch {
      return true;
    }
  }

  const referer = headers.get('referer');
  if (referer) {
    try {
      if (new URL(referer).host === host) return false;
      return true;
    } catch {
      return true;
    }
  }

  return false;
}

export function middleware(request: NextRequest) {
  if (WRITE_METHODS.has(request.method) && isCrossSiteRequest(request.headers, hostFrom(request))) {
    return NextResponse.json(
      { success: false, code: 'FORBIDDEN', error: 'Cross-site request rejected' },
      { status: 403 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)).*)'],
};
