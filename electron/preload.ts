import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('stsApi', {
  onStateUpdate: (callback: (state: unknown) => void) => {
    ipcRenderer.on('game-state-update', (_event, state) => callback(state))
    return () => ipcRenderer.removeAllListeners('game-state-update')
  },
  onConnectionChange: (callback: (connected: boolean) => void) => {
    ipcRenderer.on('connection-change', (_event, connected) => callback(connected))
    return () => ipcRenderer.removeAllListeners('connection-change')
  },
  getCodexData: () => ipcRenderer.invoke('get-codex-data'),
  getBridgeSnapshot: () => ipcRenderer.invoke('get-bridge-snapshot'),
  setInteractive: (interactive: boolean) => ipcRenderer.send('set-interactive', interactive),
  onCombatShortcut: (callback: (action: 'cycle-line' | 'cycle-build') => void) => {
    ipcRenderer.on('combat-shortcut', (_event, action) => callback(action))
    return () => ipcRenderer.removeAllListeners('combat-shortcut')
  },
})
