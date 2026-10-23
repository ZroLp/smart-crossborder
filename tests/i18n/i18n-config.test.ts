import {
  Locale,
  CurrencyCode,
  I18nConfig,
  TranslationDict,
  LOCALES,
  CURRENCIES,
  DEFAULT_TIMEZONES,
  getI18nConfig,
} from '@/lib/i18n';

describe('i18n utilities', () => {
  test('LOCALES contains all 5 supported languages', () => {
    expect(LOCALES).toHaveLength(5);
    expect(LOCALES).toContain('zh');
    expect(LOCALES).toContain('en');
    expect(LOCALES).toContain('es');
    expect(LOCALES).toContain('fr');
    expect(LOCALES).toContain('de');
  });

  test('CURRENCIES contains all 4 supported currencies', () => {
    expect(CURRENCIES).toHaveLength(4);
    expect(CURRENCIES).toContain('USD');
    expect(CURRENCIES).toContain('EUR');
    expect(CURRENCIES).toContain('GBP');
    expect(CURRENCIES).toContain('CNY');
  });

  test('DEFAULT_TIMEZONES contains 5 timezones', () => {
    expect(DEFAULT_TIMEZONES).toHaveLength(5);
  });

  describe('getI18nConfig', () => {
    test('returns zh config by default', () => {
      const config = getI18nConfig();
      expect(config.locale).toBe('zh');
      expect(config.timezone).toBe('Asia/Shanghai');
      expect(config.currency).toBe('CNY');
    });

    test('returns correct config for zh locale', () => {
      const config = getI18nConfig('zh');
      expect(config.locale).toBe('zh');
      expect(config.timezone).toBe('Asia/Shanghai');
      expect(config.currency).toBe('CNY');
    });

    test('returns correct config for en locale', () => {
      const config = getI18nConfig('en');
      expect(config.locale).toBe('en');
      expect(config.timezone).toBe('America/New_York');
      expect(config.currency).toBe('USD');
    });

    test('returns correct config for es locale', () => {
      const config = getI18nConfig('es');
      expect(config.locale).toBe('es');
      expect(config.timezone).toBe('Europe/Madrid');
      expect(config.currency).toBe('EUR');
    });

    test('returns correct config for fr locale', () => {
      const config = getI18nConfig('fr');
      expect(config.locale).toBe('fr');
      expect(config.timezone).toBe('Europe/Paris');
      expect(config.currency).toBe('EUR');
    });

    test('returns correct config for de locale', () => {
      const config = getI18nConfig('de');
      expect(config.locale).toBe('de');
      expect(config.timezone).toBe('Europe/Berlin');
      expect(config.currency).toBe('EUR');
    });

    test('uses default locale when undefined is passed', () => {
      const config = getI18nConfig(undefined);
      expect(config.locale).toBe('zh');
    });
  });
});
