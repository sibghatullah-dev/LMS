import en from './en.json';

/**
 * Minimal i18n (FR-I18N-02: externalize all user-facing strings). The dictionary
 * lives in JSON so new languages are added without code changes; the language
 * *switcher* and additional locales are Phase 14. Launch language is English.
 */
const dictionaries = { en } as const;
export type Locale = keyof typeof dictionaries;

/** Resolve a dot-path key (e.g. "auth.login.title") from the active dictionary. */
export function t(key: string, locale: Locale = 'en'): string {
  const parts = key.split('.');
  let node: unknown = dictionaries[locale];
  for (const part of parts) {
    if (typeof node === 'object' && node !== null && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return key; // fall back to the key so a missing string is visible, not blank
    }
  }
  return typeof node === 'string' ? node : key;
}
