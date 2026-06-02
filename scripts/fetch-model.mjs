/**
 * fetch-model.mjs — build-time fetch of the Recall language model.
 *
 * Downloads the Qwen GGUF (≈1.9 GB) into resources/models/ so electron-builder
 * can bundle it into the app (see `extraResources` in electron-builder.yml).
 * This is what makes "Extended understanding" work offline from first launch
 * with no in-app download. Idempotent: skips if the file is already present.
 *
 * The URI/filename MUST stay in sync with electron/services/memoryAssistant.ts.
 * The file is git-ignored (too large to commit) — run this before packaging.
 */
import { createModelDownloader } from 'node-llama-cpp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const MODEL_URI = 'hf:Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M'
const MODEL_FILENAME = 'qwen2.5-3b-instruct-q4_k_m.gguf'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = path.resolve(__dirname, '..')
const dir = path.join(root, 'resources', 'models')
const target = path.join(dir, MODEL_FILENAME)

if (fs.existsSync(target) && fs.statSync(target).size > 0) {
  console.log(`✓ Model already present: ${target}`)
  process.exit(0)
}

fs.mkdirSync(dir, { recursive: true })
console.log(`Downloading ${MODEL_FILENAME} (~1.9 GB) into ${dir} …`)

const downloader = await createModelDownloader({
  modelUri: MODEL_URI,
  dirPath: dir,
  fileName: MODEL_FILENAME,
  onProgress: ({ totalSize, downloadedSize }) => {
    const pct = totalSize > 0 ? ((downloadedSize / totalSize) * 100).toFixed(1) : '0.0'
    process.stdout.write(`\r  ${pct}%   `)
  }
})

await downloader.download()
process.stdout.write('\n')
console.log(`✓ Model ready: ${target}`)
