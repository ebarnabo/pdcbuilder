import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

let win = null
let snapshot = {
  status: 'idle',
  current: '0.0.0',
  version: null,
  percent: 0,
  error: null,
  packaged: false
}

function emit() {
  if (win && !win.isDestroyed()) win.webContents.send('app:update', getSnapshot())
}

export function getSnapshot() {
  return {
    ...snapshot,
    current: app.getVersion(),
    packaged: app.isPackaged
  }
}

export function attach(browserWindow) {
  win = browserWindow
  emit()
}

export function start() {
  snapshot.current = app.getVersion()
  snapshot.packaged = app.isPackaged

  if (!app.isPackaged) {
    snapshot.status = 'dev'
    emit()
    return
  }

  autoUpdater.logger = {
    info: (...a) => console.log('[updater]', ...a),
    warn: (...a) => console.warn('[updater]', ...a),
    error: (...a) => console.error('[updater]', ...a),
    debug: (...a) => console.log('[updater]', ...a)
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    snapshot.status = 'checking'
    snapshot.error = null
    emit()
  })
  autoUpdater.on('update-available', (info) => {
    snapshot.status = 'downloading'
    snapshot.version = info.version
    snapshot.percent = 0
    emit()
  })
  autoUpdater.on('update-not-available', () => {
    snapshot.status = 'none'
    snapshot.version = null
    emit()
  })
  autoUpdater.on('download-progress', (progress) => {
    snapshot.status = 'downloading'
    snapshot.percent = progress.percent || 0
    emit()
  })
  autoUpdater.on('update-downloaded', (info) => {
    snapshot.status = 'ready'
    snapshot.version = info.version
    snapshot.percent = 100
    emit()
  })
  autoUpdater.on('error', (err) => {
    snapshot.status = 'error'
    snapshot.error = err?.message || String(err)
    emit()
  })

  check()
  setInterval(check, 4 * 60 * 60 * 1000)
}

export function check() {
  if (!app.isPackaged) {
    snapshot.status = 'dev'
    emit()
    return getSnapshot()
  }
  autoUpdater.checkForUpdates().catch((err) => {
    snapshot.status = 'error'
    snapshot.error = err?.message || String(err)
    emit()
  })
  return getSnapshot()
}

export function install() {
  if (snapshot.status !== 'ready') return { ok: false, error: 'Aucune mise à jour prête.' }
  setTimeout(() => autoUpdater.quitAndInstall(false, true), 120)
  return { ok: true }
}
