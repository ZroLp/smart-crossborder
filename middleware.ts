import { NextRequest, NextResponse } from 'next/server';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hostFrom(request: NextRequest): string {
  const host = request.headers.get('host');
  if (host) return host;
  return new URL(request.url).host;
}

function originMatches(request: NextRequest): boolean {
  const host = hostFrom(request);

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      // 允许 http/https 同源；仅比较 host，忽略端口差异由部署反代统一。
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }

  const referrer = request.headers.get('referer');
  if (referrer && !origin) {
    try {
      if (new URL(referrer).host !== host) return false;
    } catch {
      return false;
    }
  }

  // 明确的跨站来源特征直接拒绝。
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') return false;

  return true;
}

export function middleware(request: NextRequest) {
  if (WRITE_METHODS.has(request.method) && !originMatches(request)) {
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
