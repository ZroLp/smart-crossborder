import zh from '@/lib/i18n/locales/zh';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';
import fr from '@/lib/i18n/locales/fr';
import de from '@/lib/i18n/locales/de';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[part];
  }, obj);
}

describe('I18n Compliance: 5-Language Completeness', () => {
  const referenceKeys = flattenKeys(zh as Record<string, unknown>);
  const locales = { en, es, fr, de };

  test('Chinese (zh) has all expected top-level sections', () => {
    expect(zh.nav).toBeDefined();
    expect(zh.common).toBeDefined();
    expect(zh.status).toBeDefined();
    expect(zh.agents).toBeDefined();
    expect(zh.compliance).toBeDefined();
    expect(zh.settings).toBeDefined();
  });

  test('all locales have same keys as reference (zh)', () => {
    for (const [localeName, localeData] of Object.entries(locales)) {
      for (const key of referenceKeys) {
        const value = getNestedValue(localeData as Record<string, unknown>, key);
        expect(value).toBeDefined();
      }
    }
  });

  test('no locale has missing keys', () => {
    for (const [localeName, localeData] of Object.entries(locales)) {
      for (const key of referenceKeys) {
        const value = getNestedValue(localeData as Record<string, unknown>, key);
        expect(value).not.toBeUndefined();
      }
    }
  });

  test('no value is empty string', () => {
    for (const [localeName, localeData] of Object.entries(locales)) {
      for (const key of referenceKeys) {
        const value = getNestedValue(localeData as Record<string, unknown>, key);
        expect(typeof value).toBe('string');
        expect(value).not.toBe('');
      }
    }
  });

  test('no value equals its own key (untranslated placeholder check)', () => {
    for (const [localeName, localeData] of Object.entries(locales)) {
      for (const key of referenceKeys) {
        const value = getNestedValue(localeData as Record<string, unknown>, key);
        expect(value).not.toBe(key);
      }
    }
  });

  test('Chinese reference values are not empty', () => {
    for (const key of referenceKeys) {
      const value = getNestedValue(zh as Record<string, unknown>, key);
      expect(typeof value).toBe('string');
      expect(value).not.toBe('');
      expect(value).not.toBe(key);
    }
  });

  test('English has distinct translations from Chinese', () => {
    for (const key of referenceKeys) {
      const zhValue = getNestedValue(zh as Record<string, unknown>, key) as string;
      const enValue = getNestedValue(en as Record<string, unknown>, key) as string;
      expect(enValue).not.toBe(zhValue);
    }
  });

  test('each locale has correct number of leaf keys', () => {
    const zhKeyCount = referenceKeys.length;
    for (const [localeName, localeData] of Object.entries(locales)) {
      const localeKeyCount = flattenKeys(localeData as Record<string, unknown>).length;
      expect(localeKeyCount).toBe(zhKeyCount);
    }
  });

  test('nav section has all required keys in all locales', () => {
    const navKeys = flattenKeys(zh.nav as Record<string, unknown>);
    for (const [localeName, localeData] of Object.entries(locales)) {
      for (const key of navKeys) {
        const fullKey = `nav.${key}`;
        const value = getNestedValue(localeData as Record<string, unknown>, fullKey);
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
        expect(value).not.toBe('');
      }
    }
  });

  test('common section has all required keys in all locales', () => {
    const commonKeys = flattenKeys(zh.common as Record<string, unknown>);
    for (const [localeName, localeData] of Object.entries(locales)) {
      for (const key of commonKeys) {
        const fullKey = `common.${key}`;
        const value = getNestedValue(localeData as Record<string, unknown>, fullKey);
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
        expect(value).not.toBe('');
      }
    }
  });

  test('status section has exactly 6 keys in all locales', () => {
    const statusKeys = flattenKeys(zh.status as Record<string, unknown>);
    expect(statusKeys).toHaveLength(6);
    for (const [localeName, localeData] of Object.entries(locales)) {
      for (const key of statusKeys) {
        const fullKey = `status.${key}`;
        const value = getNestedValue(localeData as Record<string, unknown>, fullKey);
        expect(typeof value).toBe('string');
        expect(value).not.toBe('');
      }
    }
  });

  test('agents section translations are present', () => {
    const agentKeys = flattenKeys(zh.agents as Record<string, unknown>);
    for (const [localeName, localeData] of Object.entries(locales)) {
      for (const key of agentKeys) {
        const fullKey = `agents.${key}`;
        const value = getNestedValue(localeData as Record<string, unknown>, fullKey);
        expect(typeof value).toBe('string');
        expect(value).not.toBe('');
        expect(value).not.toBe(fullKey);
      }
    }
  });

  test('compliance section translations are present', () => {
    const complianceKeys = flattenKeys(zh.compliance as Record<string, unknown>);
    for (const [localeName, localeData] of Object.entries(locales)) {
      for (const key of complianceKeys) {
        const fullKey = `compliance.${key}`;
        const value = getNestedValue(localeData as Record<string, unknown>, fullKey);
        expect(typeof value).toBe('string');
        expect(value).not.toBe('');
        expect(value).not.toBe(fullKey);
      }
    }
  });

  test('settings section translations are present', () => {
    const settingsKeys = flattenKeys(zh.settings as Record<string, unknown>);
    for (const [localeName, localeData] of Object.entries(locales)) {
      for (const key of settingsKeys) {
        const fullKey = `settings.${key}`;
        const value = getNestedValue(localeData as Record<string, unknown>, fullKey);
        expect(typeof value).toBe('string');
        expect(value).not.toBe('');
        expect(value).not.toBe(fullKey);
      }
    }
  });
});
