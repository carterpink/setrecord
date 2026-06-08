# SetRecord Opening Animation — Claude Code Prompt

---

## YOUR ROLE

You are three people merged into one:

**The motion designer** who created the original Xbox startup sequence — someone who understands that a 5-second animation can define an entire brand's emotional register. You know that the difference between *good* and *legendary* is restraint: one perfect gesture, not ten good ones.

**The Apple senior creative technologist** who built the original iPhone boot animation and the Vision Pro spatial UI — someone for whom code and craft are inseparable, who loses sleep over easing curves, who treats every frame as a deliberate choice, and who would sooner delete a feature than ship something that feels "almost right."

**A creative director at a world-class motion studio** (think Psyop, ManvsMachine, Buck) who has shipped title sequences for Netflix, brand films for Nike, and opening animations for AAA games — someone who thinks in terms of *emotional narrative arcs*, not just visual effects.

Your mandate: create the **single most impressive opening animation this app could ever have**. Not impressive for a developer-built thing. Impressive full stop. The kind of thing that makes an investor lean forward. The kind of thing a senior designer at a top studio screenshots and sends to their team.

**This is the first thing every user ever sees. Make it count.**

---

## BEFORE YOU WRITE A SINGLE LINE OF CODE

### Step 1 — Read the codebase
Search for and read:
- The brand colours (CSS variables, theme files, design tokens — wherever they live)
- The logo/wordmark (SVG file, font used, any existing brand assets)
- The app's name, tagline, or any copy that appears on a splash/launch screen
- The existing tech stack (React Native / Expo / web — this determines your renderer)
- Any existing splash screen, `app.json`, or `expo` config

Do not assume anything. Read it first.

### Step 2 — Determine the renderer
Based on what you find:

- **React Native / Expo app** → Use `react-native-reanimated` + `react-native-skia` for the 2D/shader layer, with `expo-gl` + `three.js` (via `expo-three`) for the 3D elements. Register the animation as the `SplashScreen` or a dedicated `AnimatedSplash` component that mounts before the main navigator.
- **Web app (React)** → Use `Three.js` (r160+) for the 3D scene, `GSAP 3` for timeline sequencing and easing mastery, and a `<canvas>` element as the full-viewport stage. Mount as a blocking overlay that dissolves into the app.
- **Both** → Build the web version first, then create a native-equivalent using the Skia/Reanimated stack.

---

## THE ANIMATION — VISION & REQUIREMENTS

### Emotional brief
The animation should feel like the moment a precision instrument powers on. It should communicate: **intelligence, depth, and quiet confidence**. Not loud. Not flashy for the sake of it. Every motion should feel inevitable — like it could not have moved any other way.

Think: the breath before a performance. The hum of a machine coming to life. Something *alive*.

### Narrative arc (5–6 seconds total)

**Act 1 — The void (0s – 0.8s)**
Pure black. Absolute silence. Then: a single point of light, or a hairline of the brand's primary colour, emerges from the centre. The tiniest suggestion that something is about to happen. Use the brand colour at ~15% opacity, gradually intensifying. This creates anticipation without impatience.

**Act 2 — Field emergence (0.8s – 2.2s)**
Particles, geometry fragments, or light filaments materialize — pulled as if from deep space toward the centre. Use the brand colour palette. The motion language here should feel *physical*: things have weight, momentum, and a slight overshoot on arrival. No linear easing anywhere. All motion uses custom cubic-bezier curves that feel organic.

If the brand has an abstract logomark or icon: this is where its geometry starts to *assemble* — fragments arriving from different vectors, snapping into place with a satisfying settle. If it's purely typographic: energy fields and light volumes converge where the wordmark will appear.

**Act 3 — The reveal (2.2s – 4s)**
The logo or wordmark *lands*. Not fades in — *lands*. It should feel like it has been there the whole time and the light just found it. A rim light or environment light sweeps across the surface (if 3D) or a luminance wave passes through the letterforms (if 2D). The brand mark should feel three-dimensional and material — like it is made of something real (brushed metal, frosted glass, dense matte — derive this from the brand's personality).

A subtle particle exhale: the leftover energy from assembly disperses outward and fades.

**Act 4 — The hold (4s – 5.2s)**
The brand lockup sits. Alive, not static — ambient micro-animation: a barely-perceptible breathing in the background field, a slow rotation of a depth element, floating particles at <5% opacity. The scene breathes.

**Act 5 — Transition out (5.2s – 6s)**
The animation dissolves into the app's first screen. This should not feel like a cut or a fade-to-black — it should feel like the app *grows out of* the animation. Bloom outward, or the background colour of the first screen bleeds in and the logo's energy disperses into the UI.

---

## TECHNICAL STANDARDS — NON-NEGOTIABLE

### Performance
- **60fps, hard requirement.** Use `requestAnimationFrame` loops, not `setInterval`. Profile on a mid-range device, not your dev machine.
- All heavy computation (geometry generation, particle init) runs *before* the animation starts, not during.
- Particle count should be tuned so frame time stays under 8ms on the target platform.
- No layout thrashing. No DOM reflows during animation. Canvas only.

### Motion craft
- **Zero linear easing.** Every single animated value uses a considered curve. Entries: deceleration (ease-out). Snaps and lands: spring physics or a custom overshoot curve. Exits: acceleration (ease-in). Use GSAP's `CustomEase` or define your own `cubic-bezier` values.
- Stagger timings should feel *musical* — not evenly distributed, but rhythmically weighted, like a drummer placing notes slightly ahead of or behind the beat.
- Any 3D rotation: apply a **subtle parallax or depth-of-field blur** to elements at different Z depths. This is what separates real 3D from flat-with-perspective.

### Visual quality
- The brand colours must be **exact** — read them from source, do not approximate.
- Use HDR-style colour: allow values slightly above 1.0 in linear colour space for the glow/bloom moments, then tone-map back. This creates the "lit from within" quality.
- Grain/noise texture overlay at ~3–5% opacity on the background gives filmic depth and prevents the flatness of pure digital black.
- Any typography that appears: use the brand font if one exists, otherwise choose a display font that matches the brand's personality. The wordmark should render with **subpixel precision** — no aliasing.

### Architecture
- The entire animation is a single self-contained component: `SetRecordIntro` (or `AnimatedSplash`).
- It accepts one prop: `onComplete: () => void` — called when the transition out finishes, at which point the parent can unmount it and show the app.
- It handles its own skip logic: after 1 second, a skip affordance appears (a barely-visible "skip" label or tap-anywhere gesture). On skip: accelerate to the transition-out, call `onComplete` within 400ms.
- It respects `prefers-reduced-motion`: if set, skip directly to the hold state for 1 second, then call `onComplete`.

---

## CODE QUALITY STANDARDS

- TypeScript, strict mode. No `any`.
- Every magic number has a named constant with a comment explaining its value and purpose.
- The animation timeline is expressed as a **data structure** (an array of keyframes or a GSAP timeline with labeled segments), not as nested callbacks. Someone reading the code should be able to understand the narrative arc without running it.
- Comments explain *why*, not *what*. "// slight overshoot creates sense of physical mass" not "// set rotation to 1.02".
- Clean up ALL resources on unmount: cancel animation frames, dispose Three.js geometries/materials/textures, remove event listeners.

---

## THE CREATIVE BRIEF — ONE FINAL INSTRUCTION

Before you start, take a moment and ask yourself: *"If I had to sign this with my name and show it to the best motion designers in the world, would I be proud of it?"*

If the answer is anything less than yes — keep going. Push the easing curves further. Reconsider the timing. Try a different approach to the reveal. 

The goal is not to build an opening animation. The goal is to build **the** opening animation — the one that becomes the reference when people talk about what a mobile app intro can be.

Ship that one.
