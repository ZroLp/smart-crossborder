import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { quoteTax, validateTaxQuoteInput } from '@/lib/tax/tax-service';

/** P6-05: tax quote for a cross-border order amount (`GET /api/tax/quote?amount=7980&country=DE`). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const amountCents = searchParams.get('amount');
  const country = searchParams.get('country');
  const state = searchParams.get('state') ?? undefined;

  if (!amountCents || !country) {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'amount and country are required' },
      { status: 400 }
    );
  }

  const input = { amountCents: Number(amountCents), country, state };
  const validationError = validateTaxQuoteInput(input);
  if (validationError) {
    return NextResponse.json({ success: false, code: 'INVALID_INPUT', error: validationError }, { status: 400 });
  }

  try {
    const quote = await quoteTax(getDb(), input);
    return NextResponse.json({ success: true, data: quote });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: error instanceof Error ? error.message : 'Quote failed' },
      { status: 400 }
    );
  }
}
