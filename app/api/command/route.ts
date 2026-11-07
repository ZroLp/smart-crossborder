import { NextRequest, NextResponse } from 'next/server';
import { NLCommandParser } from '@/lib/framework/nl-parser';
import { requireUser } from '@/lib/auth/guards';

const parser = new NLCommandParser();

export async function POST(request: NextRequest) {
  try {
    const auth = requireUser(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { command } = body as { command: string };

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid command' },
        { status: 400 }
      );
    }

    const parsed = await parser.parse(command);

    if (!parsed) {
      return NextResponse.json(
        { success: false, error: '无法识别指令意图' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      agentType: parsed.agentType,
      params: parsed.params,
      confidence: parsed.confidence,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
