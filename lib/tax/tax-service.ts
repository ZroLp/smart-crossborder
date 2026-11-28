import type { DbClient } from '@/lib/db/client';

/**
 * P6-05: cross-border tax engine (VAT / OSS-style EU schemes / US sales tax /
 * JCT). Rates come from the `tax_rates` catalog; the quote is deterministic
 * and testable without a gateway.
 */

export type TaxRegime = 'VAT' | 'US_SALES_TAX' | 'JCT' | 'EXEMPT';

export interface TaxQuoteInput {
  /** Net order amount in cents. */
  amountCents: number;
  /** ISO-3166 alpha-2 shipping country. */
  country: string;
  /** US state code (required for US quotes). */
  state?: string;
}

export interface TaxQuote {
  country: string;
  state: string;
  regime: TaxRegime;
  /** Percent, e.g. 19.0 */
  ratePct: number;
  taxAmountCents: number;
  grossAmountCents: number;
  notes: string[];
}

interface TaxRateRow {
  state: string;
  regime: string;
  rate: string | number;
  note: string | null;
}

const DOMESTIC_COUNTRIES = new Set(['CN']);
const EU_COUNTRIES = new Set(['DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'BE', 'AT', 'IE', 'FI', 'PT', 'GR', 'SE', 'DK']);
/** EU intra-community distance-sale VAT threshold (EUR). */
const IOSS_THRESHOLD_CENTS = 150 * 100;

export function isKnownRegimeCountry(country: string): boolean {
  return DOMESTIC_COUNTRIES.has(country) || country === 'US' || country === 'JP' || EU_COUNTRIES.has(country) || country === 'GB';
}

export function validateTaxQuoteInput(input: TaxQuoteInput): string | null {
  if (!Number.isFinite(input.amountCents) || input.amountCents < 0) return 'amountCents must be a non-negative number';
  if (typeof input.country !== 'string' || !/^[A-Z]{2}$/i.test(input.country.trim())) return 'country must be an ISO-3166 alpha-2 code';
  if (input.state !== undefined && typeof input.state !== 'string') return 'state must be a string';
  return null;
}

export async function quoteTax(db: DbClient, input: TaxQuoteInput): Promise<TaxQuote> {
  const validationError = validateTaxQuoteInput(input);
  if (validationError) throw new Error(validationError);

  const country = input.country.trim().toUpperCase();
  const state = (input.state ?? '').trim().toUpperCase();
  const notes: string[] = [];

  if (DOMESTIC_COUNTRIES.has(country)) {
    return { country, state, regime: 'EXEMPT', ratePct: 0, taxAmountCents: 0, grossAmountCents: input.amountCents, notes: ['domestic orders carry no cross-border tax here'] };
  }

  const row = (await db
    .prepare('SELECT state, regime, rate, note FROM tax_rates WHERE country = ? AND state = ? LIMIT 1')
    .get(country, state)) as (TaxRateRow & { rate: string | number }) | undefined;

  let regime: TaxRegime;
  let ratePct: number;
  if (row) {
    regime = row.regime as TaxRegime;
    ratePct = Number(row.rate);
    if (row.note) notes.push(row.note);
  } else {
    regime = 'EXEMPT';
    ratePct = 0;
    notes.push('no configured rate; verify local obligations before selling here');
  }

  // EU scheme note: under the €150 IOSS threshold the seller collects VAT at
  // the destination rate; above it the order is imported (OSS/destination VAT).
  if (EU_COUNTRIES.has(country) && regime === 'VAT') {
    notes.push(
      input.amountCents <= IOSS_THRESHOLD_CENTS
        ? 'IOSS applies (≤ €150 intra-community distance sale)'
        : 'above €150 — OSS/destination import rules apply'
    );
  }
  if (country === 'US' && !state) {
    notes.push('US economic nexus: registration required once $100,000/yr or 200 transactions in a state');
  }

  const taxAmountCents = Math.round((input.amountCents * ratePct) / 100);
  return {
    country,
    state,
    regime,
    ratePct,
    taxAmountCents,
    grossAmountCents: input.amountCents + taxAmountCents,
    notes,
  };
}

export async function listTaxRates(db: DbClient): Promise<Array<TaxRateRow & { country: string; rate: string | number }>> {
  return (await db
    .prepare('SELECT country, state, regime, rate, note FROM tax_rates ORDER BY country, state')
    .all()) as Array<TaxRateRow & { country: string; rate: string | number }>;
}
