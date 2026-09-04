import { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme } from 'electron'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { platform, homedir } from 'os'
import * as store from './store.js'
import * as runner from './runner.js'
import * as ai from './ai.js'
import * as git from './git.js'
import * as updater from './updater.js'
import * as docs from './docs.js'
import * as preferences from './preferences.js'
import * as database from './database.js'
import * as dbcloud from './dbcloud.js'
import * as pm from './pm.js'
import * as toolchain from './toolchain.js'
import * as scan from './scan.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isMac = platform() === 'darwin'
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
let win = null

function resolveAppIcon() {
  const names = isMac
    ? ['icon.icns', 'icon.png', 'logo-pdc.jpg']
    : ['icon.ico', 'icon.png', 'logo-pdc.jpg']
  const roots = [
    join(__dirname, '../../resources'),
    join(process.resourcesPath || '', 'resources'),
    join(app.getAppPath(), 'resources')
  ]
  for (const root of roots) {
    for (const name of names) {
      const candidate = join(root, name)
      if (existsSync(candidate)) return candidate
    }
  }
  return undefined
}

function resolvePreload() {
  const dir = join(__dirname, '../preload')
  for (const name of ['index.cjs', 'index.mjs', 'index.js']) {
    const candidate = join(dir, name)
    if (existsSync(candidate)) return candidate
  }
  return join(dir, 'index.cjs')
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const slug = (s) =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projet'

function cleanupBrokenScaffold(path) {
  if (!existsSync(path) || existsSync(join(path, 'package.json'))) return
  try { rmSync(path, { recursive: true, force: true }) } catch { /* ignore */ }
}

function patchProject(id, fields) {
  const s = store.read()
  store.patch({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...fields } : p)) })
}

let syncingRepos = false

async function syncAllRepos({ notify = true, onlyMissing = false } = {}) {
  if (syncingRepos) return
  syncingRepos = true
  try {
    const s = store.read()
    let changed = false
    const projects = []
    for (const p of s.projects) {
      if (!p?.path || !existsSync(p.path)) {
        projects.push(p)
        continue
      }
      if (onlyMissing && p.repo?.remote) {
        projects.push(p)
        continue
      }
      const detected = await git.detectRepo(p.path)
      if (!detected) {
        projects.push(p)
        continue
      }
      if (p.repo && git.sameRepo(p.repo, detected)) {
        projects.push(p)
        continue
      }
      changed = true
      projects.push({ ...p, repo: detected })
    }
    if (changed) {
      store.patch({ projects })
      if (notify && win && !win.isDestroyed()) win.webContents.send('project:changed')
    }
  } finally {
    syncingRepos = false
  }
}

async function installProjectDeps(projectId, root, pmId, label = 'dépendances') {
  const cmd = pm.installForPath(root, pmId)
  return runner.exec(win, projectId, cmd, root, label)
}

async function ensureProjectReady(projectId, projectPath) {
  const s = store.read()
  const pmId = s.packageManager || 'npm'
  let root = pm.resolveProjectRoot(projectPath)

  if (!root) {
    return {
      ok: false,
      error: 'package.json introuvable. Le projet n’a pas été généré correctement — supprime-le et recrée-le, ou consulte la console de création.'
    }
  }

  if (root !== projectPath) {
    patchProject(projectId, { path: root })
    runner.log(win, projectId, `racine détectée : ${root}`, 'meta')
  }

  if (pm.needsInstall(root)) {
    const res = await installProjectDeps(projectId, root, pmId)
    if (!res.ok) {
      return { ok: false, error: res.stderr || 'L’installation des dépendances a échoué.' }
    }
  }

  return { ok: true, path: root }
}

function createWindow() {
  const preload = resolvePreload()
  const icon = resolveAppIcon()
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    backgroundColor: '#16130f',
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    titleBarOverlay: false,
    vibrancy: isMac ? 'under-window' : undefined,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload,
      sandbox: false,
      contextIsolation: true
    }
  })

  if (icon && process.platform === 'win32') {
    try { win.setIcon(icon) } catch { /* ignore */ }
  }

  const reveal = () => { if (win && !win.isDestroyed() && !win.isVisible()) win.show() }
  win.once('ready-to-show', reveal)
  setTimeout(reveal, 1500)

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[pdc] chargement échoué', { code, desc, url })
    reveal()
  })
  win.webContents.on('preload-error', (_e, path, error) => {
    console.error('[pdc] preload', path, error)
  })
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) console.error('[renderer]', message, sourceId ? `(${sourceId}:${line})` : '')
  })
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      event.preventDefault()
      win.webContents.toggleDevTools()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const sendMax = () => {
    if (win && !win.isDestroyed()) win.webContents.send('window:maximized', win.isMaximized())
  }
  win.on('maximize', sendMax)
  win.on('unmaximize', sendMax)

  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  updater.attach(win)
}

nativeTheme.themeSource = 'dark'

ipcMain.handle('window:minimize', () => { win?.minimize(); return { ok: true } })
ipcMain.handle('window:toggle-max', () => {
  if (!win || win.isDestroyed()) return { ok: false }
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
  return { ok: true, maximized: win.isMaximized() }
})
ipcMain.handle('window:close', () => { win?.close(); return { ok: true } })
ipcMain.handle('window:is-maximized', () => Boolean(win && !win.isDestroyed() && win.isMaximized()))

app.whenReady().then(() => {
  if (!isMac) app.setAppUserModelId('com.pdcdesign.builder')
  const icon = resolveAppIcon()
  if (icon && isMac && app.dock) {
    try { app.dock.setIcon(icon) } catch { /* ignore */ }
  }
  createWindow()
  updater.attach(win)
  updater.start()
  docs.start({
    getLibraries: () => store.read().libraries,
    getProjects: () => store.read().projects,
    onStatus: (snap) => {
      if (win && !win.isDestroyed()) win.webContents.send('docs:status', snap)
    }
  })
  try { preferences.sync(store.read()) } catch { /* ignore */ }
  syncAllRepos({ notify: false, onlyMissing: false }).catch(() => {})
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { runner.stopAll(); if (!isMac) app.quit() })
app.on('before-quit', () => runner.stopAll())

/* ─────────────────────────  état  ───────────────────────── */

ipcMain.handle('state:get', () => {
  const s = store.read()
  syncAllRepos({ notify: true, onlyMissing: true }).catch(() => {})
  return {
    ...s,
    projects: s.projects.map((p) => ({
      ...p,
      exists: p.remoteOnly ? false : existsSync(p.path),
      remoteOnly: Boolean(p.remoteOnly),
      ...runner.devState(p.id)
    }))
  }
})
ipcMain.handle('state:patch', (_e, fields) => {
  const before = new Set(store.read().libraries.flatMap((c) => (c.items || []).map((i) => i.pkg)))
  const next = store.patch(fields)
  if (fields.libraries) {
    const indexed = new Set((docs.listIndex().packages || []).map((p) => p.pkg))
    for (const pkg of next.libraries.flatMap((c) => (c.items || []).map((i) => i.pkg))) {
      if (!before.has(pkg) || !indexed.has(pkg)) docs.enqueue(pkg)
    }
  }
  return next
})
ipcMain.handle('state:reset-catalog', () => store.patch({
  frameworks: store.DEFAULT_FRAMEWORKS,
  libraries: store.DEFAULT_LIBRARIES
}))

ipcMain.handle('pm:status', async () => {
  const s = store.read()
  return pm.status(s.packageManager || 'npm')
})
ipcMain.handle('pm:install', async (_e, id) => {
  const cmd = pm.globalInstallCommand(id)
  if (!cmd) return { ok: false, error: 'Ce gestionnaire est déjà inclus ou inconnu.' }
  return runner.exec(win, 'system', cmd, homedir(), `installation — ${id}`)
})
ipcMain.handle('pm:update', async (_e, id) => {
  const cmd = pm.globalUpdateCommand(id)
  if (!cmd) return { ok: false, error: 'Mise à jour indisponible pour ce gestionnaire.' }
  const label = id === 'npm' ? 'mise à jour — npm' : `mise à jour — ${id}`
  return runner.exec(win, 'system', cmd, homedir(), label)
})
ipcMain.handle('pm:update-all', async () => {
  const s = store.read()
  const st = await pm.status(s.packageManager || 'npm')
  const targets = (st.managers || []).filter((m) => m.outdated && m.updateGlobal)
  if (!targets.length) return { ok: true, updated: 0, skipped: true }
  const results = []
  for (const m of targets) {
    const cmd = pm.globalUpdateCommand(m.id)
    const r = await runner.exec(win, 'system', cmd, homedir(), `mise à jour — ${m.id}`)
    results.push({ id: m.id, ok: r.ok, error: r.error || r.stderr || null })
    if (!r.ok) return { ok: false, updated: results.filter((x) => x.ok).length, results, error: r.error || r.stderr || `Échec sur ${m.name}` }
  }
  return { ok: true, updated: results.length, results }
})

ipcMain.handle('toolchain:status', async () => toolchain.status())
ipcMain.handle('toolchain:install', async (_e, id) => {
  const cmd = toolchain.installCommand(id)
  if (!cmd) return { ok: false, error: 'Installation indisponible pour cet outil sur cette plateforme.' }
  return runner.exec(win, 'system', cmd, homedir(), `installation — ${toolchain.labelFor(id)}`)
})
ipcMain.handle('toolchain:uninstall', async (_e, id) => {
  const cmd = toolchain.uninstallCommand(id)
  if (!cmd) return { ok: false, error: 'Désinstallation indisponible pour cet outil sur cette plateforme.' }
  return runner.exec(win, 'system', cmd, homedir(), `désinstallation — ${toolchain.labelFor(id)}`)
})
ipcMain.handle('toolchain:update', async (_e, id) => {
  const cmd = toolchain.updateCommand(id)
  if (!cmd) return { ok: false, error: 'Mise à jour indisponible pour cet outil.' }
  return runner.exec(win, 'system', cmd, homedir(), `mise à jour — ${toolchain.labelFor(id)}`)
})

/* ─────────────────────  système de fichiers  ───────────────────── */

ipcMain.handle('fs:pick-dir', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('fs:open-path', (_e, p) => shell.openPath(p))
ipcMain.handle('fs:reveal', (_e, p) => shell.showItemInFolder(p))
ipcMain.handle('fs:open-url', (_e, u) => shell.openExternal(u))
ipcMain.handle('fs:exists', (_e, p) => existsSync(p))
ipcMain.handle('fs:write', (_e, { path, content }) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
  return { ok: true }
})
ipcMain.handle('fs:read', (_e, path) => (existsSync(path) ? readFileSync(path, 'utf8') : null))

const SKIP = new Set(['node_modules', '.git', 'dist', '.next', '.output', 'build', '.turbo', '.vite'])
function tree(dir, depth = 0, acc = []) {
  if (depth > 3 || acc.length > 400) return acc
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.env.example') continue
    if (SKIP.has(e.name)) continue
    const full = join(dir, e.name)
    acc.push({ path: full, name: e.name, dir: e.isDirectory(), depth })
    if (e.isDirectory()) tree(full, depth + 1, acc)
  }
  return acc
}
ipcMain.handle('fs:tree', (_e, root) => (existsSync(root) ? tree(root) : []))

ipcMain.handle('app:open-editor', (_e, { path, editor }) =>
  runner.exec(win, 'system', `${editor || 'code'} "${path}"`, path, 'ouverture dans l\'éditeur'))

/* ─────────────────────────  projets  ───────────────────────── */

function installLibs(projectId, path, libs) {
  const s = store.read()
  const pmId = s.packageManager || 'npm'
  const all = s.libraries.flatMap((c) => c.items)
  const find = (pkg) => all.find((i) => i.pkg === pkg)
  const prod = libs.filter((p) => !find(p)?.dev)
  const dev = libs.filter((p) => find(p)?.dev)
  const jobs = []
  const prodCmd = pm.addPackages(pmId, prod, false)
  const devCmd = pm.addPackages(pmId, dev, true)
  if (prodCmd) jobs.push(prodCmd)
  if (devCmd) jobs.push(devCmd)
  return jobs.reduce(
    (chain, cmd) => chain.then(() => runner.exec(win, projectId, cmd, path, 'librairies')),
    Promise.resolve({ ok: true })
  )
}

async function applyDatabase(projectId, path, frameworkId, databaseId, { provision = false, name } = {}) {
  const s = store.read()
  const pmId = s.packageManager || 'npm'
  const db = database.byId(databaseId)
  if (!db || db.id === 'none') return { ok: true, databaseId: 'none' }
  const written = database.writeFiles(path, db.id, frameworkId)
  for (const rel of database.relativeFiles(path, written.files)) {
    runner.log(win, projectId, `fichier écrit : ${rel}`, 'ok')
  }
  let res = { ok: true }
  if (written.packages.length) {
    const cmd = pm.addPackages(pmId, written.packages, false)
    res = await runner.exec(win, projectId, cmd, path, 'base de données')
  }
  if (res.ok && written.extraDev.length) {
    const cmd = pm.addPackages(pmId, written.extraDev, true)
    res = await runner.exec(win, projectId, cmd, path, 'base de données (dev)')
  }
  if (res.ok && provision) {
    runner.log(win, projectId, `provision ${db.name}…`, 'info')
    const cloud = await dbcloud.provision({ path, frameworkId, databaseId: db.id, name: name || db.name, createRemote: true })
    if (!cloud.ok) {
      runner.log(win, projectId, `provision : ${cloud.error}`, 'err')
      return { ok: false, databaseId: db.id, error: cloud.error }
    }
    for (const f of cloud.files || []) {
      runner.log(win, projectId, `env : ${f.slice(path.length).replace(/^[\\/]/, '')}`, 'ok')
    }
    if (cloud.created) runner.log(win, projectId, `base distante créée (${db.name})`, 'ok')
  }
  return { ok: res.ok, databaseId: db.id, error: res.error }
}

ipcMain.handle('project:create', async (_e, payload) => {
  const s = store.read()
  const fw = s.frameworks.find((f) => f.id === payload.frameworkId)
  if (!fw) return { ok: false, error: 'Framework introuvable.' }

  const dirName = slug(payload.name)
  const workspace = payload.workspace || s.workspace
  let path = join(workspace, dirName)
  const id = uid()

  if (existsSync(path) && existsSync(join(path, 'package.json'))) {
    return { ok: false, error: `Le dossier ${dirName} existe déjà.` }
  }
  cleanupBrokenScaffold(path)
  mkdirSync(workspace, { recursive: true })

  const bp = s.blueprints.find((b) => b.id === payload.blueprintId)
  const project = {
    id,
    name: payload.name,
    path,
    frameworkId: fw.id,
    libs: payload.libs || [],
    blueprintId: payload.blueprintId || null,
    databaseId: payload.databaseId || s.database?.defaultId || 'none',
    themes: Array.isArray(payload.themes) ? payload.themes : (bp?.themes || []),
    notes: payload.notes || '',
    checklist: [],
    createdAt: Date.now(),
    status: 'scaffolding',
    repo: null
  }
  store.patch({ projects: [project, ...s.projects] })
  win.webContents.send('project:changed')

  const pmId = s.packageManager || 'npm'
  const create = pm.adaptCommand(fw.create.replaceAll('{{name}}', dirName), pmId)
  let res = await runner.exec(win, id, create, workspace, `création — ${fw.name}`)

  if (res.ok) {
    const root = pm.resolveProjectRoot(path)
    if (!root) {
      res = { ok: false, error: 'Le scaffold n’a pas créé de package.json. Vérifie que Node.js est installé et consulte la console.' }
    } else {
      if (root !== path) {
        path = root
        patchProject(id, { path: root })
      }
      res = await installProjectDeps(id, root, pmId)
    }
  }

  if (res.ok && project.libs.length) res = await installLibs(id, path, project.libs)

  if (res.ok && project.databaseId && project.databaseId !== 'none') {
    const wantCloud = payload.provision != null ? Boolean(payload.provision) : s.database?.autoCreate !== false
    const dbRes = await applyDatabase(id, path, fw.id, project.databaseId, { provision: wantCloud, name: dirName })
    if (!dbRes.ok) res = dbRes
  }

  // fichiers issus d'un blueprint
  if (res.ok && bp?.files?.length) {
    for (const f of bp.files) {
      const target = join(path, f.path)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, f.content, 'utf8')
      runner.log(win, id, `fichier écrit : ${f.path}`, 'ok')
    }
    for (const cmd of bp.commands || []) await runner.exec(win, id, cmd, path, 'blueprint')
  }

  let gitError = null
  let repo = null
  const gitOpts = git.resolveOptions(payload.git, s.git)
  if (res.ok && gitOpts.create) {
    const published = await git.publish(win, id, path, {
      ...gitOpts,
      name: gitOpts.name || dirName,
      description: `Projet ${payload.name} — PDC Builder`
    })
    repo = published.repo || null
    if (!published.ok && !published.skipped) gitError = published.error
  }
  if (res.ok && !repo) repo = await git.detectRepo(path)

  const s2 = store.read()
  store.patch({
    projects: s2.projects.map((p) => (p.id === id ? {
      ...p,
      status: res.ok ? 'ready' : 'error',
      repo
    } : p))
  })
  win.webContents.send('project:changed')
  docs.syncAllProjects()
  return { ok: res.ok, id, path, repo, gitError }
})

ipcMain.handle('project:repair', async (_e, id) => {
  const s = store.read()
  const p = s.projects.find((x) => x.id === id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }

  const existing = pm.resolveProjectRoot(p.path)
  if (existing) {
    const ready = await ensureProjectReady(id, existing)
    if (ready.ok) patchProject(id, { status: 'ready', path: ready.path })
    win.webContents.send('project:changed')
    return ready.ok ? { ok: true } : ready
  }

  const fw = s.frameworks.find((f) => f.id === p.frameworkId)
  if (!fw) return { ok: false, error: 'Framework introuvable.' }

  const dirName = basename(p.path)
  const workspace = dirname(p.path)
  const pmId = s.packageManager || 'npm'

  cleanupBrokenScaffold(p.path)
  patchProject(id, { status: 'scaffolding' })
  win.webContents.send('project:changed')

  const create = pm.adaptCommand(fw.create.replaceAll('{{name}}', dirName), pmId)
  let res = await runner.exec(win, id, create, workspace, `recréation — ${fw.name}`)
  let root = p.path

  if (res.ok) {
    root = pm.resolveProjectRoot(p.path)
    if (!root) {
      res = { ok: false, error: 'Le scaffold n’a pas créé de package.json. Vérifie que Node.js est installé.' }
    } else {
      if (root !== p.path) patchProject(id, { path: root })
      res = await installProjectDeps(id, root, pmId)
    }
  }

  if (res.ok && p.libs?.length) res = await installLibs(id, root, p.libs)

  patchProject(id, { status: res.ok ? 'ready' : 'error', path: root })
  win.webContents.send('project:changed')
  docs.syncAllProjects()
  return res.ok ? { ok: true } : { ok: false, error: res.error || res.stderr || 'Régénération échouée.' }
})

ipcMain.handle('project:import', async (_e, { path, frameworkId, name, themes }) => {
  const s = store.read()
  if (!existsSync(path)) return { ok: false, error: 'Dossier introuvable.' }
  if (s.projects.some((p) => p.path === path && !p.remoteOnly)) {
    return { ok: false, error: 'Ce dossier est déjà dans la liste.' }
  }
  const repo = await git.detectRepo(path)
  const fwId = frameworkId || git.detectFramework(path, s.frameworks) || s.frameworks[0].id
  const project = {
    id: uid(),
    name: name || basename(path),
    path,
    frameworkId: fwId,
    libs: [],
    themes: Array.isArray(themes) ? themes : [],
    createdAt: Date.now(),
    status: 'ready',
    repo,
    remoteOnly: false
  }
  store.patch({ projects: [project, ...s.projects.filter((p) => !(p.remoteOnly && git.projectOwnsRepo(p, repo)))] })
  win.webContents.send('project:changed')
  return { ok: true, id: project.id, repo }
})

ipcMain.handle('project:scan', async (_e, { roots, maxDepth } = {}) => {
  const s = store.read()
  const dirs = (roots?.length ? roots : [s.workspace, join(homedir(), 'Documents'), join(homedir(), 'Projects'), join(homedir(), 'Developer')])
    .filter(Boolean)
  const found = scan.findProjects(dirs, { maxDepth: maxDepth ?? 3 })
  const known = new Set(s.projects.filter((p) => p.path && !p.remoteOnly).map((p) => p.path.toLowerCase()))
  const fresh = found.filter((f) => !known.has(f.path.toLowerCase()))
  const added = []
  for (const item of fresh) {
    const repo = await git.detectRepo(item.path)
    const project = {
      id: uid(),
      name: item.name,
      path: item.path,
      frameworkId: git.detectFramework(item.path, s.frameworks) || s.frameworks[0]?.id,
      libs: [],
      themes: [],
      createdAt: Date.now(),
      status: 'ready',
      repo,
      remoteOnly: false
    }
    added.push(project)
  }
  if (added.length) {
    const remoteStubs = store.read().projects.filter((p) => p.remoteOnly)
    const keptRemote = remoteStubs.filter((p) => !added.some((a) => git.projectOwnsRepo(p, a.repo)))
    store.patch({
      projects: [...added, ...store.read().projects.filter((p) => !p.remoteOnly), ...keptRemote]
    })
    win.webContents.send('project:changed')
  }
  return { ok: true, found: found.length, added: added.length, projects: added.map((p) => ({ id: p.id, name: p.name, path: p.path })) }
})

ipcMain.handle('project:sync-github', async (_e, { org } = {}) => {
  const s = store.read()
  const listed = await git.listRepos('github', { org: org || s.git?.org || '', limit: 200 })
  if (!listed.ok) return { ok: false, error: listed.error, added: 0, repos: [] }

  const existing = store.read().projects
  const added = []
  for (const remote of listed.repos) {
    if (existing.some((p) => git.projectOwnsRepo(p, remote))) continue
    const folder = slug(remote.name || remote.fullName?.split('/').pop() || 'repo')
    const path = join(s.workspace, folder)
    const localExists = existsSync(join(path, 'package.json'))
    const project = {
      id: uid(),
      name: remote.name || folder,
      path,
      frameworkId: localExists
        ? (git.detectFramework(path, s.frameworks) || s.frameworks[0]?.id)
        : (s.frameworks[0]?.id || 'vite-react'),
      libs: [],
      themes: [],
      createdAt: Date.now(),
      status: localExists ? 'ready' : 'remote',
      remoteOnly: !localExists,
      repo: {
        provider: 'github',
        name: remote.name,
        fullName: remote.fullName,
        url: remote.url,
        remote: remote.url?.endsWith('.git') ? remote.url : `${remote.url}.git`,
        visibility: remote.private ? 'private' : 'public'
      }
    }
    if (localExists) {
      const detected = await git.detectRepo(path)
      if (detected) project.repo = detected
    }
    added.push(project)
  }

  if (added.length) {
    store.patch({ projects: [...added, ...store.read().projects] })
    win.webContents.send('project:changed')
  }
  return {
    ok: true,
    user: listed.user,
    total: listed.repos.length,
    added: added.length,
    repos: listed.repos
  }
})

ipcMain.handle('project:fetch-remote', async (_e, id) => {
  const s = store.read()
  const p = s.projects.find((x) => x.id === id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  if (!p.repo?.fullName && !p.repo?.remote && !p.repo?.url) {
    return { ok: false, error: 'Aucun dépôt distant associé.' }
  }

  const dest = p.path || join(s.workspace, slug(p.name))
  if (existsSync(dest) && existsSync(join(dest, 'package.json'))) {
    const repo = (await git.detectRepo(dest)) || p.repo
    patchProject(id, { path: dest, remoteOnly: false, status: 'ready', repo })
    win.webContents.send('project:changed')
    return { ok: true, id, path: dest, alreadyLocal: true }
  }

  if (existsSync(dest) && readdirSync(dest).length) {
    return { ok: false, error: `Le dossier ${basename(dest)} existe déjà et n’est pas vide.` }
  }

  mkdirSync(dirname(dest), { recursive: true })
  patchProject(id, { status: 'cloning', path: dest, remoteOnly: true })
  win.webContents.send('project:changed')

  const payload = {
    provider: p.repo.provider || 'github',
    repo: p.repo.fullName,
    url: p.repo.remote || p.repo.url,
    folder: basename(dest),
    workspace: dirname(dest)
  }
  const cloned = await git.clone(win, id, dest, payload)
  if (!cloned.ok) {
    patchProject(id, { status: 'remote', remoteOnly: true })
    win.webContents.send('project:changed')
    return cloned
  }

  const fwId = git.detectFramework(dest, s.frameworks) || p.frameworkId
  let installError = null
  if (existsSync(join(dest, 'package.json'))) {
    const inst = await runner.exec(win, id, pm.installForPath(dest, s.packageManager || 'npm'), dest, 'dépendances')
    if (!inst.ok) installError = inst.stderr || 'Installation des dépendances échouée.'
  }
  patchProject(id, {
    path: dest,
    frameworkId: fwId,
    remoteOnly: false,
    status: installError ? 'error' : 'ready',
    repo: cloned.repo || p.repo
  })
  win.webContents.send('project:changed')
  docs.syncAllProjects()
  return { ok: true, id, path: dest, installError }
})

ipcMain.handle('project:duplicate', async (_e, { id, name }) => {
  const s = store.read()
  const src = s.projects.find((p) => p.id === id)
  if (!src) return { ok: false, error: 'Projet introuvable.' }
  const dirName = slug(name)
  const dest = join(dirname(src.path), dirName)
  if (existsSync(dest)) return { ok: false, error: `Le dossier ${dirName} existe déjà.` }

  const newId = uid()
  const copy = { ...src, id: newId, name, path: dest, createdAt: Date.now(), status: 'scaffolding' }
  store.patch({ projects: [copy, ...s.projects] })
  win.webContents.send('project:changed')

  runner.log(win, newId, `▸ copie de ${src.name}`, 'meta')
  try {
    cpSync(src.path, dest, {
      recursive: true,
      filter: (p) => !SKIP.has(basename(p)) || basename(p) === basename(dest)
    })
    const pkgPath = join(dest, 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      pkg.name = dirName
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8')
    }
    runner.log(win, newId, 'fichiers copiés', 'ok')
  } catch (e) {
    runner.log(win, newId, e.message, 'err')
    return { ok: false, error: e.message }
  }

  const s2 = store.read()
  const pmId = s2.packageManager || 'npm'
  const res = await runner.exec(win, newId, pm.installForPath(dest, pmId), dest, 'dépendances')
  store.patch({ projects: s2.projects.map((p) => (p.id === newId ? { ...p, status: res.ok ? 'ready' : 'error' } : p)) })
  win.webContents.send('project:changed')
  return { ok: true, id: newId }
})

ipcMain.handle('project:delete', async (_e, { id, deleteFiles }) => {
  const s = store.read()
  const p = s.projects.find((x) => x.id === id)
  runner.stopDev(id)
  if (p && deleteFiles && existsSync(p.path)) {
    try { await shell.trashItem(p.path) } catch { rmSync(p.path, { recursive: true, force: true }) }
  }
  store.patch({ projects: s.projects.filter((x) => x.id !== id) })
  return { ok: true }
})

ipcMain.handle('project:update', (_e, { id, fields }) => {
  const s = store.read()
  const safe = { ...(fields || {}) }
  if ('checklist' in safe) {
    safe.checklist = Array.isArray(safe.checklist)
      ? safe.checklist
        .map((item) => ({
          id: String(item?.id || uid()),
          text: String(item?.text || '').trim().slice(0, 200),
          done: Boolean(item?.done),
          createdAt: Number(item?.createdAt) || Date.now()
        }))
        .filter((item) => item.text)
        .slice(0, 80)
      : []
  }
  store.patch({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...safe } : p)) })
  try { preferences.sync(store.read()) } catch { /* ignore */ }
  return { ok: true }
})

ipcMain.handle('project:add-libs', async (_e, { id, libs }) => {
  const s = store.read()
  const p = s.projects.find((x) => x.id === id)
  if (!p) return { ok: false }
  const res = await installLibs(id, p.path, libs)
  if (res.ok) {
    const s2 = store.read()
    store.patch({
      projects: s2.projects.map((x) => (x.id === id ? { ...x, libs: [...new Set([...x.libs, ...libs])] } : x))
    })
    docs.syncAllProjects()
  }
  return res
})

/* ────────────────────  dev · build · aperçu  ──────────────────── */

const fwOf = (p) => store.read().frameworks.find((f) => f.id === p.frameworkId)

ipcMain.handle('run:dev', async (_e, id) => {
  const p = store.read().projects.find((x) => x.id === id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  const ready = await ensureProjectReady(id, p.path)
  if (!ready.ok) return ready
  const f = fwOf(p)
  const pmId = store.read().packageManager || 'npm'
  const cmd = pm.adaptCommand(f?.dev || 'npm run dev', pmId)
  return runner.startDev(win, { ...p, path: ready.path }, cmd)
})
ipcMain.handle('run:stop', (_e, id) => {
  const r = runner.stopDev(id)
  if (r.ok) {
    runner.log(win, id, '▸ arrêté manuellement', 'meta')
    win.webContents.send('proc:state', { projectId: id, status: 'stopped', url: null })
  }
  return r
})
ipcMain.handle('run:stop-all', () => {
  const r = runner.stopAll()
  for (const id of r.stopped || []) {
    runner.log(win, id, '▸ arrêté (tous)', 'meta')
    win.webContents.send('proc:state', { projectId: id, status: 'stopped', url: null })
  }
  return r
})
ipcMain.handle('run:list', () => runner.listRunning())
ipcMain.handle('run:build', async (_e, id) => {
  const p = store.read().projects.find((x) => x.id === id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  const ready = await ensureProjectReady(id, p.path)
  if (!ready.ok) return ready
  const f = fwOf(p)
  const pmId = store.read().packageManager || 'npm'
  const res = await runner.exec(win, id, pm.adaptCommand(f?.build || 'npm run build', pmId), ready.path, 'build de production')
  if (res.ok) {
    const s = store.read()
    store.patch({ projects: s.projects.map((x) => (x.id === id ? { ...x, lastBuild: Date.now() } : x)) })
    win.webContents.send('project:changed')
  }
  return res
})
ipcMain.handle('run:preview', async (_e, id) => {
  const p = store.read().projects.find((x) => x.id === id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  const ready = await ensureProjectReady(id, p.path)
  if (!ready.ok) return ready
  const f = fwOf(p)
  const pmId = store.read().packageManager || 'npm'
  const cmd = pm.adaptCommand(f?.preview || 'npm run preview', pmId)
  return runner.startDev(win, { ...p, path: ready.path }, cmd)
})
ipcMain.handle('run:command', (_e, { id, command }) => {
  const p = store.read().projects.find((x) => x.id === id)
  return runner.exec(win, id, command, p.path, 'commande')
})
ipcMain.handle('run:open-build', (_e, id) => {
  const p = store.read().projects.find((x) => x.id === id)
  const f = fwOf(p)
  const out = join(p.path, f?.outDir || 'dist')
  if (!existsSync(out)) return { ok: false, error: `Aucun build dans ${f?.outDir || 'dist'}. Lance un build d'abord.` }
  shell.openPath(out)
  return { ok: true, path: out, size: dirSize(out) }
})
ipcMain.handle('run:open-build-file', (_e, id) => {
  const p = store.read().projects.find((x) => x.id === id)
  const f = fwOf(p)
  const index = join(p.path, f?.outDir || 'dist', 'index.html')
  if (!existsSync(index)) return { ok: false, error: 'index.html absent du build.' }
  shell.openPath(index)
  return { ok: true }
})

function dirSize(dir) {
  let total = 0
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name)
      if (e.isDirectory()) walk(full)
      else total += statSync(full).size
    }
  }
  try { walk(dir) } catch { /* ignore */ }
  return total
}
ipcMain.handle('run:build-info', (_e, id) => {
  const p = store.read().projects.find((x) => x.id === id)
  const f = fwOf(p)
  const out = join(p.path, f?.outDir || 'dist')
  return existsSync(out) ? { exists: true, path: out, size: dirSize(out) } : { exists: false, path: out }
})

/* ────────────────────────  blueprints  ──────────────────────── */

ipcMain.handle('blueprint:save', (_e, bp) => {
  const s = store.read()
  const exists = s.blueprints.find((b) => b.id === bp.id)
  const next = exists
    ? s.blueprints.map((b) => (b.id === bp.id ? { ...b, ...bp } : b))
    : [{ ...bp, id: bp.id || uid(), createdAt: Date.now() }, ...s.blueprints]
  store.patch({ blueprints: next })
  return { ok: true }
})
ipcMain.handle('blueprint:delete', (_e, id) => {
  const s = store.read()
  const bp = s.blueprints.find((b) => b.id === id)
  if (bp?.builtin) return { ok: false, error: 'Les blueprints expérience intégrés ne se suppriment pas. Duplique-les pour les personnaliser.' }
  store.patch({ blueprints: s.blueprints.filter((b) => b.id !== id) })
  return { ok: true }
})
ipcMain.handle('blueprint:duplicate', (_e, id) => {
  const s = store.read()
  const src = s.blueprints.find((b) => b.id === id)
  if (!src) return { ok: false, error: 'Blueprint introuvable.' }
  const copy = {
    ...structuredClone(src),
    id: uid(),
    name: `${src.name} (copie)`,
    builtin: false,
    kind: src.kind || 'custom',
    createdAt: Date.now()
  }
  store.patch({ blueprints: [copy, ...s.blueprints] })
  return { ok: true, id: copy.id }
})
ipcMain.handle('blueprint:from-project', (_e, { id, name }) => {
  const s = store.read()
  const p = s.projects.find((x) => x.id === id)
  const bp = {
    id: uid(),
    name: name || `Base ${p.name}`,
    description: `Créé depuis ${p.name}`,
    frameworkId: p.frameworkId,
    libs: p.libs,
    databaseId: p.databaseId || 'none',
    themes: p.themes || [],
    kind: 'custom',
    builtin: false,
    intent: '',
    audience: '',
    promise: '',
    vibe: '',
    tagline: '',
    category: 'product',
    files: [],
    commands: [],
    createdAt: Date.now()
  }
  store.patch({ blueprints: [bp, ...s.blueprints] })
  return { ok: true, id: bp.id }
})

/* ────────────────────────────  git  ──────────────────────────── */

function projectById(id) {
  return store.read().projects.find((p) => p.id === id)
}

function recordPush(project, result = {}) {
  const at = Date.now()
  const entry = {
    id: uid(),
    projectId: project.id,
    name: project.name,
    repo: project.repo?.fullName || project.repo?.name || null,
    url: result.url || project.repo?.url || null,
    message: result.head?.message || 'Push',
    hash: result.head?.hash || null,
    author: result.head?.author || null,
    at
  }
  const s = store.read()
  const pushLog = [entry, ...(s.pushLog || [])].slice(0, 60)
  store.patch({
    pushLog,
    projects: s.projects.map((p) => (p.id === project.id ? { ...p, lastPushAt: at } : p))
  })
  win.webContents.send('project:changed')
  return entry
}

ipcMain.handle('git:status', () => git.status())
ipcMain.handle('git:detect', async (_e, id) => {
  const p = projectById(id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  const repo = await git.detectRepo(p.path)
  if (!repo) return { ok: false, error: 'Aucun dépôt Git avec remote origin dans ce dossier.' }
  patchProject(id, { repo })
  win.webContents.send('project:changed')
  return { ok: true, repo }
})
ipcMain.handle('git:publish', async (_e, { id, options }) => {
  const p = projectById(id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  const s = store.read()
  const opts = git.resolveOptions({ create: true, ...options }, s.git)
  const published = await git.publish(win, id, p.path, {
    ...opts,
    name: opts.name || slug(p.name),
    description: `Projet ${p.name} — PDC Builder`
  })
  if (published.repo) patchProject(id, { repo: published.repo })
  if (published.ok) {
    const head = (await git.inspect(p.path).catch(() => null))?.head || null
    recordPush({ ...p, repo: published.repo || p.repo }, { head, url: published.repo?.url })
  }
  win.webContents.send('project:changed')
  return published
})
ipcMain.handle('git:push', async (_e, id) => {
  const p = projectById(id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  const result = await git.push(win, id, p.path)
  if (result.ok) recordPush(p, result)
  return result
})
ipcMain.handle('git:board', async () => {
  const s = store.read()
  const board = await git.board(s.projects || [])
  const calendar = await git.activityCalendar(s.projects || [], s.pushLog || [], 17)
  return { ...board, log: s.pushLog || [], calendar }
})
ipcMain.handle('git:link', async (_e, { id, url }) => {
  const p = projectById(id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  const linked = await git.link(win, id, p.path, url)
  if (linked.repo) patchProject(id, { repo: linked.repo })
  win.webContents.send('project:changed')
  return linked
})
ipcMain.handle('git:list', (_e, payload) => git.listRepos(payload?.provider || 'github', { org: payload?.org || '' }))
ipcMain.handle('git:pull', async (_e, id) => {
  const p = projectById(id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  return git.pull(win, id, p.path)
})
ipcMain.handle('git:clone', async (_e, payload) => {
  const s = store.read()
  const source = git.resolveCloneSource(payload)
  if (!source?.url && !source?.fullName) {
    return { ok: false, error: 'Indique un dépôt (owner/nom) ou colle une URL.' }
  }
  const workspace = payload.workspace || s.workspace
  const folder = slug(payload.folder || source.name || 'projet')
  const dest = join(workspace, folder)
  if (existsSync(dest)) return { ok: false, error: `Le dossier ${folder} existe déjà dans l’atelier.` }
  if (s.projects.some((p) => p.path === dest)) return { ok: false, error: 'Ce projet est déjà dans la liste.' }

  mkdirSync(workspace, { recursive: true })
  const id = uid()
  const project = {
    id,
    name: payload.name || source.name || folder,
    path: dest,
    frameworkId: s.frameworks[0]?.id,
    libs: [],
    themes: Array.isArray(payload.themes) ? payload.themes : [],
    createdAt: Date.now(),
    status: 'cloning'
  }
  store.patch({ projects: [project, ...s.projects] })
  win.webContents.send('project:changed')

  const cloned = await git.clone(win, id, dest, payload)
  if (!cloned.ok) {
    try { if (existsSync(dest)) rmSync(dest, { recursive: true, force: true }) } catch { /* ignore */ }
    store.patch({ projects: store.read().projects.filter((p) => p.id !== id) })
    win.webContents.send('project:changed')
    return cloned
  }

  const fwId = git.detectFramework(dest, s.frameworks) || s.frameworks[0]?.id
  let installError = null
  if (existsSync(join(dest, 'package.json'))) {
    const inst = await runner.exec(win, id, pm.installForPath(dest, s.packageManager || 'npm'), dest, 'dépendances')
    if (!inst.ok) installError = inst.stderr || 'L’installation des dépendances a échoué. Voir la console.'
  }
  patchProject(id, {
    status: installError ? 'error' : 'ready',
    frameworkId: fwId,
    repo: cloned.repo,
    path: dest
  })
  docs.syncAllProjects()
  win.webContents.send('project:changed')
  return { ok: true, id, path: dest, repo: cloned.repo, installError }
})

/* ────────────────────────────  IA  ──────────────────────────── */

const controllers = new Map()

ipcMain.handle('ai:providers', () => ai.PROVIDERS)
ipcMain.handle('ai:models', (_e, cfg) => ai.listModels(cfg).catch((e) => ({ error: e.message })))
ipcMain.handle('ai:stop', (_e, chatId) => { controllers.get(chatId)?.abort(); return { ok: true } })

ipcMain.handle('ai:chat', async (_e, { chatId, messages, context, libs, projectId }) => {
  const s = store.read()
  const ctrl = new AbortController()
  controllers.set(chatId, ctrl)
  const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user')
  const docContext = docs.forPrompt({
    query: lastUser?.content || '',
    projectLibs: libs || []
  })
  const prefContext = preferences.forPrompt(s)
  const active = projectId ? s.projects.find((p) => p.id === projectId) : null

  const system = [
    "Tu es l'assistant intégré de PDC Builder, un atelier de projets web sur Mac et Windows.",
    "Réponses courtes, techniques, en français. Pas de préambule.",
    'Pour proposer un fichier, ouvre un bloc de code avec le chemin relatif : ```tsx path=src/App.tsx',
    'Pour proposer un framework à ajouter au catalogue : ```pdc-framework puis un JSON {id,name,tag,description,create,install,dev,build,preview,outDir}.',
    'Pour proposer une librairie : ```pdc-library puis {category,name,pkg,description,dev,docs}.',
    'Design : dark chaud, rayons 16–36px, grille de 8px, Inter, animations 60 fps.',
    'Les préférences complètes sont dans preferences.md (copie projet : .pdc/preferences.md).',
    prefContext,
    active ? `Projet actif pour cette conversation : **${active.name}** (\`${active.id}\`) — \`${active.path}\`` : '',
    context ? `Contexte:\n${context}` : '',
    docContext
  ].filter(Boolean).join('\n')

  try {
    await ai.chat(s.ai, messages, system,
      (delta) => win.webContents.send('ai:delta', { chatId, delta }),
      ctrl.signal)
    win.webContents.send('ai:done', { chatId })
    return { ok: true }
  } catch (e) {
    if (e.name === 'AbortError') { win.webContents.send('ai:done', { chatId }); return { ok: true } }
    win.webContents.send('ai:error', { chatId, error: e.message })
    return { ok: false, error: e.message }
  } finally {
    controllers.delete(chatId)
  }
})

ipcMain.handle('database:list', () => ({
  providers: database.list(),
  guide: database.GUIDE,
  cloud: dbcloud.catalog()
}))
ipcMain.handle('database:apply', async (_e, { id, databaseId, provision }) => {
  const p = projectById(id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  if (!existsSync(p.path)) return { ok: false, error: 'Dossier introuvable.' }
  const fw = store.read().frameworks.find((f) => f.id === p.frameworkId)
  const res = await applyDatabase(id, p.path, fw?.id || p.frameworkId, databaseId, {
    provision: Boolean(provision),
    name: p.name
  })
  if (res.ok) {
    patchProject(id, { databaseId: res.databaseId })
    win.webContents.send('project:changed')
  }
  return res
})
ipcMain.handle('database:cloud-status', () => dbcloud.status())
ipcMain.handle('database:cloud-test', (_e, id) => dbcloud.test(id))
ipcMain.handle('database:cloud-list', (_e, id) => dbcloud.list(id))
ipcMain.handle('database:cloud-create', (_e, payload) => dbcloud.create(payload?.id, { name: payload?.name }))
ipcMain.handle('database:cloud-mcp', (_e, id) => dbcloud.mcpSnippet(id))
ipcMain.handle('app:update-status', () => updater.getSnapshot())
ipcMain.handle('app:update-check', () => updater.check())
ipcMain.handle('app:update-install', () => updater.install())

ipcMain.handle('docs:status', () => docs.getSnapshot())
ipcMain.handle('docs:index', () => docs.listIndex())
ipcMain.handle('docs:get', (_e, pkg) => docs.readDoc(pkg))
ipcMain.handle('docs:refresh', () => docs.refresh({ force: true }))
ipcMain.handle('docs:open', () => docs.openFolder())
ipcMain.handle('preferences:path', () => preferences.path())
ipcMain.handle('preferences:open', () => preferences.openFolder())
