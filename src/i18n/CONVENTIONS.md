# i18n migration conventions (SetSense)

How to migrate a component's hardcoded UI strings to i18next. Follow EXACTLY — a
parity test (`tests/i18n.test.ts`) enforces key + interpolation consistency.

## Stack
`i18next` + `react-i18next`, already initialised in `src/i18n/`. Languages:
**en** (source of truth) + **es, de, fr, pt-BR**.

## Per-component steps
1. `import { useTranslation, Trans } from 'react-i18next'` (Trans only if a string
   has embedded markup — see below).
2. Inside the component: `const { t } = useTranslation('<ns>')` where `<ns>` is
   the namespace assigned for this area (e.g. `home`, `library`).
   - If you also need date/number formatting, grab `i18n`:
     `const { t, i18n } = useTranslation('<ns>')` and pass `i18n.language` as the
     `toLocaleDateString` / `Intl` locale.
3. Replace each user-facing string literal with `t('dot.key')`. Group keys
   logically by sub-feature, e.g. `t('emptyState.title')`.
   - This includes: visible text, `placeholder`, `title`, and `aria-label` /
     `aria-*` accessible strings, toast messages, and button labels.
   - DO NOT translate: `className`, CSS, `data-*`, test ids, `console.*` logs,
     enum/identifier values used in logic, or analytics event names.

## Interpolation
- `t('key', { count, name })` against `"... {{count}} ... {{name}}"`.
- The SAME `{{vars}}` must appear in all 5 languages (parity test checks this).

## Pluralization
Use i18next suffix keys: `key_one` / `key_other` and call `t('key', { count })`.
All 5 languages need both `_one` and `_other`.

## Embedded markup (`<Trans>`)
When a string wraps a styled element (e.g. a `<span className="ss-mono">`):
```tsx
<Trans t={t} i18nKey="some.key" components={[<span key="0" className="ss-mono" />]} />
```
and the value uses indexed tags: `"Save to a <0>.setsense</0> file"`.
Always give the component element a `key` prop.

## Brand / technical terms — NEVER translate
SetSense, Pro, Rekordbox, Serato, Engine DJ, Pioneer, CDJ/XDJ model names,
Set Architect, Recall, Camelot, Open Key, BPM, Mac, Beatport, MyTag, `.setsense`,
USB, XML, hot cue (keep "hot cue"/"cue" as-is), Camelot key codes (9A, etc.).

## Locale files
Create `src/locales/<lang>/<ns>.json` for ALL of: `en, es, de, fr, pt-BR`.
- `en` is authored from the original English strings.
- The other 4 are machine-drafted translations (high quality; native-sounding).
- Identical key structure across all 5 (parity test fails otherwise).
- Use the same curly/typographic quotes style as the existing `settings.json`
  files (e.g. `’` `“ ”` `—` `…`).

## Do NOT
- Do not edit `src/i18n/resources.ts` (namespaces are registered centrally).
- Do not edit files outside your assigned directory + your own locale JSONs.
- Do not change component logic, styling, or behavior — strings only.
- Do not touch `SettingsModal.tsx` (already migrated under the `settings` ns).

## Reference
See `src/locales/en/settings.json` + `src/components/modals/SettingsModal.tsx`
for a complete worked example (interpolation, plurals, `<Trans>`, aria labels).
