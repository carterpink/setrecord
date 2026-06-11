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
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Resolve which binary to vet, in priority order:
 *   1. --bin <path> CLI arg (used by the build script to self-verify)
 *   2. the vendored clean LGPL binary at resources/ffmpeg/ffmpeg (what SHIPS)
 *   3. ffmpeg-static's prebuilt (dev fallback — the nonfree one we're replacing)
 */
function resolveTarget() {
  const argIdx = process.argv.indexOf('--bin')
  if (argIdx !== -1 && process.argv[argIdx + 1]) return process.argv[argIdx + 1]

  const vendored = path.join(root, 'resources', 'ffmpeg', 'ffmpeg')
  if (existsSync(vendored)) return vendored

  try {
    return require('ffmpeg-static')
  } catch {
    return null
  }
}

const ffmpegPath = resolveTarget()

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
