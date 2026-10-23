import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
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
