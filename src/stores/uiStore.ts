import { create } from 'zustand'

type ModalName = 'import' | 'architect' | 'cueEditor' | 'validate' | 'export'

interface UIState {
  openModal: ModalName | null
  showModal: (name: ModalName) => void
  closeModal: () => void
  smartFilter: boolean
  toggleSmartFilter: () => void
}

export const useUiStore = create<UIState>((set) => ({
  openModal: null,
  showModal: (name) => set({ openModal: name }),
  closeModal: () => set({ openModal: null }),
  smartFilter: false,
  toggleSmartFilter: () => set((s) => ({ smartFilter: !s.smartFilter })),
}))
