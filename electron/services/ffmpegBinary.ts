import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import ffmpegStaticPath from 'ffmpeg-static'

/**
 * Absolute path to the ffmpeg binary SetRecord spawns to decode audio (energy
 * analysis, fingerprinting) and extract embedded artwork.
 *
 * Resolution order:
 *  1. The vendored, REDISTRIBUTABLE LGPL build at resources/ffmpeg/ffmpeg — built
 *     by scripts/build-ffmpeg-lgpl.sh and bundled via electron-builder
 *     extraResources (→ <Resources>/ffmpeg/ffmpeg in the packaged app). This is
 *     what ships.
 *  2. ffmpeg-static's prebuilt binary — DEV ONLY. That build is --enable-nonfree
 *     (legally unredistributable) and its binary is excluded from the packaged
 *     app (see electron-builder.yml `files`), so this fallback only ever fires in
 *     `npm run dev` before `npm run build:ffmpeg` has produced the vendored copy.
 *     The release guard (npm run check:ffmpeg) blocks shipping the nonfree build.
 *
 * `null` when neither is available (ffmpeg-static is typed `any`, hence the cast).
 */
function resolveVendored(): string | null {
  try {
    if (app.isPackaged) {
      const p = join(process.resourcesPath, 'ffmpeg', 'ffmpeg')
      return existsSync(p) ? p : null
    }
    const candidates = [
      join(app.getAppPath(), 'resources', 'ffmpeg', 'ffmpeg'),
      join(process.cwd(), 'resources', 'ffmpeg', 'ffmpeg')
    ]
    return candidates.find((p) => existsSync(p)) ?? null
  } catch {
    return null
  }
}

function resolveDevFallback(): string | null {
  const raw = (ffmpegStaticPath as unknown as string | null) ?? null
  // The binary is asar-unpacked in dev only; rewrite is a no-op outside a package.
  return raw ? raw.replace('app.asar', 'app.asar.unpacked') : null
}

export const FFMPEG_BIN: string | null = resolveVendored() ?? resolveDevFallback()
