/**
 * SetSense logo — chartreuse-gradient square with an L-shaped cue glyph
 * (drawn via ::after) plus the "SetSense" wordmark.
 */
export function Logo(): React.JSX.Element {
  return (
    <span className="logo">
      <span className="logo-mark" aria-hidden="true" />
      <span className="logo-text">SetSense</span>
    </span>
  )
}
