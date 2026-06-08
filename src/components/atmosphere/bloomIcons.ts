/* ============================================================
   bloomIcons — the stencils the light sweeps over. These are the SetRecord app's
   own lucide icons (the app uses lucide-react) plus the brand glyph, encoded as
   canvas-strokable SVG path data. Each bloom fills one icon's silhouette with
   high-res grain; the moving light/colour field reveals it (see Bloom.tsx).
   Circles/lines are pre-converted to path `d` strings so everything strokes the
   same way. `sw` is the stroke width in the icon's own viewBox units; `thicken`
   fattens the thin line-icons so the grain has body (kept slim so each icon reads).
   ============================================================ */
export type IconDef = { vb: number; sw: number; paths: string[]; thicken: number }

export const BLOOM_ICONS: Record<string, IconDef> = {
  // Brain — the hero mark. "The memory system for DJs. Make it think." Two
  // hemispheres and the central fold read instantly as a mind at huge scale, and
  // it says exactly what the product does (remember + think) far better than the
  // old analog vinyl, which fought the digital-library positioning. Kept to the
  // bold silhouette (no tiny detail arcs) so the grain has clean body to fill.
  brain: {
    vb: 24,
    sw: 2,
    thicken: 2,
    paths: [
      'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z',
      'M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z',
      'M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4'
    ]
  },
  // Vinyl record — kept for reference; replaced as the hero mark by `brain`.
  vinyl: {
    vb: 24,
    sw: 2,
    thicken: 1.6,
    paths: [
      'M12 2.4a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 1 0 0-19.2',
      'M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10',
      'M12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 1 0 0-2.8'
    ]
  },
  // Your music library
  library: { vb: 24, sw: 2, thicken: 2.7, paths: ['m16 6 4 14', 'M12 6v14', 'M8 8v12', 'M4 4v16'] },
  // Black Box — an ear reading the room. The feature listens to your master
  // output to read the crowd ("what the room actually heard"), so an ear says it
  // far better than the old camera aperture, which implied seeing, not hearing.
  // Pairs with the hero brain as a quiet "senses" motif: it hears, then it thinks.
  ear: {
    vb: 24,
    sw: 2,
    thicken: 2.4,
    paths: [
      'M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0',
      'M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4'
    ]
  },
  // The plain-language ask box
  search: {
    vb: 24,
    sw: 2,
    thicken: 2.7,
    paths: ['M19 11a8 8 0 1 0-16 0 8 8 0 1 0 16 0', 'm21 21-4.3-4.3']
  },
  // Set building / arrange
  layers: {
    vb: 24,
    sw: 2,
    thicken: 2.4,
    paths: [
      'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z',
      'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12',
      'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17'
    ]
  },
  // Signature / stats (waveform)
  activity: {
    vb: 24,
    sw: 2,
    thicken: 2.9,
    paths: [
      'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2'
    ]
  },
  // Black Box — capture / record
  disc: {
    vb: 24,
    sw: 2,
    thicken: 2.4,
    paths: [
      'M22 12a10 10 0 1 0-20 0 10 10 0 1 0 20 0',
      'M6 12c0-1.7.7-3.2 1.8-4.2',
      'M18 12c0 1.7-.7 3.2-1.8 4.2',
      'M14 12a2 2 0 1 0-4 0 2 2 0 1 0 4 0'
    ]
  },
  // Live HUD — on air
  radio: {
    vb: 24,
    sw: 2,
    thicken: 2.4,
    paths: [
      'M4.9 19.1C1 15.2 1 8.8 4.9 4.9',
      'M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5',
      'M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5',
      'M19.1 4.9C23 8.8 23 15.1 19.1 19',
      'M14 12a2 2 0 1 0-4 0 2 2 0 1 0 4 0'
    ]
  },
  // B2B — two DJs
  users: {
    vb: 24,
    sw: 2,
    thicken: 2.5,
    paths: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M13 7a4 4 0 1 0-8 0 4 4 0 1 0 8 0',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75'
    ]
  },
  // AI / magic
  sparkles: {
    vb: 24,
    sw: 2,
    thicken: 2.2,
    paths: [
      'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
      'M20 3v4',
      'M22 5h-4',
      'M4 17v2',
      'M5 18H3'
    ]
  },
  // Privacy — shield
  shield: {
    vb: 24,
    sw: 2,
    thicken: 2.6,
    paths: [
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'
    ]
  },
  // Terms — document
  file: {
    vb: 24,
    sw: 2,
    thicken: 2.6,
    paths: [
      'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z',
      'M14 2v4a2 2 0 0 0 2 2h4',
      'M16 13H8',
      'M16 17H8',
      'M10 9H8'
    ]
  },
  // Contact — mail
  mail: {
    vb: 24,
    sw: 2,
    thicken: 2.6,
    paths: [
      'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
      'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'
    ]
  },
  // ── Recall section stencils — the EXACT lucide glyph shown on each Library tab,
  // so each section's bloom is its own tab icon. Circles/lines are pre-converted to
  // path `d` strings (implicit-arc style, like search/vinyl above) so they stroke
  // identically. vb/sw match lucide's 24-box, 2px source.
  // Constellation (Waypoints)
  waypoints: {
    vb: 24,
    sw: 2,
    thicken: 2,
    paths: [
      'M14.5 4.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 1 0 5 0',
      'm10.2 6.3-3.9 3.9',
      'M7 12a2.5 2.5 0 1 0-5 0 2.5 2.5 0 1 0 5 0',
      'M7 12h10',
      'M22 12a2.5 2.5 0 1 0-5 0 2.5 2.5 0 1 0 5 0',
      'm13.8 17.7 3.9-3.9',
      'M14.5 19.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 1 0 5 0'
    ]
  },
  // Tags (Tag)
  tag: {
    vb: 24,
    sw: 2,
    thicken: 2.6,
    paths: [
      'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z',
      'M8 7.5a.5 .5 0 1 0-1 0 .5 .5 0 1 0 1 0'
    ]
  },
  // Uncover (Telescope)
  telescope: {
    vb: 24,
    sw: 2,
    thicken: 2.2,
    paths: [
      'm10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44',
      'm13.56 11.747 4.332-.924',
      'm16 21-3.105-6.21',
      'M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z',
      'm6.158 8.633 1.114 4.456',
      'm8 21 3.105-6.21',
      'M14 13a2 2 0 1 0-4 0 2 2 0 1 0 4 0'
    ]
  },
  // Combos (ArrowLeftRight)
  arrowLeftRight: {
    vb: 24,
    sw: 2,
    thicken: 2.6,
    paths: ['M8 3 4 7l4 4', 'M4 7h16', 'm16 21 4-4-4-4', 'M20 17H4']
  },
  // Gigs (MapPin)
  mapPin: {
    vb: 24,
    sw: 2,
    thicken: 2.4,
    paths: [
      'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
      'M15 10a3 3 0 1 0-6 0 3 3 0 1 0 6 0'
    ]
  },
  // Venues (Building2)
  building2: {
    vb: 24,
    sw: 2,
    thicken: 2.4,
    paths: [
      'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z',
      'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
      'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
      'M10 6h4',
      'M10 10h4',
      'M10 14h4',
      'M10 18h4'
    ]
  },
  // Health (HeartPulse)
  heartPulse: {
    vb: 24,
    sw: 2,
    thicken: 2.4,
    paths: [
      'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
      'M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27'
    ]
  },
  // Identity (Fingerprint)
  fingerprint: {
    vb: 24,
    sw: 2,
    thicken: 2.2,
    paths: [
      'M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4',
      'M14 13.12c0 2.38 0 6.38-1 8.88',
      'M17.29 21.02c.12-.6.43-2.3.5-3.02',
      'M2 12a10 10 0 0 1 18-6',
      'M2 16h.01',
      'M21.8 16c.2-2 .131-5.354 0-6',
      'M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2',
      'M8.65 22c.21-.66.45-1.32.57-2',
      'M9 6.8a6 6 0 0 1 9 5.2v2'
    ]
  },
  // Brand glyph (kept for reference; not used as a bloom)
  glyph: {
    vb: 1024,
    sw: 124,
    thicken: 1,
    paths: ['M635 276A150 150 0 1 0 512 512A150 150 0 1 1 389 748']
  }
}

export type BloomIcon = keyof typeof BLOOM_ICONS
