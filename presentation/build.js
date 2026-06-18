/* ============================================================
   SetRecord — Digital Solutions Case Study deck
   Visual identity: the app's "grit / State of Sites" register —
   flat near-black canvas, electric-lime accent, neon grain-blooms,
   film-grain texture, editorial serif display heads.
   Fonts mapped to macOS-native equivalents so it renders with full
   fidelity live: Hoefler Text (~Fraunces), Avenir Next (~Space Grotesk),
   Menlo (~JetBrains Mono).
   ============================================================ */
const pptx = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

const A = (f) => path.join(__dirname, "assets", f);
const img = (f) => fs.readFileSync(A(f)).toString("base64");
const IMG = {}; // cache base64
function asset(f) { if (!f.endsWith(".png")) f += ".png"; if (!IMG[f]) IMG[f] = "image/png;base64," + img(f); return IMG[f]; }

const p = new pptx();
p.defineLayout({ name: "GRIT", width: 13.333, height: 7.5 });
p.layout = "GRIT";
p.author = "SetRecord";
p.title = "SetRecord — Digital Solutions Case Study";
const W = 13.333, H = 7.5, M = 0.75;

// ---- palette ----
const INK = "050507", INK1 = "0A0B12";
const CARD = "0E1017", CARD2 = "13151F";
const WHITE = "F4F4F6", SUB = "B2B2BC", MUT = "82828C";
const LIME = "CFFF04", ONLIME = "0A1F12";
const CYAN = "4FD7FF", MAG = "F046AA", VIO = "9668FA", MINT = "5EEAD4";
const BORDER = "23252F", LINE = "2C2E3A";

// ---- fonts ----
const DISP = "Hoefler Text";   // editorial serif (≈ Fraunces)
const SANS = "Avenir Next";    // geometric grotesk (≈ Space Grotesk)
const MONO = "Menlo";          // technical mono (≈ JetBrains Mono)

const shadow = (o = {}) => ({ type: "outer", color: "000000", blur: o.blur || 18, offset: o.offset || 7, angle: 90, opacity: o.opacity || 0.55 });

// ---- base background: ink + blooms + film grain ----
function base(slide, blooms = []) {
  slide.background = { color: INK };
  for (const b of blooms) {
    slide.addImage({ data: asset(`bloom-${b.hue}.png`), x: b.x, y: b.y, w: b.w, h: b.w, transparency: b.t == null ? 0 : b.t });
  }
  slide.addImage({ data: asset("grain.png"), x: 0, y: 0, w: W, h: H, transparency: 86 });
}

// thin hairline card
function card(slide, x, y, w, h, opt = {}) {
  slide.addShape(p.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: opt.r || 0.12,
    fill: { color: opt.fill || CARD },
    line: { color: opt.border || BORDER, width: 1 },
    shadow: opt.shadow === false ? undefined : shadow({ opacity: 0.5 }),
  });
}

// eyebrow + serif title header for content slides
function header(slide, kicker, kColor, title, opt = {}) {
  slide.addText(kicker.toUpperCase(), {
    x: M, y: 0.5, w: 9, h: 0.32, margin: 0,
    fontFace: MONO, fontSize: 11.5, color: kColor, charSpacing: 3, bold: true, align: "left", valign: "middle",
  });
  slide.addText(title, {
    x: M, y: 0.84, w: opt.tw || 11.5, h: opt.th || 0.95, margin: 0,
    fontFace: DISP, fontSize: opt.size || 33, color: WHITE, bold: false, align: "left", valign: "top", lineSpacingMultiple: 0.98,
  });
}

function footer(slide, n) {
  slide.addText("SetRecord — Digital Solutions Case Study", {
    x: M, y: H - 0.42, w: 7, h: 0.3, margin: 0, fontFace: MONO, fontSize: 8.5, color: MUT, charSpacing: 1.5, align: "left", valign: "middle",
  });
  slide.addText(String(n).padStart(2, "0"), {
    x: W - M - 1, y: H - 0.42, w: 1, h: 0.3, margin: 0, fontFace: MONO, fontSize: 8.5, color: MUT, charSpacing: 2, align: "right", valign: "middle",
  });
}

// small feature card with icon, title, body
function featureCard(slide, x, y, w, h, icon, title, body, accent) {
  card(slide, x, y, w, h);
  slide.addShape(p.shapes.ROUNDED_RECTANGLE, { x: x + 0.28, y: y + 0.28, w: 0.62, h: 0.62, rectRadius: 0.1, fill: { color: INK1 }, line: { color: LINE, width: 1 } });
  slide.addImage({ data: asset(icon), x: x + 0.28 + 0.155, y: y + 0.28 + 0.155, w: 0.31, h: 0.31 });
  slide.addText(title, { x: x + 0.28, y: y + 1.02, w: w - 0.56, h: 0.4, margin: 0, fontFace: SANS, fontSize: 14.5, bold: true, color: WHITE, align: "left", valign: "top" });
  slide.addText(body, { x: x + 0.28, y: y + 1.42, w: w - 0.56, h: h - 1.6, margin: 0, fontFace: SANS, fontSize: 11, color: SUB, align: "left", valign: "top", lineSpacingMultiple: 1.04 });
  // accent tick top-right
  slide.addShape(p.shapes.OVAL, { x: x + w - 0.45, y: y + 0.34, w: 0.12, h: 0.12, fill: { color: accent || LIME } });
}

// chip / tag
function chip(slide, x, y, label, color = SUB, w) {
  const ww = w || (0.28 + label.length * 0.072);
  slide.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y, w: ww, h: 0.34, rectRadius: 0.17, fill: { color: INK1 }, line: { color: LINE, width: 1 } });
  slide.addText(label, { x, y, w: ww, h: 0.34, margin: 0, fontFace: MONO, fontSize: 9.5, color, align: "center", valign: "middle" });
  return ww;
}

/* ============================================================ 1. TITLE */
{
  const s = p.addSlide();
  base(s, [
    { hue: "lime", x: 7.4, y: -1.6, w: 7.6 },
    { hue: "magenta", x: 9.2, y: 3.2, w: 6.2, t: 18 },
    { hue: "violet", x: -2.4, y: 3.6, w: 6.5, t: 24 },
  ]);
  s.addText("DIGITAL SOLUTIONS  ·  PRODUCT CASE STUDY  ·  LIVE DEMO", {
    x: M, y: 1.5, w: 11, h: 0.4, margin: 0, fontFace: MONO, fontSize: 12, color: LIME, charSpacing: 3, bold: true, align: "left", valign: "middle",
  });
  s.addText("SetRecord", {
    x: M, y: 2.05, w: 11.8, h: 1.7, margin: 0, fontFace: DISP, fontSize: 104, color: WHITE, bold: false, align: "left", valign: "middle",
  });
  s.addText([
    { text: "Your crate is dumb. ", options: { color: SUB } },
    { text: "Make it think.", options: { color: LIME } },
  ], { x: M, y: 3.78, w: 11, h: 0.7, margin: 0, fontFace: DISP, italic: true, fontSize: 30, align: "left", valign: "middle" });
  s.addText("A desktop intelligence layer for DJs — examined through the problem-solving\nprocess: investigate, generate, evaluate.", {
    x: M, y: 4.65, w: 9.6, h: 0.9, margin: 0, fontFace: SANS, fontSize: 14.5, color: SUB, align: "left", valign: "top", lineSpacingMultiple: 1.15,
  });
  // meta row
  const my = 6.25;
  s.addShape(p.shapes.LINE, { x: M, y: my - 0.18, w: W - 2 * M, h: 0, line: { color: LINE, width: 1 } });
  s.addText("PRESENTED BY  ·  SAM CARTER", { x: M, y: my, w: 6, h: 0.35, margin: 0, fontFace: MONO, fontSize: 10, color: MUT, charSpacing: 2, valign: "middle" });
  s.addText("ELECTRON · TYPESCRIPT · REACT · SQLITE · LOCAL-FIRST", { x: W - M - 7, y: my, w: 7, h: 0.35, margin: 0, fontFace: MONO, fontSize: 10, color: MUT, charSpacing: 1.5, align: "right", valign: "middle" });
}

/* ============================================================ 2. FRAMING / PROCESS */
{
  const s = p.addSlide();
  base(s, [{ hue: "cyan", x: 9.6, y: -2.2, w: 6.6, t: 22 }]);
  header(s, "How to read this deck", CYAN, "Reading a real product through\nthe problem-solving process", { size: 31, th: 1.4 });
  s.addText("SetRecord is a shipping macOS application I designed and built. Today I walk it through the four phases of the digital problem-solving process — the same lens used to assess a digital solution.", {
    x: M, y: 2.35, w: 11.4, h: 0.8, margin: 0, fontFace: SANS, fontSize: 14, color: SUB, valign: "top", lineSpacingMultiple: 1.12,
  });
  const phases = [
    ["icon-microscope", "Investigate", "Problem, users, needs, requirements & criteria for success", CYAN],
    ["icon-gears", "Generate", "Architecture, data, algorithms & the user experience", LIME],
    ["icon-check", "Evaluate", "Test the prototype against the criteria — honestly", MAG],
    ["icon-rocket", "Communicate", "Demo it, reflect, and look at impact & what's next", VIO],
  ];
  const cw = (W - 2 * M - 3 * 0.3) / 4, cy = 3.4, ch = 2.5;
  phases.forEach((ph, i) => {
    const x = M + i * (cw + 0.3);
    card(s, x, cy, cw, ch);
    s.addText("0" + (i + 1), { x: x + 0.26, y: cy + 0.22, w: cw - 0.5, h: 0.6, margin: 0, fontFace: DISP, fontSize: 30, color: ph[3], valign: "top" });
    s.addImage({ data: asset(ph[0]), x: x + cw - 0.72, y: cy + 0.32, w: 0.4, h: 0.4 });
    s.addText(ph[1], { x: x + 0.26, y: cy + 0.95, w: cw - 0.5, h: 0.4, margin: 0, fontFace: SANS, fontSize: 15.5, bold: true, color: WHITE });
    s.addText(ph[2], { x: x + 0.26, y: cy + 1.4, w: cw - 0.5, h: 0.95, margin: 0, fontFace: SANS, fontSize: 11, color: SUB, lineSpacingMultiple: 1.08 });
  });
  s.addText("“A planning layer that sits between library management and live performance.”", {
    x: M, y: 6.25, w: 11.5, h: 0.5, margin: 0, fontFace: DISP, italic: true, fontSize: 15, color: MUT, valign: "middle",
  });
  footer(s, 2);
}

/* ============================================================ 3. PROBLEM & NEED */
{
  const s = p.addSlide();
  base(s, [{ hue: "magenta", x: 9.4, y: 2.2, w: 6.4, t: 14 }]);
  header(s, "Investigate · 01", CYAN, "The problem", { size: 33 });
  s.addText("A DJ's library is a spreadsheet that can't think. The intelligence lives only in the DJ's head — and it fails at the worst possible moment.", {
    x: M, y: 1.85, w: 6.7, h: 1.1, margin: 0, fontFace: SANS, fontSize: 15, color: SUB, valign: "top", lineSpacingMultiple: 1.15,
  });
  const pains = [
    ["icon-database", "10,000+ tracks, zero recall", "Libraries grow into the thousands. Finding the right next record by memory doesn't scale."],
    ["icon-wave", "Harmonic mixing is mental math", "Which keys blend? Done by hand, it's slow, error-prone and easy to get wrong live."],
    ["icon-usb", "USB exports fail on the night", "A bad export means a CDJ that won't read the USB — discovered on stage, not before."],
    ["icon-bolt", "Pre-gig anxiety, offline venues", "2am, no wifi, USB-C only. The exact moment cloud tools and guesswork let you down."],
  ];
  const x0 = 7.2, cw = 5.4, ch = 1.18, gap = 0.22;
  pains.forEach((pn, i) => {
    const y = 1.75 + i * (ch + gap);
    card(s, x0, y, cw, ch);
    s.addImage({ data: asset(pn[0]), x: x0 + 0.3, y: y + 0.3, w: 0.42, h: 0.42 });
    s.addText(pn[1], { x: x0 + 1.0, y: y + 0.18, w: cw - 1.25, h: 0.4, margin: 0, fontFace: SANS, fontSize: 13.5, bold: true, color: WHITE, valign: "middle" });
    s.addText(pn[2], { x: x0 + 1.0, y: y + 0.55, w: cw - 1.25, h: 0.55, margin: 0, fontFace: SANS, fontSize: 10.5, color: SUB, valign: "top", lineSpacingMultiple: 1.04 });
  });
  // the need callout
  card(s, M, 3.35, 6.05, 2.45, { fill: CARD2, border: "3A4410" });
  s.addText("THE NEED", { x: M + 0.35, y: 3.6, w: 5, h: 0.3, margin: 0, fontFace: MONO, fontSize: 10, color: LIME, charSpacing: 2.5, bold: true });
  s.addText("Give the crate a brain — locally.", { x: M + 0.35, y: 3.92, w: 5.4, h: 0.6, margin: 0, fontFace: DISP, fontSize: 23, color: WHITE });
  s.addText("A planning layer that reads an existing library, reasons about it, and guarantees the export works — fast, private, and with no internet required.", {
    x: M + 0.35, y: 4.62, w: 5.4, h: 1.0, margin: 0, fontFace: SANS, fontSize: 12, color: SUB, lineSpacingMultiple: 1.12,
  });
  footer(s, 3);
}

/* ============================================================ 4. USERS & PERSONAS */
{
  const s = p.addSlide();
  base(s, [{ hue: "cyan", x: -2.3, y: 3.0, w: 6.4, t: 16 }]);
  header(s, "Investigate · 02", CYAN, "Who it's for", { size: 33 });
  s.addText("Three personas, one shared need: trust the set before touching the decks.", {
    x: M, y: 1.85, w: 11, h: 0.45, margin: 0, fontFace: SANS, fontSize: 14, color: SUB, valign: "middle",
  });
  const personas = [
    ["icon-route", "The Mobile DJ", "Weddings & events", "Plays varied crowds across venues with no booth internet. Needs a dependable USB and fast recall of what works.", CYAN],
    ["icon-disc", "The Club Resident", "Harmonic, long sets", "Mixes in key for 3-hour sets. Needs harmonic suggestions and a controlled energy arc, not random shuffle.", LIME],
    ["icon-music", "The Bedroom DJ", "Learning the craft", "Big library, still building instinct. Needs the app to teach why two tracks blend, in plain language.", MAG],
  ];
  const cw = (W - 2 * M - 2 * 0.35) / 3, cy = 2.5, ch = 3.45;
  personas.forEach((pr, i) => {
    const x = M + i * (cw + 0.35);
    card(s, x, cy, cw, ch);
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: x + 0.32, y: cy + 0.34, w: 0.78, h: 0.78, rectRadius: 0.14, fill: { color: INK1 }, line: { color: LINE, width: 1 } });
    s.addImage({ data: asset(pr[0]), x: x + 0.32 + 0.21, y: cy + 0.34 + 0.21, w: 0.36, h: 0.36 });
    s.addText(pr[1], { x: x + 0.32, y: cy + 1.28, w: cw - 0.64, h: 0.4, margin: 0, fontFace: DISP, fontSize: 20, color: WHITE });
    s.addText(pr[2].toUpperCase(), { x: x + 0.32, y: cy + 1.74, w: cw - 0.64, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, color: pr[4], charSpacing: 1.5 });
    s.addShape(p.shapes.LINE, { x: x + 0.32, y: cy + 2.12, w: cw - 0.64, h: 0, line: { color: LINE, width: 1 } });
    s.addText(pr[3], { x: x + 0.32, y: cy + 2.26, w: cw - 0.64, h: 1.0, margin: 0, fontFace: SANS, fontSize: 11.5, color: SUB, lineSpacingMultiple: 1.1 });
  });
  s.addText("Derived user need  →  “I want to walk in knowing my set and my USB will just work.”", {
    x: M, y: 6.3, w: 11.5, h: 0.4, margin: 0, fontFace: DISP, italic: true, fontSize: 15, color: MUT, valign: "middle",
  });
  footer(s, 4);
}

/* ============================================================ 5. REQUIREMENTS */
{
  const s = p.addSlide();
  base(s, [{ hue: "lime", x: 9.8, y: -2.4, w: 6.2, t: 20 }]);
  header(s, "Investigate · 03", CYAN, "Solution requirements", { size: 33 });
  s.addText("What the solution must do (functional) and the qualities it must hold (non-functional), organised under three product pillars.", {
    x: M, y: 1.85, w: 11.4, h: 0.6, margin: 0, fontFace: SANS, fontSize: 13.5, color: SUB, lineSpacingMultiple: 1.1,
  });
  // pillars
  const pil = [["Reliability", LIME], ["Intelligence", CYAN], ["Clarity", MAG]];
  const px = M, pw = 3.0, py = 2.65;
  pil.forEach((pl, i) => {
    chip(s, px + i * 2.0, py, pl[0], pl[1], 1.85);
  });
  // table
  const rows = [
    [{ text: "FUNCTIONAL — what it does", options: tHead(LIME) }, { text: "NON-FUNCTIONAL — how it behaves", options: tHead(CYAN) }],
    ["Import a Rekordbox library (XML or master.db), read-only", "Works fully offline — no network on the critical path"],
    ["Normalise keys to the Camelot wheel for harmonic mixing", "Handles 10,000+ tracks with fast search & filtering"],
    ["Score transition risk: clean / messy / trainwreck", "Audio is analysed locally and never uploaded"],
    ["Auto-build sets (Set Architect) along an energy curve", "Secrets in the macOS Keychain; signed, verifiable licence"],
    ["Validate & export a CDJ-ready USB before the gig", "Accessible UI — WCAG AA contrast across every theme"],
  ];
  s.addTable(rows, {
    x: M, y: 3.2, w: W - 2 * M, colW: [(W - 2 * M) / 2, (W - 2 * M) / 2],
    rowH: [0.42, 0.5, 0.5, 0.5, 0.5, 0.5],
    fontFace: SANS, fontSize: 12, color: SUB, valign: "middle",
    border: { type: "solid", pt: 1, color: BORDER },
    fill: { color: CARD },
    margin: [4, 8, 4, 8],
  });
  footer(s, 5);
}
function tHead(c) { return { fontFace: MONO, fontSize: 11, color: c, bold: true, fill: { color: INK1 }, charSpacing: 1.5, valign: "middle" }; }

/* ============================================================ 6. CRITERIA FOR SUCCESS */
{
  const s = p.addSlide();
  base(s, [{ hue: "violet", x: 9.5, y: 2.6, w: 6.4, t: 16 }]);
  header(s, "Investigate · 04", CYAN, "Criteria for success", { size: 33 });
  s.addText("The measurable, testable bar the prototype is judged against in the evaluation phase.", {
    x: M, y: 1.85, w: 11, h: 0.45, margin: 0, fontFace: SANS, fontSize: 14, color: SUB, valign: "middle",
  });
  const crit = [
    ["icon-shield", "Data integrity", "Re-importing a library never loses sets, cue points or play history."],
    ["icon-lock", "Privacy by design", "No audio or library data ever leaves the machine. Verifiable, not promised."],
    ["icon-gauge", "Performance", "Search, filter and suggest across a 10k-track library feel instant."],
    ["icon-usb", "Export safety", "Every USB export is validated for CDJ compatibility before it's written."],
    ["icon-brain", "Explainable intelligence", "Every suggestion states why — harmony, energy, BPM — in plain language."],
    ["icon-check", "Robustness", "A corrupt library is quarantined, not deleted; the app self-recovers."],
  ];
  const cw = (W - 2 * M - 2 * 0.3) / 3, ch = 1.62, gx = 0.3, gy = 0.28, y0 = 2.5;
  crit.forEach((c, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = M + col * (cw + gx), y = y0 + row * (ch + gy);
    card(s, x, y, cw, ch);
    s.addImage({ data: asset(c[0]), x: x + 0.3, y: y + 0.3, w: 0.42, h: 0.42 });
    s.addText(c[1], { x: x + 0.92, y: y + 0.28, w: cw - 1.1, h: 0.45, margin: 0, fontFace: SANS, fontSize: 13.5, bold: true, color: WHITE, valign: "middle" });
    s.addText(c[2], { x: x + 0.3, y: y + 0.82, w: cw - 0.6, h: 0.7, margin: 0, fontFace: SANS, fontSize: 10.8, color: SUB, lineSpacingMultiple: 1.06 });
  });
  footer(s, 6);
}

/* ============================================================ 7. ARCHITECTURE */
{
  const s = p.addSlide();
  base(s, [{ hue: "lime", x: -2.6, y: -2.2, w: 6.6, t: 18 }, { hue: "cyan", x: 10, y: 4, w: 5.8, t: 22 }]);
  header(s, "Generate · 01", LIME, "Solution architecture", { size: 33 });
  s.addText("A two-process Electron app. The UI never touches the disk or database directly — every request crosses a secured bridge. Security and offline-first, by construction.", {
    x: M, y: 1.85, w: 6.05, h: 1.3, margin: 0, fontFace: SANS, fontSize: 13.5, color: SUB, valign: "top", lineSpacingMultiple: 1.14,
  });
  // tech chips — wrap within the left column
  const techs = ["Electron 33", "React 18", "TypeScript", "SQLite (WAL)", "Zustand", "Vite", "ffmpeg (bundled)"];
  let tx = M, ty = 3.25; const tMaxR = 6.85;
  techs.forEach((t) => {
    const tw = 0.3 + t.length * 0.075;
    if (tx + tw > tMaxR) { tx = M; ty += 0.46; }
    chip(s, tx, ty, t, SUB, tw);
    tx += tw + 0.16;
  });
  // layered stack on the right
  const layers = [
    ["Renderer  ·  React UI", "Library, Set Architect, suggestions, energy curve", CYAN],
    ["contextBridge  ·  IPC", "Typed, sandboxed messages — no nodeIntegration", LIME],
    ["Main process  ·  services", "Import · analysis · algorithms · export · licensing", MAG],
    ["SQLite + local audio", "library.db (your machine) · files read in place", VIO],
  ];
  const lx = 7.1, lw = 5.45, lh = 0.92, ly0 = 1.8, lgap = 0.2;
  layers.forEach((l, i) => {
    const y = ly0 + i * (lh + lgap);
    card(s, lx, y, lw, lh);
    s.addShape(p.shapes.RECTANGLE, { x: lx, y: y + 0.16, w: 0.07, h: lh - 0.32, fill: { color: l[2] } });
    s.addText(l[0], { x: lx + 0.32, y: y + 0.14, w: lw - 0.6, h: 0.36, margin: 0, fontFace: SANS, fontSize: 13.5, bold: true, color: WHITE, valign: "middle" });
    s.addText(l[1], { x: lx + 0.32, y: y + 0.5, w: lw - 0.6, h: 0.34, margin: 0, fontFace: MONO, fontSize: 9.5, color: SUB, valign: "middle" });
    if (i < 3) s.addText("▲▼", { x: lx + lw / 2 - 0.3, y: y + lh - 0.02, w: 0.6, h: lgap, margin: 0, fontFace: SANS, fontSize: 8, color: MUT, align: "center", valign: "middle" });
  });
  s.addText("No AI APIs. Every suggestion and score is a deterministic local algorithm — so it works at a venue with no wifi.", {
    x: M, y: 4.35, w: 6.05, h: 1.4, margin: 0, fontFace: DISP, italic: true, fontSize: 17, color: SUB, valign: "top", lineSpacingMultiple: 1.1,
  });
  footer(s, 7);
}

/* ============================================================ 8. DATA MODEL */
{
  const s = p.addSlide();
  base(s, [{ hue: "cyan", x: 9.7, y: -2.3, w: 6.2, t: 16 }]);
  header(s, "Generate · 02 — Data", CYAN, "Data model & structures", { size: 33 });
  s.addText("The library is relational, not a flat file. SQLite was chosen over JSON / localStorage because a 10k-row library needs real queries — BPM ranges, key filters, fuzzy search — and must survive restarts.", {
    x: M, y: 1.85, w: 11.4, h: 0.85, margin: 0, fontFace: SANS, fontSize: 13.5, color: SUB, lineSpacingMultiple: 1.12,
  });
  const ents = [
    ["icon-music", "tracks", "title · artist · BPM · key · energy · path · cover art", CYAN],
    ["icon-layers", "playlists", "imported Rekordbox crates & smart playlists", LIME],
    ["icon-route", "sets", "ordered tracks · cue points · transition scores", MAG],
    ["icon-disc", "play_sessions", "when & where played — venue, date, gig recall", VIO],
  ];
  const cw = (W - 2 * M - 3 * 0.28) / 4, cy = 2.95, ch = 1.95;
  ents.forEach((e, i) => {
    const x = M + i * (cw + 0.28);
    card(s, x, cy, cw, ch);
    s.addImage({ data: asset(e[0]), x: x + 0.26, y: cy + 0.28, w: 0.42, h: 0.42 });
    s.addText(e[1], { x: x + 0.26, y: cy + 0.82, w: cw - 0.5, h: 0.4, margin: 0, fontFace: MONO, fontSize: 14, bold: true, color: e[3], valign: "middle" });
    s.addText(e[2], { x: x + 0.26, y: cy + 1.22, w: cw - 0.5, h: 0.65, margin: 0, fontFace: SANS, fontSize: 10.5, color: SUB, lineSpacingMultiple: 1.06 });
  });
  // transformation callout
  card(s, M, 5.2, W - 2 * M, 1.45, { fill: CARD2 });
  s.addImage({ data: asset("icon-wave"), x: M + 0.3, y: 5.5, w: 0.5, h: 0.5 });
  s.addText("Key data transformation — the Camelot wheel", { x: M + 1.0, y: 5.42, w: 6, h: 0.4, margin: 0, fontFace: SANS, fontSize: 14, bold: true, color: WHITE });
  s.addText("Raw musical keys (e.g. “F# minor”) are normalised to Camelot notation (11A). This single transform turns an unstructured field into something the harmonic-mixing algorithm can reason about — adjacency on the wheel = a compatible blend.", {
    x: M + 1.0, y: 5.82, w: W - 2 * M - 1.4, h: 0.75, margin: 0, fontFace: SANS, fontSize: 11.5, color: SUB, lineSpacingMultiple: 1.1,
  });
  footer(s, 8);
}

/* ============================================================ 9. DATA EXCHANGE */
{
  const s = p.addSlide();
  base(s, [{ hue: "mint", x: 4, y: 3.4, w: 6.4, t: 20 }]);
  header(s, "Generate · 03 — Data exchange", CYAN, "Import → transform → export", { size: 31 });
  s.addText("SetRecord interoperates with the DJ's existing ecosystem. It reads sources read-only, transforms in its own database, and writes a verified target — never mutating the originals.",
    { x: M, y: 1.85, w: 11.4, h: 0.7, margin: 0, fontFace: SANS, fontSize: 13.5, color: SUB, lineSpacingMultiple: 1.12 });
  const stages = [
    ["icon-database", "INPUT", "Rekordbox XML\n or master.db", "Read-only. Matched by file path so re-imports never duplicate.", CYAN],
    ["icon-gears", "TRANSFORM", "SetRecord\n SQLite library", "Parse · normalise keys · analyse energy · score transitions.", LIME],
    ["icon-usb", "OUTPUT", "CDJ-ready USB\n / Engine export", "Validated for Pioneer hardware before a single byte is written.", MAG],
  ];
  const cw = 3.55, gap = 1.0, y = 2.95, ch = 2.9;
  const totalW = 3 * cw + 2 * gap; const startX = (W - totalW) / 2;
  stages.forEach((st, i) => {
    const x = startX + i * (cw + gap);
    card(s, x, y, cw, ch);
    s.addText(st[1], { x: x + 0.3, y: y + 0.3, w: cw - 0.6, h: 0.3, margin: 0, fontFace: MONO, fontSize: 10.5, color: st[4], charSpacing: 2.5, bold: true });
    s.addImage({ data: asset(st[0]), x: x + 0.3, y: y + 0.72, w: 0.56, h: 0.56 });
    s.addText(st[2], { x: x + 0.3, y: y + 1.42, w: cw - 0.6, h: 0.7, margin: 0, fontFace: DISP, fontSize: 18, color: WHITE, lineSpacingMultiple: 0.98 });
    s.addText(st[3], { x: x + 0.3, y: y + 2.12, w: cw - 0.6, h: 0.7, margin: 0, fontFace: SANS, fontSize: 11, color: SUB, lineSpacingMultiple: 1.08 });
    if (i < 2) s.addImage({ data: asset("icon-arrow"), x: x + cw + (gap - 0.55) / 2, y: y + ch / 2 - 0.16, w: 0.55, h: 0.32 });
  });
  s.addText("Non-destructive by contract — the importer never writes back to Rekordbox; the exporter copies audio and writes a fresh, validated database.",
    { x: M, y: 6.35, w: 11.6, h: 0.5, margin: 0, fontFace: DISP, italic: true, fontSize: 14.5, color: MUT, valign: "middle" });
  footer(s, 9);
}

/* ============================================================ 10. DATA SECURITY & PRIVACY */
{
  const s = p.addSlide();
  base(s, [{ hue: "cyan", x: -2.4, y: 2.6, w: 6.6, t: 12 }, { hue: "violet", x: 10, y: -2, w: 6, t: 22 }]);
  header(s, "Generate · 04 — Security & privacy", CYAN, "Local-first, private by design", { size: 31 });
  s.addText("Privacy isn't a setting — it's the architecture. The strongest guarantee is the one the design makes impossible to break.",
    { x: M, y: 1.85, w: 11, h: 0.5, margin: 0, fontFace: SANS, fontSize: 14, color: SUB, valign: "middle" });
  const sec = [
    ["icon-eye", "Audio never leaves the device", "All analysis runs locally. Files are served to the UI over an internal media:// protocol, read straight from disk."],
    ["icon-key", "Secrets in the macOS Keychain", "Licence keys and any API keys live in the system Keychain — never in the database or a plain file."],
    ["icon-shield", "Signed, verifiable licensing", "Ed25519 signatures. The app can verify a licence but cannot mint one — the private key never ships."],
    ["icon-lock", "Opt-in, anonymous telemetry", "The only thing that can ever leave is a crash report — and only if you opt in. Documented line by line."],
  ];
  const cw = (W - 2 * M - 0.3) / 2, ch = 1.55, y0 = 2.55;
  sec.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * (cw + 0.3), y = y0 + row * (ch + 0.25);
    card(s, x, y, cw, ch);
    s.addImage({ data: asset(c[0]), x: x + 0.32, y: y + 0.34, w: 0.46, h: 0.46 });
    s.addText(c[1], { x: x + 1.0, y: y + 0.3, w: cw - 1.25, h: 0.4, margin: 0, fontFace: SANS, fontSize: 14, bold: true, color: WHITE, valign: "middle" });
    s.addText(c[2], { x: x + 1.0, y: y + 0.72, w: cw - 1.25, h: 0.7, margin: 0, fontFace: SANS, fontSize: 11, color: SUB, lineSpacingMultiple: 1.08 });
  });
  s.addText("“The only thing that can ever leave your machine is an anonymous crash report — and only if you opt in.”",
    { x: M, y: 6.35, w: 11.7, h: 0.45, margin: 0, fontFace: DISP, italic: true, fontSize: 14.5, color: LIME, valign: "middle" });
  footer(s, 10);
}

/* ============================================================ 11. ALGORITHMS */
{
  const s = p.addSlide();
  base(s, [{ hue: "magenta", x: 9.6, y: 2.4, w: 6.2, t: 14 }]);
  header(s, "Generate · 05 — Programming", LIME, "Algorithms & logic", { size: 33 });
  s.addText("The intelligence is four deterministic algorithms — no black box, no cloud. Each is testable and explainable.",
    { x: M, y: 1.85, w: 11, h: 0.45, margin: 0, fontFace: SANS, fontSize: 14, color: SUB, valign: "middle" });
  const algos = [
    ["icon-wave", "Harmonic matching", "Camelot adjacency → surfaces only compatible-key transitions.", CYAN],
    ["icon-gauge", "Transition risk score", "Key + BPM gap + energy jump → clean / messy / trainwreck.", MAG],
    ["icon-layers", "Set Architect", "Builds a full set from a pool, fitted to a target energy curve.", LIME],
    ["icon-brain", "Suggestion ranker", "Ranks the next track and labels why — harmony, energy, BPM.", VIO],
  ];
  const cw = (W - 2 * M - 0.3) / 2, ch = 1.28, y0 = 2.45;
  algos.forEach((a, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * (cw + 0.3), y = y0 + row * (ch + 0.22);
    card(s, x, y, cw, ch);
    s.addImage({ data: asset(a[0]), x: x + 0.3, y: y + 0.32, w: 0.44, h: 0.44 });
    s.addText(a[1], { x: x + 0.95, y: y + 0.22, w: cw - 1.2, h: 0.4, margin: 0, fontFace: SANS, fontSize: 14, bold: true, color: WHITE, valign: "middle" });
    s.addText(a[2], { x: x + 0.95, y: y + 0.62, w: cw - 1.2, h: 0.5, margin: 0, fontFace: SANS, fontSize: 11, color: SUB, lineSpacingMultiple: 1.05 });
  });
  // pseudo flow strip
  card(s, M, 5.55, W - 2 * M, 1.15, { fill: CARD2 });
  s.addText("TRANSITION  SCORE", { x: M + 0.3, y: 5.72, w: 2.4, h: 0.8, margin: 0, fontFace: MONO, fontSize: 10.5, color: LIME, charSpacing: 1.5, bold: true, valign: "middle" });
  const steps = ["key distance", "+  BPM Δ", "+  energy jump", "→  weighted score", "→  badge"];
  const stepW = 1.79; let sx = M + 2.7;
  steps.forEach((st) => {
    const col = st.startsWith("→") ? LIME : SUB;
    s.addText(st, { x: sx, y: 5.72, w: stepW, h: 0.8, margin: 0, fontFace: MONO, fontSize: 10.5, color: col, valign: "middle", align: "center" });
    sx += stepW;
  });
  footer(s, 11);
}

/* ============================================================ 12. UX & INTERFACE */
{
  const s = p.addSlide();
  base(s, [{ hue: "lime", x: 9.8, y: -2.4, w: 6.2, t: 18 }]);
  header(s, "Generate · 06 — User experience", LIME, "Designing the experience", { size: 32 });
  s.addText("Usability principles, made concrete in the interface.",
    { x: M, y: 1.85, w: 11, h: 0.4, margin: 0, fontFace: SANS, fontSize: 14, color: SUB, valign: "middle" });
  const ux = [
    ["icon-bolt", "Affordances", "Clean / messy / trainwreck badges and colour-coded key chips make compatibility readable at a glance — no reading required."],
    ["icon-gauge", "Feedback", "Live energy-curve graph, waveform preview and inline audition — the DJ hears and sees the consequence of every choice."],
    ["icon-brain", "Recognition over recall", "⌘K search, suggestion chips and a searchable memory of past sets surface options instead of demanding the DJ remember them."],
    ["icon-shield", "Accessibility", "WCAG-AA contrast is automatically validated across all three themes; motion respects the OS reduced-motion setting."],
  ];
  const cw = (W - 2 * M - 0.3) / 2, ch = 1.62, y0 = 2.4;
  ux.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * (cw + 0.3), y = y0 + row * (ch + 0.24);
    card(s, x, y, cw, ch);
    s.addImage({ data: asset(c[0]), x: x + 0.32, y: y + 0.32, w: 0.44, h: 0.44 });
    s.addText(c[1], { x: x + 0.98, y: y + 0.3, w: cw - 1.2, h: 0.4, margin: 0, fontFace: SANS, fontSize: 14.5, bold: true, color: WHITE, valign: "middle" });
    s.addText(c[2], { x: x + 0.32, y: y + 0.9, w: cw - 0.64, h: 0.65, margin: 0, fontFace: SANS, fontSize: 11, color: SUB, lineSpacingMultiple: 1.08 });
  });
  footer(s, 12);
}

/* ============================================================ 13. VISUAL IDENTITY / DESIGN SYSTEM */
{
  const s = p.addSlide();
  base(s, [
    { hue: "lime", x: 8.6, y: -1.4, w: 6.2 },
    { hue: "magenta", x: 10.2, y: 3.4, w: 5.4, t: 14 },
    { hue: "violet", x: -2.2, y: 3.2, w: 5.8, t: 22 },
  ]);
  header(s, "Generate · 07 — Design system", LIME, "A token-driven visual identity", { size: 31 });
  s.addText("One source of truth in tokens.css cascades to ~123 components. The whole app's look can be swapped with a single line — this deck uses the very same palette and type.",
    { x: M, y: 1.85, w: 6.15, h: 1.1, margin: 0, fontFace: SANS, fontSize: 13.5, color: SUB, lineSpacingMultiple: 1.14 });
  // palette swatches
  const sw = [["Electric lime", LIME, ONLIME], ["Cyan", CYAN, INK], ["Magenta", MAG, INK], ["Violet", VIO, INK], ["Near-black", INK1, WHITE]];
  const swx = M, swy = 3.2, sww = 1.14, swh = 1.35;
  sw.forEach((c, i) => {
    const x = swx + i * (sww + 0.12);
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: swy, w: sww, h: swh, rectRadius: 0.1, fill: { color: c[1] }, line: { color: BORDER, width: 1 } });
    s.addText(c[0], { x, y: swy + swh - 0.5, w: sww, h: 0.4, margin: 0, fontFace: MONO, fontSize: 8.5, color: c[2], align: "center", valign: "middle" });
    s.addText("#" + c[1], { x, y: swy + 0.14, w: sww, h: 0.3, margin: 0, fontFace: MONO, fontSize: 8, color: c[2], align: "center", valign: "middle", charSpacing: 0.5 });
  });
  // type pairing card
  card(s, 7.3, 1.8, 5.25, 4.45, { fill: CARD2 });
  s.addText("Aa", { x: 7.55, y: 2.0, w: 4.7, h: 1.4, margin: 0, fontFace: DISP, fontSize: 96, color: WHITE, valign: "middle" });
  s.addText("HOEFLER TEXT  ·  DISPLAY SERIF", { x: 7.55, y: 3.45, w: 4.7, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, color: LIME, charSpacing: 1.5 });
  s.addText("Editorial heads carry the brand’s “grit” register.", { x: 7.55, y: 3.74, w: 4.7, h: 0.4, margin: 0, fontFace: SANS, fontSize: 11, color: SUB });
  s.addShape(p.shapes.LINE, { x: 7.55, y: 4.3, w: 4.7, h: 0, line: { color: LINE, width: 1 } });
  s.addText("Space Grotesk / Avenir Next", { x: 7.55, y: 4.42, w: 4.7, h: 0.5, margin: 0, fontFace: SANS, fontSize: 22, bold: true, color: WHITE });
  s.addText("Geometric grotesk for all UI and body copy.", { x: 7.55, y: 4.95, w: 4.7, h: 0.35, margin: 0, fontFace: SANS, fontSize: 11, color: SUB });
  s.addText("menlo · mono — data, keys & labels  ·  9A  11B  128 BPM", { x: 7.55, y: 5.5, w: 4.7, h: 0.4, margin: 0, fontFace: MONO, fontSize: 10.5, color: MINT });
  s.addText("Flat black canvas · film grain · neon that lives in background blooms, never in the chrome.",
    { x: M, y: 5.05, w: 6.4, h: 1.0, margin: 0, fontFace: DISP, italic: true, fontSize: 15, color: MUT, lineSpacingMultiple: 1.1 });
  footer(s, 13);
}

/* ============================================================ 14. ENGINEERING RIGOUR */
{
  const s = p.addSlide();
  base(s, [{ hue: "cyan", x: 9.7, y: 2.4, w: 6.2, t: 16 }]);
  header(s, "Generate · 08 — Engineering", LIME, "Built like production software", { size: 32 });
  s.addText("This isn't a prototype held together with tape — it ships behind a four-stage quality gate on every change.",
    { x: M, y: 1.85, w: 11, h: 0.45, margin: 0, fontFace: SANS, fontSize: 14, color: SUB, valign: "middle" });
  // stats
  const stats = [["862", "automated tests", LIME], ["100%", "TypeScript — no plain JS", CYAN], ["4", "CI gates per pull request", MAG], ["3", "themes, all WCAG-AA", VIO]];
  const cw = (W - 2 * M - 3 * 0.28) / 4, cy = 2.5, ch = 1.85;
  stats.forEach((st, i) => {
    const x = M + i * (cw + 0.28);
    card(s, x, cy, cw, ch);
    s.addText(st[0], { x: x + 0.2, y: cy + 0.25, w: cw - 0.4, h: 0.95, margin: 0, fontFace: DISP, fontSize: 50, color: st[2], align: "left", valign: "middle" });
    s.addText(st[1], { x: x + 0.22, y: cy + 1.25, w: cw - 0.44, h: 0.5, margin: 0, fontFace: SANS, fontSize: 11.5, color: SUB, lineSpacingMultiple: 1.05 });
  });
  // CI pipeline
  card(s, M, 4.65, W - 2 * M, 1.55, { fill: CARD2 });
  s.addText("CONTINUOUS  INTEGRATION  ·  GITHUB  ACTIONS", { x: M + 0.32, y: 4.85, w: 8, h: 0.3, margin: 0, fontFace: MONO, fontSize: 10, color: CYAN, charSpacing: 2, bold: true });
  const gates = ["typecheck", "lint", "test", "build"];
  const gw = 2.5, gstartX = M + 0.32, gy = 5.35;
  gates.forEach((g, i) => {
    const x = gstartX + i * (gw + 0.55);
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: gy, w: gw, h: 0.66, rectRadius: 0.1, fill: { color: INK1 }, line: { color: LINE, width: 1 } });
    s.addImage({ data: asset("icon-check"), x: x + 0.22, y: gy + 0.2, w: 0.26, h: 0.26 });
    s.addText(g, { x: x + 0.55, y: gy, w: gw - 0.6, h: 0.66, margin: 0, fontFace: MONO, fontSize: 13, color: WHITE, valign: "middle" });
    if (i < 3) s.addText("→", { x: x + gw + 0.04, y: gy, w: 0.5, h: 0.66, margin: 0, fontFace: SANS, fontSize: 16, color: LIME, align: "center", valign: "middle" });
  });
  s.addText("All four must pass before anything merges. Native modules rebuilt per platform.", { x: W - M - 5.2, y: 4.85, w: 5.0, h: 0.3, margin: 0, fontFace: SANS, fontSize: 10, color: MUT, align: "right", valign: "middle" });
  footer(s, 14);
}

/* ============================================================ 15. LIVE DEMO */
{
  const s = p.addSlide();
  base(s, [
    { hue: "lime", x: 7.8, y: 1.4, w: 7.2 },
    { hue: "cyan", x: -2.6, y: -2.2, w: 6.6, t: 16 },
    { hue: "magenta", x: 8.4, y: -2, w: 5.6, t: 20 },
  ]);
  s.addText("LIVE  DEMO", { x: M, y: 1.2, w: 8, h: 0.4, margin: 0, fontFace: MONO, fontSize: 13, color: LIME, charSpacing: 4, bold: true });
  s.addText("Let's open it.", { x: M, y: 1.7, w: 9, h: 1.3, margin: 0, fontFace: DISP, fontSize: 68, color: WHITE, valign: "middle" });
  s.addText("What you're about to watch — end to end, on this machine, fully offline:",
    { x: M, y: 3.2, w: 8.5, h: 0.4, margin: 0, fontFace: SANS, fontSize: 15, color: SUB, valign: "middle" });
  const beats = [
    ["icon-database", "Import a Rekordbox library — watch it parse, key-normalise and analyse, read-only."],
    ["icon-music", "Browse the library — search, key chips, energy bars, instant audition."],
    ["icon-layers", "Build a set with Set Architect, then refine it on the energy curve."],
    ["icon-brain", "Ask for the next track — and read why it was suggested."],
    ["icon-usb", "Validate & export a CDJ-ready USB — safety checked before it writes."],
  ];
  const bx = M, bw = 11.0, bh = 0.56, by0 = 3.75;
  beats.forEach((b, i) => {
    const y = by0 + i * (bh + 0.06);
    s.addText(String(i + 1).padStart(2, "0"), { x: bx, y, w: 0.5, h: bh, margin: 0, fontFace: MONO, fontSize: 13, color: LIME, valign: "middle", bold: true });
    s.addImage({ data: asset(b[0]), x: bx + 0.6, y: y + 0.13, w: 0.3, h: 0.3 });
    s.addText(b[1], { x: bx + 1.05, y, w: bw - 1.05, h: bh, margin: 0, fontFace: SANS, fontSize: 13, color: WHITE, valign: "middle" });
  });
  footer(s, 15);
}

/* ============================================================ 16. EVALUATION */
{
  const s = p.addSlide();
  base(s, [{ hue: "magenta", x: -2.4, y: 2.6, w: 6.4, t: 14 }]);
  header(s, "Evaluate · 01", MAG, "Tested against the criteria", { size: 33 });
  s.addText("An honest pass over the criteria for success — what's met, and what's deliberately still open.",
    { x: M, y: 1.85, w: 11, h: 0.45, margin: 0, fontFace: SANS, fontSize: 14, color: SUB, valign: "middle" });
  const ok = (t) => ({ text: t, options: { fontFace: MONO, fontSize: 11, color: LIME, bold: true, align: "center", valign: "middle" } });
  const wip = (t) => ({ text: t, options: { fontFace: MONO, fontSize: 11, color: MAG, bold: true, align: "center", valign: "middle" } });
  const cell = (t) => ({ text: t, options: { fontFace: SANS, fontSize: 11.5, color: SUB, valign: "middle" } });
  const rows = [
    [{ text: "CRITERION", options: tHead(WHITE) }, { text: "VERDICT", options: { ...tHead(WHITE), align: "center" } }, { text: "EVIDENCE", options: tHead(WHITE) }],
    [cell("Data integrity on re-import"), ok("MET"), cell("Tracks matched by path; sets, cues & history preserved across re-imports.")],
    [cell("Privacy — nothing leaves device"), ok("MET"), cell("Local analysis + media:// protocol; verified in the network layer.")],
    [cell("Performance at 10k tracks"), ok("MET"), cell("SQLite WAL with indexed BPM / key / fuzzy search — instant in use.")],
    [cell("Export safety (CDJ validated)"), ok("MET"), cell("USB validator blocks non-owned / missing audio before writing.")],
    [cell("Explainable suggestions"), ok("MET"), cell("Every suggestion carries match-reason chips — harmony, energy, BPM.")],
    [cell("Real-booth reaction validation"), wip("OPEN"), cell("Flight-recorder reactions still need live-venue testing — next phase.")],
  ];
  s.addTable(rows, {
    x: M, y: 2.45, w: W - 2 * M, colW: [3.9, 1.3, 6.63],
    rowH: [0.42, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6],
    fontFace: SANS, fontSize: 11.5, color: SUB, valign: "middle",
    border: { type: "solid", pt: 1, color: BORDER }, fill: { color: CARD }, margin: [4, 8, 4, 8],
  });
  footer(s, 16);
}

/* ============================================================ 17. SOCIAL / ETHICAL / LEGAL */
{
  const s = p.addSlide();
  base(s, [{ hue: "violet", x: 9.6, y: -2.2, w: 6.4, t: 16 }]);
  header(s, "Evaluate · 02", MAG, "Social, ethical & legal lens", { size: 32 });
  s.addText("Design decisions weighed against their impact on people, fairness and the law.",
    { x: M, y: 1.85, w: 11, h: 0.45, margin: 0, fontFace: SANS, fontSize: 14, color: SUB, valign: "middle" });
  const items = [
    ["icon-eye", "Privacy & data ethics", "Local-first means a user's library — taste, history, work — is never harvested. The default is dignity, not data collection."],
    ["icon-scale", "Intellectual property", "Reads the user's own library read-only; never redistributes audio. Exports copy only files the user already owns."],
    ["icon-shield", "Accessibility & inclusion", "WCAG-AA contrast and reduced-motion support are enforced in CI — accessibility is a gate, not an afterthought."],
    ["icon-key", "Fair, honest licensing", "Signed licences with offline-friendly, refund-enforceable checks — anti-piracy that never locks out a paying user offline."],
  ];
  const cw = (W - 2 * M - 0.3) / 2, ch = 1.62, y0 = 2.55;
  items.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * (cw + 0.3), y = y0 + row * (ch + 0.26);
    card(s, x, y, cw, ch);
    s.addImage({ data: asset(c[0]), x: x + 0.32, y: y + 0.34, w: 0.46, h: 0.46 });
    s.addText(c[1], { x: x + 1.0, y: y + 0.3, w: cw - 1.25, h: 0.4, margin: 0, fontFace: SANS, fontSize: 14, bold: true, color: WHITE, valign: "middle" });
    s.addText(c[2], { x: x + 1.0, y: y + 0.74, w: cw - 1.25, h: 0.75, margin: 0, fontFace: SANS, fontSize: 11, color: SUB, lineSpacingMultiple: 1.08 });
  });
  footer(s, 17);
}

/* ============================================================ 18. REFLECTION & FUTURE */
{
  const s = p.addSlide();
  base(s, [{ hue: "lime", x: -2.4, y: -2.2, w: 6.4, t: 16 }, { hue: "cyan", x: 10, y: 3.6, w: 5.6, t: 20 }]);
  header(s, "Communicate · 01", VIO, "Reflection & what's next", { size: 32 });
  s.addText("The architecture I chose — local-first, deterministic, token-driven — became the platform for everything coming next.",
    { x: M, y: 1.85, w: 11.2, h: 0.6, margin: 0, fontFace: SANS, fontSize: 13.5, color: SUB, lineSpacingMultiple: 1.1 });
  const next = [
    ["icon-disc", "Set Flight Recorder", "An always-armed “dashcam” for sets — auto tracklist, reactions and lo-fi room audio, captured locally.", MAG],
    ["icon-users", "Back-to-back co-editing", "Two DJs editing one set in real time over the LAN — no backend, CRDT-synced.", CYAN],
    ["icon-brain", "Library memory & recall", "“Songs I played at Hi Ibiza in July” — the crate becomes a searchable memory.", VIO],
    ["icon-code", "Multi-language UI", "Five languages, key-parity tested — widening who the tool reaches.", LIME],
  ];
  const cw = (W - 2 * M - 0.3) / 2, ch = 1.55, y0 = 2.6;
  next.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * (cw + 0.3), y = y0 + row * (ch + 0.24);
    card(s, x, y, cw, ch);
    s.addImage({ data: asset(c[0]), x: x + 0.32, y: y + 0.32, w: 0.44, h: 0.44 });
    s.addText(c[1], { x: x + 0.98, y: y + 0.28, w: cw - 1.2, h: 0.4, margin: 0, fontFace: SANS, fontSize: 14, bold: true, color: WHITE, valign: "middle" });
    s.addText(c[2], { x: x + 0.32, y: y + 0.88, w: cw - 0.64, h: 0.6, margin: 0, fontFace: SANS, fontSize: 11, color: SUB, lineSpacingMultiple: 1.06 });
  });
  s.addText("Biggest lesson: constraints are a design tool. “No cloud” forced clearer algorithms, a stronger privacy story and an app that just works at 2am.",
    { x: M, y: 6.3, w: 11.6, h: 0.5, margin: 0, fontFace: DISP, italic: true, fontSize: 14.5, color: MUT, valign: "middle" });
  footer(s, 18);
}

/* ============================================================ 19. CLOSE */
{
  const s = p.addSlide();
  base(s, [
    { hue: "lime", x: 7.6, y: 1.0, w: 7.8 },
    { hue: "violet", x: -2.6, y: 3.0, w: 6.6, t: 20 },
    { hue: "magenta", x: 9.4, y: -2, w: 5.6, t: 18 },
  ]);
  s.addText("THANK  YOU", { x: M, y: 1.7, w: 8, h: 0.4, margin: 0, fontFace: MONO, fontSize: 13, color: LIME, charSpacing: 4, bold: true });
  s.addText([
    { text: "Your crate is dumb.\n", options: { color: WHITE } },
    { text: "Make it think.", options: { color: LIME } },
  ], { x: M, y: 2.2, w: 11.5, h: 2.0, margin: 0, fontFace: DISP, fontSize: 62, valign: "middle", lineSpacingMultiple: 1.0 });
  s.addText("A local-first desktop intelligence layer for DJs — investigated, generated and evaluated through the digital problem-solving process.",
    { x: M, y: 4.5, w: 9.4, h: 0.9, margin: 0, fontFace: SANS, fontSize: 15, color: SUB, lineSpacingMultiple: 1.15 });
  const my = 6.25;
  s.addShape(p.shapes.LINE, { x: M, y: my - 0.18, w: W - 2 * M, h: 0, line: { color: LINE, width: 1 } });
  s.addText("SAM CARTER  ·  carterpinkmusic@gmail.com", { x: M, y: my, w: 8, h: 0.35, margin: 0, fontFace: MONO, fontSize: 10.5, color: MUT, charSpacing: 1.5, valign: "middle" });
  s.addText("QUESTIONS  WELCOME", { x: W - M - 5, y: my, w: 5, h: 0.35, margin: 0, fontFace: MONO, fontSize: 10.5, color: LIME, charSpacing: 2, align: "right", valign: "middle" });
}

const out = path.join(__dirname, "SetRecord_DigitalSolutions.pptx");
p.writeFile({ fileName: out }).then(() => console.log("WROTE", out));
