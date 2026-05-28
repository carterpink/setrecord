import { createRequire } from 'module'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { Resvg } = require('@resvg/resvg-js')

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = path.resolve(__dirname, '..')

// Resolve font directory
const fontFilesDir = path.join(root, 'node_modules/@fontsource/instrument-serif/files')

// Read SVG source
const svgPath = path.join(root, 'resources/icon-source.svg')
const svgStr = fs.readFileSync(svgPath, 'utf8')

// Sizes to render: each value becomes both a standalone PNG and the @2x of the next size down
const SIZES = [16, 32, 64, 128, 256, 512, 1024]

// Mapping: rendered px -> output filenames inside the iconset
// Each render feeds one @1x entry and (for sizes >16) also the @2x of the entry below it
const ICONSET_MAP = {
  16:   ['icon_16x16.png'],
  32:   ['icon_16x16@2x.png', 'icon_32x32.png'],
  64:   ['icon_32x32@2x.png', 'icon_64x64.png'],
  128:  ['icon_64x64@2x.png', 'icon_128x128.png'],
  256:  ['icon_128x128@2x.png', 'icon_256x256.png'],
  512:  ['icon_256x256@2x.png', 'icon_512x512.png'],
  1024: ['icon_512x512@2x.png'],
}

// Prepare output directories
const iconsetDir = path.join(root, 'build/icon.iconset')
const buildDir   = path.join(root, 'build')
fs.mkdirSync(iconsetDir, { recursive: true })

// Render each size and write iconset PNGs
const pngBuffers = {}
for (const size of SIZES) {
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: size },
    font: {
      fontDirs: [fontFilesDir],
      loadSystemFonts: false,
      defaultFontFamily: 'Instrument Serif',
    },
    logLevel: 'off',
  })
  const rendered = resvg.render()
  pngBuffers[size] = rendered.asPng()
  console.log(`[icons] rendered ${size}px`)
}

// Write iconset files
for (const [sizeStr, names] of Object.entries(ICONSET_MAP)) {
  const buf = pngBuffers[Number(sizeStr)]
  for (const name of names) {
    fs.writeFileSync(path.join(iconsetDir, name), buf)
  }
}

// Run iconutil to produce .icns
const icnsOut = path.join(buildDir, 'icon.icns')
execFileSync('iconutil', ['--convert', 'icns', iconsetDir, '--output', icnsOut])
console.log('[icons] iconutil → build/icon.icns')

// Copy 512px PNG to build/icon.png and resources/icon.png
const png512 = pngBuffers[512]
fs.writeFileSync(path.join(buildDir, 'icon.png'), png512)
fs.writeFileSync(path.join(root, 'resources/icon.png'), png512)
console.log('[icons] copied 512px → build/icon.png + resources/icon.png')

// Cleanup iconset temp directory
fs.rmSync(iconsetDir, { recursive: true, force: true })
