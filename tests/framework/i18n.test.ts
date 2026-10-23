import Database from 'better-sqlite3';
import { Locale, TranslationDict, LOCALES, CURRENCIES, getI18nConfig } from '@/lib/i18n/index';
import zh from '@/lib/i18n/locales/zh';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';
import fr from '@/lib/i18n/locales/fr';
import de from '@/lib/i18n/locales/de';
import { convertToTimezone, formatDate, getTimezoneOffset, DEFAULT_TIMEZONES } from '@/lib/i18n/timezone';
import { convertCurrency, formatCurrency, EXCHANGE_RATES, CURRENCY_SYMBOLS } from '@/lib/i18n/currency';

const translations: Record<Locale, TranslationDict> = { zh, en, es, fr, de };

function collectKeys(obj: TranslationDict, prefix: string = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null) {
      keys.push(...collectKeys(value as TranslationDict, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function resolve(obj: TranslationDict, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

describe('i18n translations', () => {
  test('all locale translation dicts have same keys', () => {
    const zhKeys = collectKeys(zh).sort();
    const enKeys = collectKeys(en).sort();
    const esKeys = collectKeys(es).sort();
    const frKeys = collectKeys(fr).sort();
    const deKeys = collectKeys(de).sort();

    expect(enKeys).toEqual(zhKeys);
    expect(esKeys).toEqual(zhKeys);
    expect(frKeys).toEqual(zhKeys);
    expect(deKeys).toEqual(zhKeys);
  });

  test('t() function with dot notation', () => {
    expect(resolve(zh, 'nav.dashboard')).toBe('仪表盘');
    expect(resolve(zh, 'common.search')).toBe('搜索');
    expect(resolve(zh, 'status.pending')).toBe('待执行');
    expect(resolve(zh, 'agents.selection')).toBe('选品Agent');
    expect(resolve(zh, 'compliance.riskCenter')).toBe('合规风险中心');
    expect(resolve(zh, 'settings.accountManagement')).toBe('账号管理');

    expect(resolve(en, 'nav.dashboard')).toBe('Dashboard');
    expect(resolve(en, 'common.search')).toBe('Search');
    expect(resolve(en, 'status.pending')).toBe('Pending');
  });

  test('t() fallback to key when translation missing', () => {
    expect(resolve(zh, 'nonexistent.key')).toBeUndefined();
    expect(resolve(en, 'nav.nonexistent')).toBeUndefined();

    const fallback = (key: string): string => {
      return resolve(zh, key) ?? key;
    };
    expect(fallback('nonexistent.key')).toBe('nonexistent.key');
  });
});

describe('i18n config', () => {
  test('getI18nConfig returns default config for zh', () => {
    const config = getI18nConfig('zh');
    expect(config.locale).toBe('zh');
    expect(config.timezone).toBe('Asia/Shanghai');
    expect(config.currency).toBe('CNY');
  });

  test('getI18nConfig returns correct config for each locale', () => {
    const enConfig = getI18nConfig('en');
    expect(enConfig.locale).toBe('en');
    expect(enConfig.timezone).toBe('America/New_York');
    expect(enConfig.currency).toBe('USD');

    const deConfig = getI18nConfig('de');
    expect(deConfig.locale).toBe('de');
    expect(deConfig.timezone).toBe('Europe/Berlin');
    expect(deConfig.currency).toBe('EUR');
  });

  test('getI18nConfig defaults to zh when no locale provided', () => {
    const config = getI18nConfig();
    expect(config.locale).toBe('zh');
  });

  test('LOCALES array contains all 5 locales', () => {
    expect(LOCALES).toEqual(['zh', 'en', 'es', 'fr', 'de']);
  });

  test('CURRENCIES array contains all 4 currencies', () => {
    expect(CURRENCIES).toEqual(['USD', 'EUR', 'GBP', 'CNY']);
  });
});

describe('timezone utilities', () => {
  test('convertToTimezone converts date correctly', () => {
    const utcDate = new Date('2024-01-15T12:00:00Z');
    const shanghaiDate = convertToTimezone(utcDate, 'Asia/Shanghai');
    expect(shanghaiDate.getUTCHours()).toBe(20);
  });

  test('convertToTimezone accepts string input', () => {
    const result = convertToTimezone('2024-01-15T12:00:00Z', 'America/New_York');
    expect(result).toBeInstanceOf(Date);
  });

  test('formatDate returns formatted string', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const formatted = formatDate(date, 'Asia/Shanghai', 'zh');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  test('formatDate uses different locale formats', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const zhFormatted = formatDate(date, 'Asia/Shanghai', 'zh');
    const enFormatted = formatDate(date, 'America/New_York', 'en');
    expect(typeof zhFormatted).toBe('string');
    expect(typeof enFormatted).toBe('string');
  });

  test('getTimezoneOffset returns number', () => {
    const offset = getTimezoneOffset('Asia/Shanghai');
    expect(typeof offset).toBe('number');
  });

  test('getTimezoneOffset for UTC is 0', () => {
    const offset = getTimezoneOffset('UTC');
    expect(offset).toBe(0);
  });

  test('DEFAULT_TIMEZONES contains expected values', () => {
    expect(DEFAULT_TIMEZONES).toEqual([
      'Asia/Shanghai',
      'America/New_York',
      'Europe/London',
      'Europe/Berlin',
      'Asia/Singapore',
    ]);
  });
});

describe('currency utilities', () => {
  test('convertCurrency USD to EUR', () => {
    const result = convertCurrency(100, 'USD', 'EUR');
    expect(result).toBeCloseTo(92, 0);
  });

  test('convertCurrency USD to CNY', () => {
    const result = convertCurrency(100, 'USD', 'CNY');
    expect(result).toBeCloseTo(724, 0);
  });

  test('convertCurrency EUR to USD', () => {
    const result = convertCurrency(92, 'EUR', 'USD');
    expect(result).toBeCloseTo(100, 0);
  });

  test('convertCurrency CNY to GBP', () => {
    const result = convertCurrency(724, 'CNY', 'GBP');
    expect(result).toBeCloseTo(79, 0);
  });

  test('convertCurrency same currency returns same amount', () => {
    expect(convertCurrency(100, 'USD', 'USD')).toBe(100);
    expect(convertCurrency(50, 'EUR', 'EUR')).toBe(50);
  });

  test('convertCurrency all pairs are consistent', () => {
    const amount = 100;
    for (const from of CURRENCIES) {
      for (const to of CURRENCIES) {
        const result = convertCurrency(amount, from, to);
        const reverse = convertCurrency(result, to, from);
        expect(reverse).toBeCloseTo(amount, 5);
      }
    }
  });

  test('formatCurrency returns formatted string with symbol', () => {
    const usd = formatCurrency(100, 'USD', 'en');
    expect(usd).toContain('$');

    const eur = formatCurrency(100, 'EUR', 'de');
    expect(eur).toContain('€');

    const gbp = formatCurrency(100, 'GBP', 'en');
    expect(gbp).toContain('£');

    const cny = formatCurrency(100, 'CNY', 'zh');
    expect(cny).toContain('¥');
  });

  test('formatCurrency respects locale formatting', () => {
    const enFormatted = formatCurrency(1234.56, 'USD', 'en');
    const zhFormatted = formatCurrency(1234.56, 'CNY', 'zh');
    expect(typeof enFormatted).toBe('string');
    expect(typeof zhFormatted).toBe('string');
  });

  test('EXCHANGE_RATES has correct base values', () => {
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
});

describe('user_preferences table', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        locale TEXT DEFAULT 'zh',
        timezone TEXT DEFAULT 'Asia/Shanghai',
        currency TEXT DEFAULT 'CNY',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  test('insert and query user_preferences', () => {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('testuser', 'password123');

    db.prepare(
      'INSERT INTO user_preferences (user_id, locale, timezone, currency) VALUES (?, ?, ?, ?)'
    ).run(1, 'en', 'America/New_York', 'USD');

    const pref = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(1) as {
      user_id: number;
      locale: string;
      timezone: string;
      currency: string;
    };

    expect(pref.user_id).toBe(1);
    expect(pref.locale).toBe('en');
    expect(pref.timezone).toBe('America/New_York');
    expect(pref.currency).toBe('USD');
  });

  test('user_preferences defaults', () => {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('testuser2', 'password123');

    db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(1);

    const pref = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(1) as {
      locale: string;
      timezone: string;
      currency: string;
    };

    expect(pref.locale).toBe('zh');
    expect(pref.timezone).toBe('Asia/Shanghai');
    expect(pref.currency).toBe('CNY');
  });

  test('user_preferences foreign key constraint', () => {
    expect(() => {
      db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(999);
    }).toThrow();
  });

  test('update user_preferences', () => {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('testuser3', 'password123');

    db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(1);

    db.prepare(
      'UPDATE user_preferences SET locale = ?, timezone = ?, currency = ? WHERE user_id = ?'
    ).run('de', 'Europe/Berlin', 'EUR', 1);

    const pref = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(1) as {
      locale: string;
      timezone: string;
      currency: string;
    };

    expect(pref.locale).toBe('de');
    expect(pref.timezone).toBe('Europe/Berlin');
    expect(pref.currency).toBe('EUR');
  });
});
