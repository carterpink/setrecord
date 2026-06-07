import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { AppLanguage, LanguagePreference } from '@/types'
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  detectOsLocales,
  isAppLanguage,
  resolveLanguage
} from './config'
import { DEFAULT_NAMESPACE, NAMESPACES, resources } from './resources'

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code)

// Initialise synchronously with the OS-detected language so the first paint is
// already localised. The persisted preference (which may differ) is applied a
// moment later from AppShell once settings have been read over IPC.
void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage('system', detectOsLocales()),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_CODES,
  ns: NAMESPACES as unknown as string[],
  defaultNS: DEFAULT_NAMESPACE,
  interpolation: {
    // React already escapes rendered values, so i18next must not double-escape.
    escapeValue: false
  },
  returnNull: false
})

/**
 * Apply a persisted preference (from AppSettings). `'system'` resolves against
 * the live OS locale; an explicit language is applied verbatim. Safe to call
 * repeatedly — i18next no-ops if the language is unchanged.
 */
export function applyLanguagePreference(preference: LanguagePreference): void {
  const next = resolveLanguage(preference, detectOsLocales())
  if (i18n.language !== next) void i18n.changeLanguage(next)
}

/** The concrete language i18next is currently rendering in. */
export function currentLanguage(): AppLanguage {
  return isAppLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE
}

export default i18n
