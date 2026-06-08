import type { Config } from 'tailwindcss'

/**
 * SetRecord Tailwind config.
 *
 * Tokens are defined in src/styles/tokens.css as CSS custom properties.
 * This config maps them to Tailwind utilities so we can use
 * `bg-surface-1`, `text-accent`, `font-mono`, etc., while the CSS
 * variables remain the canonical source of truth.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          alt: 'var(--accent-alt)',
          'dim-12': 'var(--accent-dim-12)',
          'dim-30': 'var(--accent-dim-30)'
        },
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)'
        },
        border: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          emphasis: 'var(--border-emphasis)'
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
          'on-accent': 'var(--text-on-accent)'
        },
        semantic: {
          success: 'var(--semantic-success)',
          warning: 'var(--semantic-warning)',
          danger: 'var(--semantic-danger)',
          info: 'var(--semantic-info)'
        },
        aurora: {
          teal: 'var(--aurora-teal)',
          indigo: 'var(--aurora-indigo)',
          magenta: 'var(--aurora-magenta)',
          black: 'var(--aurora-black)'
        }
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)'
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)'
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        12: 'var(--space-12)',
        16: 'var(--space-16)'
      },
      transitionTimingFunction: {
        expo: 'var(--ease-expo)',
        entry: 'var(--ease-entry)'
      },
      transitionDuration: {
        hover: '150ms',
        state: '220ms',
        panel: '320ms',
        reveal: '500ms'
      }
    }
  },
  plugins: []
}

export default config
