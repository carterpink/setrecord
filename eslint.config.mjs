import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y'

export default defineConfig(
  // .claude holds local Claude Code skill helpers (run-desktop driver/test
  // scripts); scripts/ holds dev-only build tooling (icon generation, license
  // minting); presentation/ holds the standalone case-study deck generator
  // (its own node_modules + package.json) — all non-product, excluded from
  // packaging and not part of the app.
  { ignores: ['**/node_modules', '**/dist', '**/out', '.claude/**', 'scripts/**', 'presentation/**'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  // NFR-603 accessibility regression gate — static WCAG checks on every product
  // component in the renderer `src/` tree (main-process + scripts excluded above).
  //
  // Strategy for layering onto an existing codebase: the deterministic
  // ARIA-correctness rules (invalid props/roles, missing required props, alt
  // text) are hard ERRORS — the code already passes them, so they form a clean
  // baseline that can never silently regress. The heuristic interaction rules
  // produce false positives against dnd-kit `{...attributes}` spreads and
  // stopPropagation wrappers (a role/handler the static analyser can't see), so
  // they stay WARN — a visible punch-list without blocking CI. Tightening the
  // warns to errors after a dedicated sweep is the tracked follow-up.
  {
    files: ['src/**/*.{ts,tsx}'],
    ...eslintPluginJsxA11y.flatConfigs.recommended,
    rules: {
      ...eslintPluginJsxA11y.flatConfigs.recommended.rules,
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/interactive-supports-focus': 'warn',
      // Legacy label-association punch-list — surfaced as warnings pending a sweep.
      'jsx-a11y/label-has-associated-control': 'warn',
      // Audio/preview elements carry no spoken content; captions are N/A here.
      'jsx-a11y/media-has-caption': 'off',
      // Moving focus into a freshly-opened modal field is an intentional,
      // accessible pattern in this app.
      'jsx-a11y/no-autofocus': 'off'
    }
  },
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    // Honor the project's `_`-prefix convention for intentional throwaways
    // (unused args, rest-sibling omissions) rather than forcing renames.
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ]
    }
  },
  {
    // The shared config disables explicit-function-return-type for Node scripts,
    // but its `*.mjs`/`*.js` glob only matches root-level files. Extend that
    // intent to nested scripts (e.g. scripts/*.mjs).
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  eslintConfigPrettier
)
