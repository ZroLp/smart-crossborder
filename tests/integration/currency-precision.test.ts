import { convertCurrency, formatCurrency, EXCHANGE_RATES, CURRENCY_SYMBOLS } from '@/lib/i18n/currency';

describe('Currency Precision', () => {
  test('convertCurrency(100, USD, EUR) = 92', () => {
    const result = convertCurrency(100, 'USD', 'EUR');
    expect(result).toBeCloseTo(92, 2);
  });

  test('convertCurrency(100, USD, CNY) = 724', () => {
    const result = convertCurrency(100, 'USD', 'CNY');
    expect(result).toBeCloseTo(724, 2);
  });

  test('convertCurrency(100, EUR, GBP) ≈ 85.87', () => {
    const result = convertCurrency(100, 'EUR', 'GBP');
    const expected = (100 / 0.92) * 0.79;
    expect(result).toBeCloseTo(expected, 2);
  });

  test('convertCurrency(100, GBP, USD) ≈ 126.58', () => {
    const result = convertCurrency(100, 'GBP', 'USD');
    const expected = (100 / 0.79) * 1;
    expect(result).toBeCloseTo(expected, 2);
  });

  test('convertCurrency same currency returns original amount', () => {
    expect(convertCurrency(100, 'USD', 'USD')).toBeCloseTo(100, 2);
    expect(convertCurrency(50, 'EUR', 'EUR')).toBeCloseTo(50, 2);
  });

  test('convertCurrency handles zero amount', () => {
    expect(convertCurrency(0, 'USD', 'EUR')).toBeCloseTo(0, 2);
  });

  test('formatCurrency(100, USD) contains $', () => {
    const result = formatCurrency(100, 'USD');
    expect(result).toContain('$');
  });

  test('formatCurrency(100, EUR) contains €', () => {
    const result = formatCurrency(100, 'EUR');
    expect(result).toContain('€');
  });

  test('formatCurrency(100, GBP) contains £', () => {
    const result = formatCurrency(100, 'GBP');
    expect(result).toContain('£');
  });

  test('formatCurrency(100, CNY) contains ¥', () => {
    const result = formatCurrency(100, 'CNY');
    expect(result).toContain('¥');
  });

  test('no floating point errors in conversion chain', () => {
    const usdToEur = convertCurrency(100, 'USD', 'EUR');
    const eurToGbp = convertCurrency(usdToEur, 'EUR', 'GBP');
    const usdToGbp = convertCurrency(100, 'USD', 'GBP');
    expect(eurToGbp).toBeCloseTo(usdToGbp, 2);
  });

  test('no floating point errors with decimal amounts', () => {
    const result = convertCurrency(19.99, 'USD', 'EUR');
    const expected = 19.99 * 0.92;
    expect(result).toBeCloseTo(expected, 2);
  });

  test('EXCHANGE_RATES has correct values', () => {
    expect(EXCHANGE_RATES.USD).toBe(1);
    expect(EXCHANGE_RATES.EUR).toBe(0.92);
    expect(EXCHANGE_RATES.GBP).toBe(0.79);
    expect(EXCHANGE_RATES.CNY).toBe(7.24);
  });

  test('CURRENCY_SYMBOLS has correct symbols', () => {
    expect(CURRENCY_SYMBOLS.USD).toBe('$');
    expect(CURRENCY_SYMBOLS.EUR).toBe('€');
    expect(CURRENCY_SYMBOLS.GBP).toBe('£');
    expect(CURRENCY_SYMBOLS.CNY).toBe('¥');
  });

  test('round-trip conversion is accurate', () => {
    const original = 100;
    const toEur = convertCurrency(original, 'USD', 'EUR');
    const backToUsd = convertCurrency(toEur, 'EUR', 'USD');
    expect(backToUsd).toBeCloseTo(original, 2);
  });

  test('formatCurrency produces different symbols for different currencies', () => {
    const usd = formatCurrency(100, 'USD');
    const eur = formatCurrency(100, 'EUR');
    expect(usd).not.toBe(eur);
  });

  test('conversion chain: USD → EUR → GBP → CNY → USD', () => {
    const usd = 100;
    const eur = convertCurrency(usd, 'USD', 'EUR');
    const gbp = convertCurrency(eur, 'EUR', 'GBP');
    const cny = convertCurrency(gbp, 'GBP', 'CNY');
    const backToUsd = convertCurrency(cny, 'CNY', 'USD');
    expect(backToUsd).toBeCloseTo(usd, 2);
  });
});
