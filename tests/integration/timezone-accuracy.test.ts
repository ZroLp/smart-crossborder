import { convertToTimezone, formatDate, getTimezoneOffset } from '@/lib/i18n/timezone';

describe('Timezone Accuracy', () => {
  describe('convertToTimezone', () => {
    test('converts a known UTC date to Asia/Shanghai', () => {
      const utcDate = new Date('2024-01-01T00:00:00.000Z');
      const shanghaiDate = convertToTimezone(utcDate, 'Asia/Shanghai');
      const hours = shanghaiDate.getUTCHours();
      expect(hours).toBe(8);
    });

    test('converts a known UTC date to America/New_York', () => {
      const utcDate = new Date('2024-01-01T00:00:00.000Z');
      const nyDate = convertToTimezone(utcDate, 'America/New_York');
      const hours = nyDate.getUTCHours();
      expect(hours).toBeGreaterThanOrEqual(18);
      expect(hours).toBeLessThanOrEqual(20);
    });

    test('converts a known UTC date to Europe/London', () => {
      const utcDate = new Date('2024-01-01T00:00:00.000Z');
      const londonDate = convertToTimezone(utcDate, 'Europe/London');
      const hours = londonDate.getUTCHours();
      expect(hours).toBe(0);
    });

    test('converts string date correctly', () => {
      const shanghaiDate = convertToTimezone('2024-06-15T12:00:00.000Z', 'Asia/Shanghai');
      const hours = shanghaiDate.getUTCHours();
      expect(hours).toBe(20);
    });
  });

  describe('getTimezoneOffset', () => {
    test('Asia/Shanghai returns -8 hours (UTC+8)', () => {
      const offset = getTimezoneOffset('Asia/Shanghai');
      expect(offset).toBeCloseTo(-8, 1);
    });

    test('America/New_York returns approximately 4 (UTC-4 DST) or 5 (UTC-5 standard)', () => {
      const offset = getTimezoneOffset('America/New_York');
      const isStandard = Math.abs(offset - 5) < 0.5;
      const isDST = Math.abs(offset - 4) < 0.5;
      expect(isStandard || isDST).toBe(true);
    });

    test('Europe/London returns 0 or -1 (DST)', () => {
      const offset = getTimezoneOffset('Europe/London');
      const isStandard = Math.abs(offset - 0) < 0.5;
      const isDST = Math.abs(offset - (-1)) < 0.5;
      expect(isStandard || isDST).toBe(true);
    });

    test('Asia/Bangkok returns -7 hours (UTC+7)', () => {
      const offset = getTimezoneOffset('Asia/Bangkok');
      expect(offset).toBeCloseTo(-7, 1);
    });

    test('America/Los_Angeles returns approximately 7 (UTC-7 DST) or 8 (UTC-8 standard)', () => {
      const offset = getTimezoneOffset('America/Los_Angeles');
      const isStandard = Math.abs(offset - 8) < 0.5;
      const isDST = Math.abs(offset - 7) < 0.5;
      expect(isStandard || isDST).toBe(true);
    });

    test('Asia/Tokyo returns -9 hours (UTC+9)', () => {
      const offset = getTimezoneOffset('Asia/Tokyo');
      expect(offset).toBeCloseTo(-9, 1);
    });
  });

  describe('formatDate', () => {
    test('formats date in zh-CN locale', () => {
      const utcDate = new Date('2024-01-15T12:00:00.000Z');
      const formatted = formatDate(utcDate, 'Asia/Shanghai', 'zh');
      expect(formatted).toContain('2024');
      expect(formatted).toContain('01');
      expect(formatted).toContain('15');
    });

    test('formats date in en-US locale', () => {
      const utcDate = new Date('2024-01-15T12:00:00.000Z');
      const formatted = formatDate(utcDate, 'America/New_York', 'en');
      expect(formatted).toContain('2024');
    });

    test('formats date in de-DE locale', () => {
      const utcDate = new Date('2024-06-20T12:00:00.000Z');
      const formatted = formatDate(utcDate, 'Europe/Berlin', 'de');
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    test('formats string date input', () => {
      const formatted = formatDate('2024-03-01T08:00:00.000Z', 'Asia/Shanghai', 'zh');
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });
});
