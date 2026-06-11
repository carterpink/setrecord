// @ts-check
/**
 * Release guard: refuse to ship a non-redistributable ffmpeg.
 *
 * FFmpeg built with `--enable-nonfree` (e.g. libfdk_aac) is, by FFmpeg's own
 * license, UNREDISTRIBUTABLE — it must never appear in a shipped DMG. This runs
 * the bundled binary, reads its build configuration, and:
 *   - FAILS (exit 1) if `--enable-nonfree` is present  → hard legal blocker
 *   - WARNS if `--enable-gpl` is present (still redistributable, but under GPL
 *     with a source-offer obligation; SetRecord targets a clean LGPL build —
 *     see THIRD_PARTY_LICENSES.md)
 *   - PASSES on a clean LGPL build
 *
 * Wired into the release workflow BEFORE build/publish, so an illegal binary can
 * never be notarized and shipped. Run locally: npm run check:ffmpeg
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
/** ffmpeg-static default-exports the absolute path to the binary (or null). */
const ffmpegPath = require('ffmpeg-static')

if (!ffmpegPath) {
  console.error('✗ ffmpeg: no binary resolved for this platform/arch')
  process.exit(1)
}

let version = ''
try {
  version = execFileSync(ffmpegPath, ['-hide_banner', '-version'], { encoding: 'utf8' })
} catch (e) {
  console.error(`✗ ffmpeg: could not run binary at ${ffmpegPath}: ${e?.message ?? e}`)
  process.exit(1)
}

const configLine = version.split('\n').find((l) => l.startsWith('configuration:')) ?? ''

if (/--enable-nonfree/.test(configLine)) {
  console.error(
    '✗ ffmpeg is a --enable-nonfree build — LEGALLY UNREDISTRIBUTABLE.\n' +
      '  This binary must NOT ship. Replace it with an LGPL build (no --enable-nonfree,\n' +
      '  no --enable-gpl). See THIRD_PARTY_LICENSES.md.\n' +
      `  binary: ${ffmpegPath}`
  )
  process.exit(1)
}

if (/--enable-gpl/.test(configLine)) {
  console.warn(
    '⚠ ffmpeg is a --enable-gpl build — redistributable, but under GPL (you must\n' +
      '  offer source). SetRecord targets LGPL; consider an LGPL build to reduce obligations.'
  )
}

console.log('✓ ffmpeg is redistributable (no --enable-nonfree).')
