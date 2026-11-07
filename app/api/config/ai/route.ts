import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
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
