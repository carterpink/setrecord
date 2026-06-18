/**
 * fetch-model.mjs — build-time fetch of the on-device models.
 *
 * Downloads both local models into resources/models/ so electron-builder can
 * bundle them via `extraResources` (see electron-builder.yml). This is what
 * makes the offline features work from first launch with no in-app download:
 *
 *   1. The Recall language model — Qwen GGUF (~1.9 GB) — "Extended understanding".
 *   2. The voice model — whisper.cpp ggml-base.en (~142 MB) — offline voice input
 *      (FR-705). Without this bundled, transcribeService falls back to a one-time
 *      runtime download, which breaks the offline-from-first-launch promise.
 *
 * Idempotent: skips any file already present. Both files are git-ignored (too
 * large to commit) — run this before packaging (wired into build:mac / build:unpack).
 *
 * The URIs/filenames MUST stay in sync with:
 *   - electron/services/memoryAssistant.ts        (Qwen)
 *   - electron/services/speech/transcribeService.ts (whisper)
 */
import { createModelDownloader } from 'node-llama-cpp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const LLM_MODEL_URI = 'hf:Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M'
const LLM_MODEL_FILENAME = 'qwen2.5-3b-instruct-q4_k_m.gguf'

const VOICE_MODEL_FILENAME = 'ggml-base.en.bin'
const VOICE_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = path.resolve(__dirname, '..')
const dir = path.join(root, 'resources', 'models')

fs.mkdirSync(dir, { recursive: true })

/** True when the file exists and is non-empty. */
function present(target) {
  return fs.existsSync(target) && fs.statSync(target).size > 0
}

async function fetchLlm() {
  const target = path.join(dir, LLM_MODEL_FILENAME)
  if (present(target)) {
    console.log(`✓ Recall model already present: ${target}`)
    return
  }
  console.log(`Downloading ${LLM_MODEL_FILENAME} (~1.9 GB) into ${dir} …`)
  const downloader = await createModelDownloader({
    modelUri: LLM_MODEL_URI,
    dirPath: dir,
    fileName: LLM_MODEL_FILENAME,
    onProgress: ({ totalSize, downloadedSize }) => {
      const pct = totalSize > 0 ? ((downloadedSize / totalSize) * 100).toFixed(1) : '0.0'
      process.stdout.write(`\r  ${pct}%   `)
    }
  })
  await downloader.download()
  process.stdout.write('\n')
  console.log(`✓ Recall model ready: ${target}`)
}

async function fetchVoice() {
  const target = path.join(dir, VOICE_MODEL_FILENAME)
  if (present(target)) {
    console.log(`✓ Voice model already present: ${target}`)
    return
  }
  console.log(`Downloading ${VOICE_MODEL_FILENAME} (~142 MB) into ${dir} …`)
  const res = await fetch(VOICE_MODEL_URL)
  if (!res.ok || !res.body) throw new Error(`voice model download failed: ${res.status}`)
  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0
  const progress = new TransformStream({
    transform(chunk, controller) {
      received += chunk.length
      if (total > 0) {
        const pct = ((received / total) * 100).toFixed(1)
        process.stdout.write(`\r  ${pct}%   `)
      }
      controller.enqueue(chunk)
    }
  })
  // Write to a temp file then rename, so an interrupted download never leaves a
  // truncated model that looks "present" on the next run.
  const tmp = `${target}.partial`
  await pipeline(Readable.fromWeb(res.body.pipeThrough(progress)), fs.createWriteStream(tmp))
  fs.renameSync(tmp, target)
  process.stdout.write('\n')
  console.log(`✓ Voice model ready: ${target}`)
}

await fetchLlm()
await fetchVoice()
