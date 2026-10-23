import { convertCurrency, formatCurrency, EXCHANGE_RATES, CURRENCY_SYMBOLS } from '@/lib/i18n/currency';

describe('currency utils', () => {
  describe('EXCHANGE_RATES', () => {
    test('contains all 4 currency codes', () => {
      expect(Object.keys(EXCHANGE_RATES)).toEqual(['USD', 'EUR', 'GBP', 'CNY']);
    });

    test('USD is the base rate', () => {
      expect(EXCHANGE_RATES.USD).toBe(1);
    });
  });

  describe('CURRENCY_SYMBOLS', () => {
    test('USD symbol is $', () => { expect(CURRENCY_SYMBOLS.USD).toBe('$'); });
    test('EUR symbol is €', () => { expect(CURRENCY_SYMBOLS.EUR).toBe('€'); });
    test('GBP symbol is £', () => { expect(CURRENCY_SYMBOLS.GBP).toBe('£'); });
    test('CNY symbol is ¥', () => { expect(CURRENCY_SYMBOLS.CNY).toBe('¥'); });
  });

  describe('convertCurrency', () => {
    test('converts USD to CNY', () => {
      const result = convertCurrency(100, 'USD', 'CNY');
      expect(result).toBeCloseTo(724, 0);
    });

    test('converts CNY to USD', () => {
      const result = convertCurrency(724, 'CNY', 'USD');
      expect(result).toBeCloseTo(100, 0);
    });

    test('converts USD to EUR', () => {
      const result = convertCurrency(100, 'USD', 'EUR');
      expect(result).toBeCloseTo(92, 0);
    });

    test('converts EUR to USD', () => {
      const result = convertCurrency(92, 'EUR', 'USD');
      expect(result).toBeCloseTo(100, 0);
    });

    test('converts GBP to EUR', () => {
      const result = convertCurrency(100, 'GBP', 'EUR');
      expect(result).toBeCloseTo(116.46, 0);
    });

    test('same currency returns original amount', () => {
      expect(convertCurrency(100, 'USD', 'USD')).toBe(100);
      expect(convertCurrency(100, 'CNY', 'CNY')).toBe(100);
    });

    test('converts zero amount', () => {
      expect(convertCurrency(0, 'USD', 'CNY')).toBe(0);
    });

    test('handles decimal amounts', () => {
      const result = convertCurrency(9.99, 'USD', 'CNY');
      expect(result).toBeCloseTo(72.33, 1);
    });
  });

  describe('formatCurrency', () => {
    test('formats USD with zh-CN locale', () => {
      const result = formatCurrency(1000, 'USD', 'zh');
      expect(result).toContain('US$');
      expect(result).toContain('1,000.00');
    });

    test('formats CNY with zh-CN locale', () => {
      const result = formatCurrency(1000, 'CNY', 'zh');
      expect(result).toContain('¥');
      expect(result).toContain('1,000.00');
    });

    test('formats EUR with en-US locale', () => {
      const result = formatCurrency(1000, 'EUR', 'en');
      expect(result).toContain('€');
    });

    test('formats with default locale when none specified', () => {
      const result = formatCurrency(1000, 'CNY');
      expect(result).toContain('¥');
    });

    test('handles small amounts', () => {
      const result = formatCurrency(0.01, 'USD', 'en');
      expect(result).toContain('0.01');
    });
  });
});
