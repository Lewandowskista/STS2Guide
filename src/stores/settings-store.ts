import { create } from 'zustand'

interface SettingsStore {
  overlayOpacity: number
  showCombatPanel: boolean
  showCardRewardPanel: boolean
  showMapPanel: boolean
  showRelicPanel: boolean
  showEventPanel: boolean
  showShopPanel: boolean
  isDeckPanelOpen: boolean
  panelSide: 'left' | 'right'
  setOverlayOpacity: (opacity: number) => void
  togglePanel: (panel: string, value?: boolean) => void
  toggleDeckPanel: () => void
  setPanelSide: (side: 'left' | 'right') => void
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  overlayOpacity: 0.92,
  showCombatPanel: true,
  showCardRewardPanel: true,
  showMapPanel: true,
  showRelicPanel: true,
  showEventPanel: true,
  showShopPanel: true,
  isDeckPanelOpen: false,
  panelSide: 'right',

  setOverlayOpacity: (opacity) => set({ overlayOpacity: opacity }),
  togglePanel: (panel, value) => {
    const key = `show${panel.charAt(0).toUpperCase()}${panel.slice(1)}Panel` as keyof SettingsStore
    const current = get()[key] as boolean
    set({ [key]: value !== undefined ? value : !current })
  },
  toggleDeckPanel: () => set((s) => ({ isDeckPanelOpen: !s.isDeckPanelOpen })),
  setPanelSide: (side) => set({ panelSide: side }),
}))
