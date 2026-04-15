import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import path from 'path'
import http from 'http'
import fs from 'fs'
import { hasBattleData, shouldSuppressTransientCombatState, type SnapshotLike } from './state-stability'

const STS2_API = 'http://localhost:15526'
const CODEX_API = 'https://spire-codex.com'
const CODEX_CACHE_DIR = path.join(app.getPath('userData'), 'codex-cache')
const CODEX_CACHE_FILE = path.join(CODEX_CACHE_DIR, 'codex.json')
const CODEX_CACHE_META = path.join(CODEX_CACHE_DIR, 'meta.json')
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

let mainWindow: BrowserWindow | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null
let isConnected = false
let lastStateHash = ''
let lastEmittedState: SnapshotLike | null = null
let currentPollRate = 5000 // start slow

function registerCombatShortcuts() {
  globalShortcut.unregister('F6')
  globalShortcut.unregister('F7')

  globalShortcut.register('F6', () => {
    mainWindow?.webContents.send('combat-shortcut', 'cycle-line')
  })

  globalShortcut.register('F7', () => {
    mainWindow?.webContents.send('combat-shortcut', 'cycle-build')
  })
}

function createWindow() {
  const { bounds } = screen.getPrimaryDisplay()

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.setIgnoreMouseEvents(true, { forward: true })
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// Adaptive polling: adjust rate based on game state type
function getPollRate(stateType: string | undefined): number {
  if (!isConnected) return 5000
  if (!stateType) return 3000
  if (['monster', 'elite', 'boss'].includes(stateType)) return 200
  if (['map', 'card_reward', 'relic_select', 'event', 'shop', 'fake_merchant'].includes(stateType)) return 1500
  return 3000
}

function fetchGameState() {
  const req = http.get(`${STS2_API}/api/v1/singleplayer?format=json`, (res) => {
    let data = ''
    res.on('data', (chunk) => { data += chunk })
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data) as SnapshotLike

        if (shouldSuppressTransientCombatState(lastEmittedState, parsed)) {
          return
        }

        const hash = JSON.stringify(parsed)

        if (!isConnected) {
          isConnected = true
          // Only emit connection change on first successful connect (or reconnect)
          mainWindow?.webContents.send('connection-change', true)
        }

        if (hash !== lastStateHash) {
          lastStateHash = hash
          lastEmittedState = parsed
          mainWindow?.webContents.send('game-state-update', parsed)
        }

        // Adjust poll rate based on state type
        const newRate = hasBattleData(parsed) ? 200 : getPollRate(parsed.state_type)
        if (newRate !== currentPollRate) {
          currentPollRate = newRate
          restartPoller()
          // Fetch immediately when switching to a faster rate (e.g., entering combat)
          // so the UI doesn't wait a full interval for the first fast update
          if (newRate < 1500) {
            fetchGameState()
          }
        }
      } catch {
        // ignore parse errors
      }
    })
  })

  req.on('error', () => {
    if (isConnected) {
      isConnected = false
      lastStateHash = ''
      lastEmittedState = null
      mainWindow?.webContents.send('connection-change', false)
      currentPollRate = 5000
      restartPoller()
    }
  })

  req.setTimeout(2000, () => req.destroy())
}

function restartPoller() {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
  pollInterval = setInterval(fetchGameState, currentPollRate)
}

// Codex cache management
async function ensureCacheDir() {
  if (!fs.existsSync(CODEX_CACHE_DIR)) {
    fs.mkdirSync(CODEX_CACHE_DIR, { recursive: true })
  }
}

function isCacheStale(): boolean {
  if (!fs.existsSync(CODEX_CACHE_META)) return true
  try {
    const meta = JSON.parse(fs.readFileSync(CODEX_CACHE_META, 'utf-8'))
    return Date.now() - meta.fetchedAt > CACHE_MAX_AGE_MS
  } catch {
    return true
  }
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const https = require('https')
    const req = https.get(url, (res: http.IncomingMessage) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => req.destroy())
  })
}

const CODEX_ENDPOINTS = [
  'cards', 'relics', 'potions', 'monsters', 'powers',
  'encounters', 'events', 'keywords', 'enchantments',
  'orbs', 'afflictions', 'ancient-pools', 'acts',
  'ascensions', 'characters', 'epochs',
]

async function fetchCodexData(): Promise<Record<string, unknown>> {
  const codex: Record<string, unknown> = {}
  for (const endpoint of CODEX_ENDPOINTS) {
    try {
      const raw = await httpsGet(`${CODEX_API}/api/${endpoint}`)
      codex[endpoint] = JSON.parse(raw)
      // small delay to respect rate limit
      await new Promise(r => setTimeout(r, 500))
    } catch {
      codex[endpoint] = []
    }
  }
  return codex
}

async function loadCodex(): Promise<Record<string, unknown>> {
  await ensureCacheDir()

  if (!isCacheStale() && fs.existsSync(CODEX_CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CODEX_CACHE_FILE, 'utf-8'))
    } catch {
      // fall through to fetch
    }
  }

  const data = await fetchCodexData()
  fs.writeFileSync(CODEX_CACHE_FILE, JSON.stringify(data))
  fs.writeFileSync(CODEX_CACHE_META, JSON.stringify({ fetchedAt: Date.now() }))
  return data
}

// IPC handlers
ipcMain.handle('get-codex-data', async () => {
  return await loadCodex()
})

ipcMain.handle('get-bridge-snapshot', async () => ({
  connected: isConnected,
  state: lastEmittedState,
}))

ipcMain.on('set-interactive', (_event, interactive: boolean) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(!interactive, { forward: true })
    if (interactive) mainWindow.setFocusable(true)
    else mainWindow.setFocusable(false)
  }
})

app.whenReady().then(() => {
  createWindow()
  registerCombatShortcuts()
  restartPoller()
  fetchGameState()
})

app.on('window-all-closed', () => {
  if (pollInterval) clearInterval(pollInterval)
  app.quit()
})

app.on('will-quit', () => {
  if (pollInterval) clearInterval(pollInterval)
  globalShortcut.unregisterAll()
})
