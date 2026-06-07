import type { AppLanguage, LanguagePreference } from '@/types'

/** The default/source language. Every other locale is a translation of this. */
export const DEFAULT_LANGUAGE: AppLanguage = 'en'

/**
 * Languages that ship with a translation bundle, in the order they appear in the
 * settings picker. `nativeName` is shown to the user (always in its own
 * language, the localisation convention) and never translated.
 */
export const SUPPORTED_LANGUAGES: ReadonlyArray<{ code: AppLanguage; nativeName: string }> = [
  { code: 'en', nativeName: 'English' },
  { code: 'es', nativeName: 'Español' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)' }
]

const SUPPORTED_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code))

/** Type guard: is this string one of our shipped languages? */
export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value != null && SUPPORTED_CODES.has(value)
}

/**
 * Map an OS/BCP-47 locale tag (e.g. `de-DE`, `pt-PT`, `en-GB`) onto the closest
 * shipped language. Tries the full tag first, then the base subtag, with a
 * couple of regional special-cases. Returns null when nothing matches, so the
 * caller can fall back to {@link DEFAULT_LANGUAGE}.
 */
export function matchSupportedLanguage(locale: string | null | undefined): AppLanguage | null {
  if (!locale) return null
  const tag = locale.toLowerCase()

  // Exact shipped tag (covers pt-BR).
  const exact = SUPPORTED_LANGUAGES.find((l) => l.code.toLowerCase() === tag)
  if (exact) return exact.code

  const base = tag.split('-')[0]

  // Any Portuguese variant maps to our Brazilian bundle (the only pt we ship).
  if (base === 'pt') return 'pt-BR'

  const baseMatch = SUPPORTED_LANGUAGES.find((l) => l.code.toLowerCase().split('-')[0] === base)
  return baseMatch ? baseMatch.code : null
}

/**
 * Resolve the language to actually render, given the persisted preference and
 * the detected OS locale(s). `'system'` (or anything unknown) defers to the OS
 * locale; an explicit preference always wins.
 */
export function resolveLanguage(
  preference: LanguagePreference | null | undefined,
  osLocales: readonly string[]
): AppLanguage {
  if (isAppLanguage(preference)) return preference
  for (const locale of osLocales) {
    const matched = matchSupportedLanguage(locale)
    if (matched) return matched
  }
  return DEFAULT_LANGUAGE
}

/**
 * Best-effort read of the OS locale chain from the renderer. In Electron the
 * Chromium renderer's `navigator.language(s)` reflects `app.getLocale()`, so no
 * extra IPC is needed for first-paint detection.
 */
export function detectOsLocales(): string[] {
  if (typeof navigator === 'undefined') return []
  const list = Array.isArray(navigator.languages) ? [...navigator.languages] : []
  if (navigator.language) list.push(navigator.language)
  return list
}
