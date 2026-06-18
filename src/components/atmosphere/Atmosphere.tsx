/* ============================================================
   Atmosphere — now just the canvas: a flat near-black backdrop + the global
   film-grain that rides on TOP of all content. The neon is no longer here — it
   lives in per-section <GrainBloom>s, so the page reads as discrete glows on
   black rather than one ambient wash (which is what made it feel like the app).
   ============================================================ */
export default function Atmosphere(): React.JSX.Element {
  return (
    <>
      <div className="atmos" aria-hidden />
      <div className="filmgrain" aria-hidden />
    </>
  )
}
