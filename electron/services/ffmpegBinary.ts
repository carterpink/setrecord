import ffmpegPath from 'ffmpeg-static'

/**
 * Absolute path to the bundled ffmpeg binary, corrected for Electron packaging.
 *
 * ffmpeg-static resolves the binary relative to its own `__dirname`. In a
 * packaged build that sits *inside* `app.asar`, and a binary inside an asar
 * archive cannot be spawned (`child_process` needs a real on-disk path).
 * electron-builder unpacks `node_modules/ffmpeg-static/**` to `app.asar.unpacked`
 * (see asarUnpack in electron-builder.yml), so we rewrite the path to the real
 * on-disk copy. The replace is a no-op in dev (no `app.asar` segment) and the
 * value is `null` when ffmpeg-static has no binary for this platform/arch.
 *
 * ffmpeg-static is typed as `any`, so the cast keeps strict-null handling honest.
 */
const raw = (ffmpegPath as unknown as string | null) ?? null

export const FFMPEG_BIN: string | null = raw
  ? raw.replace('app.asar', 'app.asar.unpacked')
  : null
