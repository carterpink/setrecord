/** Persisted choice of which audio input feeds SetSense Live. */
const KEY = 'ss-live-input-device'

export function getPreferredInputId(): string | undefined {
  try {
    return localStorage.getItem(KEY) || undefined
  } catch {
    return undefined
  }
}

export function setPreferredInputId(id: string | undefined): void {
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    // ignore storage failures
  }
}
