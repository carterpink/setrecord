// The mark SVG is sourced from the same file the icon-generation script
// rasterizes into build/icon.icns — single source of truth. Vite ?raw inlines
// the string at build time; dangerouslySetInnerHTML is safe here because the
// content is a static asset we control.
import iconSource from '../../../resources/icon-source.svg?raw'

export function Logo(): React.JSX.Element {
  return (
    <span className="logo">
      <span
        className="logo-mark"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: iconSource }}
      />
      <span className="logo-text">
        <span className="logo-text-prefix">Set</span>
        <span className="logo-text-suffix">Sense</span>
      </span>
    </span>
  )
}
