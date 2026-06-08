/**
 * FilmGrain.tsx — a static SVG-noise overlay laid over the graph canvas.
 *
 * Pure decoration: gives the pure-black field the stippled "State of Sites"
 * grain that's now the company visual signature. pointer-events: none so it
 * never intercepts canvas interaction.
 */

// feTurbulence noise baked into a data URI — no network, no animation cost.
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export function FilmGrain(): React.JSX.Element {
  return <div className="graph-grain" aria-hidden style={{ backgroundImage: NOISE }} />
}
