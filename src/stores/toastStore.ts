import { create } from 'zustand'

export type ToastKind = 'success' | 'info' | 'warning' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  kind: ToastKind
  message: string
  durationMs: number
  /** When present, the toast renders an inline picker to move a just-added track to another set. */
  setMove?: { trackId: string; fromSetId: string }
  /** Optional single action button (e.g. "Undo"). Dismisses the toast when clicked. */
  action?: ToastAction
}

interface ToastState {
  toasts: Toast[]
  push: (input: {
    kind?: ToastKind
    message: string
    durationMs?: number
    setMove?: { trackId: string; fromSetId: string }
    action?: ToastAction
  }) => void
  dismiss: (id: string) => void
  success: (message: string, durationMs?: number) => void
  error: (message: string, durationMs?: number) => void
  info: (message: string, durationMs?: number) => void
  warning: (message: string, durationMs?: number) => void
}

const MAX_TOASTS = 4
const DEFAULT_DURATION = 4000

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ kind = 'info', message, durationMs = DEFAULT_DURATION, setMove, action }) => {
    const id = crypto.randomUUID()
    set((s) => {
      const next = [...s.toasts, { id, kind, message, durationMs, setMove, action }]
      // Drop oldest if we exceed the cap
      return { toasts: next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next }
    })
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  success: (message, durationMs) =>
    useToastStore.getState().push({ kind: 'success', message, durationMs }),
  error: (message, durationMs) =>
    useToastStore.getState().push({ kind: 'error', message, durationMs }),
  info: (message, durationMs) =>
    useToastStore.getState().push({ kind: 'info', message, durationMs }),
  warning: (message, durationMs) =>
    useToastStore.getState().push({ kind: 'warning', message, durationMs })
}))
