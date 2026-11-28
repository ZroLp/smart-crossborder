import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';

// 该路由依赖请求上下文与数据库，禁止 Next 在 build 期静态预渲染。
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const apiKey = process.env.OPENAI_API_KEY;
  const modelName = process.env.OPENAI_MODEL || 'gpt-4o';

  return NextResponse.json({
    success: true,
    data: {
      apiKeyConfigured: !!apiKey,
      modelName,
      provider: 'openai',
    },
  });
}
