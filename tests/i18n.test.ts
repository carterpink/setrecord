import { describe, it, expect } from 'vitest'
import { resources, NAMESPACES } from '@/i18n/resources'
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  matchSupportedLanguage,
  resolveLanguage
} from '@/i18n/config'

/**
 * Localisation guardrails. The English bundle is the source of truth; every
 * shipped language must mirror its key set exactly and reuse the same
 * interpolation variables, so no string silently falls back or renders a raw
 * `{{placeholder}}`. Also pins the OS-locale → app-language resolution.
 */

type Json = string | { [k: string]: Json }

/** Flatten a nested namespace object to dot-joined leaf keys. */
function flattenKeys(obj: Json, prefix = ''): string[] {
  if (typeof obj === 'string') return [prefix]
  return Object.entries(obj).flatMap(([k, v]) => flattenKeys(v, prefix ? `${prefix}.${k}` : k))
}

/** All leaf values keyed by dot-path, for one language across all namespaces. */
function flattenValues(lang: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const ns of NAMESPACES) {
    const bundle = resources[lang]?.[ns] as Json
    const walk = (node: Json, prefix: string): void => {
      if (typeof node === 'string') {
        out[`${ns}.${prefix}`] = node
        return
      }
      for (const [k, v] of Object.entries(node)) walk(v, prefix ? `${prefix}.${k}` : k)
    }
    walk(bundle, '')
  }
  return out
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g

function placeholders(value: string): Set<string> {
  return new Set(Array.from(value.matchAll(PLACEHOLDER), (m) => m[1]))
}

const TRANSLATED_LANGUAGES = SUPPORTED_LANGUAGES.map((l) => l.code).filter(
  (c) => c !== DEFAULT_LANGUAGE
)

describe('locale bundles', () => {
  const enValues = flattenValues(DEFAULT_LANGUAGE)
  const enKeys = Object.keys(enValues).sort()

  it('ships a bundle for every supported language', () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      for (const ns of NAMESPACES) {
        expect(resources[code]?.[ns], `${code}/${ns} bundle missing`).toBeTruthy()
      }
    }
  })

  it.each(TRANSLATED_LANGUAGES)('%s has exactly the same keys as en', (lang) => {
    const langKeys = Object.keys(flattenValues(lang)).sort()
    const missing = enKeys.filter((k) => !langKeys.includes(k))
    const extra = langKeys.filter((k) => !enKeys.includes(k))
    expect({ missing, extra }).toEqual({ missing: [], extra: [] })
  })

  it.each(TRANSLATED_LANGUAGES)('%s reuses the same interpolation variables as en', (lang) => {
    const langValues = flattenValues(lang)
    const mismatches: string[] = []
    for (const key of enKeys) {
      const en = placeholders(enValues[key])
      const other = placeholders(langValues[key] ?? '')
      const same = en.size === other.size && [...en].every((p) => other.has(p))
      if (!same) mismatches.push(key)
    }
    expect(mismatches).toEqual([])
  })

  it('every en namespace key set matches the flattenKeys helper (no empty objects)', () => {
    for (const ns of NAMESPACES) {
      const keys = flattenKeys(resources[DEFAULT_LANGUAGE][ns] as Json)
      expect(keys.length).toBeGreaterThan(0)
      expect(keys.every((k) => k.length > 0)).toBe(true)
    }
  })
})

describe('language resolution', () => {
  it('maps OS locales onto the closest shipped language', () => {
    expect(matchSupportedLanguage('de-DE')).toBe('de')
    expect(matchSupportedLanguage('fr-CA')).toBe('fr')
    expect(matchSupportedLanguage('en-GB')).toBe('en')
    expect(matchSupportedLanguage('es-419')).toBe('es')
    expect(matchSupportedLanguage('pt-BR')).toBe('pt-BR')
    // Any Portuguese variant collapses to the only pt bundle we ship.
    expect(matchSupportedLanguage('pt-PT')).toBe('pt-BR')
    // Unsupported → null so the caller falls back to the default.
    expect(matchSupportedLanguage('ja-JP')).toBeNull()
    expect(matchSupportedLanguage('')).toBeNull()
  })

  it('prefers an explicit preference over the OS locale', () => {
    expect(resolveLanguage('fr', ['de-DE'])).toBe('fr')
    expect(resolveLanguage('pt-BR', [])).toBe('pt-BR')
  })

  it('follows the OS locale chain when preference is "system"', () => {
    expect(resolveLanguage('system', ['ja-JP', 'de-DE'])).toBe('de')
    expect(resolveLanguage('system', ['es-ES'])).toBe('es')
  })

  it('falls back to the default language when nothing matches', () => {
    expect(resolveLanguage('system', ['ja-JP', 'zh-CN'])).toBe(DEFAULT_LANGUAGE)
    expect(resolveLanguage(null, [])).toBe(DEFAULT_LANGUAGE)
  })
})
