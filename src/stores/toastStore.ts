import { create } from 'zustand'

export type ToastKind = 'success' | 'info' | 'warning' | 'error'

export interface Toast {
  id: string
  kind: ToastKind
  message: string
  durationMs: number
}

interface ToastState {
  toasts: Toast[]
  push: (input: { kind?: ToastKind; message: string; durationMs?: number }) => void
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
  push: ({ kind = 'info', message, durationMs = DEFAULT_DURATION }) => {
    const id = crypto.randomUUID()
    set((s) => {
      const next = [...s.toasts, { id, kind, message, durationMs }]
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
    useToastStore.getState().push({ kind: 'warning', message, durationMs }),
}))
