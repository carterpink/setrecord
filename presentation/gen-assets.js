// Generates the "grit" visual-identity assets for the deck:
//   - soft neon grain-blooms (lime / cyan / magenta / violet)
//   - a faint film-grain overlay tile
//   - rasterised feature icons in the neon palette
// All output lands in ./assets as PNG (base64-friendly for PptxGenJS).

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const React = require("react");
const ReactDOMServer = require("react-dom/server");

const OUT = path.join(__dirname, "assets");
fs.mkdirSync(OUT, { recursive: true });

// ---- Neon palette (from src/styles/tokens.css) ----
const HUES = {
  lime: "207,255,4",
  cyan: "79,215,255",
  magenta: "240,70,170",
  violet: "150,104,250",
  mint: "94,234,212",
};

// A grain-bloom: radial neon glow with a stippled grain feel, fully transparent edge.
function bloomSvg(rgb, size = 900) {
  const c = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="g" cx="50%" cy="50%" r="50%">
        <stop offset="0%"  stop-color="rgb(${rgb})" stop-opacity="0.92"/>
        <stop offset="32%" stop-color="rgb(${rgb})" stop-opacity="0.55"/>
        <stop offset="62%" stop-color="rgb(${rgb})" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="rgb(${rgb})" stop-opacity="0"/>
      </radialGradient>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0"/>
        <feComposite operator="in" in2="SourceGraphic"/>
      </filter>
    </defs>
    <circle cx="${c}" cy="${c}" r="${c}" fill="url(#g)"/>
    <circle cx="${c}" cy="${c}" r="${c}" fill="url(#g)" filter="url(#grain)" opacity="0.35"/>
  </svg>`;
}

// Faint monochrome film grain, tiled across a slide.
function grainSvg(w = 1280, h = 720) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="11" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0"/>
    </filter>
    <rect width="100%" height="100%" fill="black"/>
    <rect width="100%" height="100%" filter="url(#n)" opacity="0.5"/>
  </svg>`;
}

async function main() {
  for (const [name, rgb] of Object.entries(HUES)) {
    await sharp(Buffer.from(bloomSvg(rgb))).png({ compressionLevel: 9, quality: 90, effort: 9 }).toFile(path.join(OUT, `bloom-${name}.png`));
  }
  // grain is monochrome noise — a palette PNG is tiny and visually identical at low opacity
  await sharp(Buffer.from(grainSvg())).png({ palette: true, colors: 64, compressionLevel: 9 }).toFile(path.join(OUT, "grain.png"));

  // ---- Feature icons (react-icons -> PNG) ----
  const FA = require("react-icons/fa6");
  const icons = {
    "icon-disc": [FA.FaCompactDisc, HUES.lime],
    "icon-brain": [FA.FaBrain, HUES.violet],
    "icon-shield": [FA.FaShieldHalved, HUES.cyan],
    "icon-wave": [FA.FaWaveSquare, HUES.magenta],
    "icon-layers": [FA.FaLayerGroup, HUES.lime],
    "icon-bolt": [FA.FaBolt, HUES.lime],
    "icon-lock": [FA.FaLock, HUES.cyan],
    "icon-exchange": [FA.FaRightLeft, HUES.mint],
    "icon-key": [FA.FaKey, HUES.violet],
    "icon-users": [FA.FaUsers, HUES.cyan],
    "icon-flask": [FA.FaFlask, HUES.magenta],
    "icon-check": [FA.FaCircleCheck, HUES.lime],
    "icon-gauge": [FA.FaGaugeHigh, HUES.cyan],
    "icon-usb": [FA.FaUsb, HUES.lime],
    "icon-eye": [FA.FaEyeSlash, HUES.violet],
    "icon-code": [FA.FaCode, HUES.mint],
    "icon-music": [FA.FaMusic, HUES.lime],
    "icon-database": [FA.FaDatabase, HUES.cyan],
    "icon-play": [FA.FaPlay, HUES.lime],
    "icon-route": [FA.FaRoute, HUES.magenta],
    "icon-scale": [FA.FaScaleBalanced, HUES.violet],
    "icon-rocket": [FA.FaRocket, HUES.lime],
    "icon-arrow": [FA.FaArrowRightLong, HUES.lime],
    "icon-microscope": [FA.FaMicroscope, HUES.cyan],
    "icon-pen": [FA.FaPenRuler, HUES.magenta],
    "icon-gears": [FA.FaGears, HUES.violet],
  };
  for (const [file, [Comp, rgb]] of Object.entries(icons)) {
    if (!Comp) { console.log("MISSING ICON", file); continue; }
    const svg = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Comp, { color: `rgb(${rgb})`, size: "256" })
    );
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${file}.png`));
  }

  console.log("assets written:", fs.readdirSync(OUT).length, "files");
}
main().catch((e) => { console.error(e); process.exit(1); });
