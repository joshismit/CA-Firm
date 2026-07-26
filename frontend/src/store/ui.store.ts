// Global UI state that must survive route changes (sidebar collapsed, command-menu open) - not server state.
// AppLayout currently manages sidebar-collapsed as local useState; this store is for cross-component
// cases that local state can't cover (e.g. a future Cmd+K command palette).

import { create } from 'zustand'

interface UiState {
  sidebarCollapsed: boolean
  commandMenuOpen: boolean
  toggleSidebar: () => void
  setCommandMenuOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  commandMenuOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandMenuOpen: (open) => set({ commandMenuOpen: open }),
}))
