import { LocaleContext, LocaleProvider, useLocale } from '@/lib/i18n/locale-context';

describe('locale-context exports', () => {
  test('LocaleContext is defined', () => {
    expect(LocaleContext).toBeDefined();
  });

  test('LocaleProvider is defined', () => {
    expect(LocaleProvider).toBeDefined();
  });

  test('useLocale is defined', () => {
    expect(useLocale).toBeDefined();
  });
});

describe('locale-context default values', () => {
  test('LocaleContext default locale is zh', () => {
    const ctx = LocaleContext as any;
    expect(ctx._currentValue?.locale || ctx.defaultValue?.locale).toBe('zh');
  });

  test('LocaleContext default timezone is Asia/Shanghai', () => {
    const ctx = LocaleContext as any;
    expect(ctx._currentValue?.timezone || ctx.defaultValue?.timezone).toBe('Asia/Shanghai');
  });

  test('LocaleContext default currency is USD', () => {
    const ctx = LocaleContext as any;
    expect(ctx._currentValue?.currency || ctx.defaultValue?.currency).toBe('USD');
  });

  test('LocaleContext default userId is null', () => {
    const ctx = LocaleContext as any;
    const val = ctx._currentValue || ctx.defaultValue;
    expect(val.userId).toBeNull();
  });

  test('LocaleContext default loading is true', () => {
    const ctx = LocaleContext as any;
    expect(ctx._currentValue?.loading ?? ctx.defaultValue?.loading).toBe(true);
  });

  test('LocaleContext default setters are no-op functions', () => {
    const ctx = LocaleContext as any;
    const val = ctx._currentValue || ctx.defaultValue;
    expect(typeof val.setLocale).toBe('function');
    expect(typeof val.setTimezone).toBe('function');
    expect(typeof val.setCurrency).toBe('function');
  });
});

describe('locale-context value structure', () => {
  test('context value has all required keys', () => {
    const ctx = LocaleContext as any;
    const val = ctx._currentValue || ctx.defaultValue;
    const keys = Object.keys(val).sort();
    expect(keys).toEqual([
      'currency',
      'loading',
      'locale',
      'setCurrency',
      'setLocale',
      'setTimezone',
      'timezone',
      'userId',
    ]);
  });
});
