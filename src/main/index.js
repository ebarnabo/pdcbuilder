import { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme } from 'electron'
import { join, dirname, basename } from 'path'
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { platform } from 'os'
import * as store from './store.js'
import * as runner from './runner.js'
import * as ai from './ai.js'

const isMac = platform() === 'darwin'
let win = null

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const slug = (s) =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projet'

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    backgroundColor: '#141110',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 20, y: 22 },
    titleBarOverlay: isMac ? false : { color: '#141110', symbolColor: '#F3EDE6', height: 56 },
    vibrancy: isMac ? 'under-window' : undefined,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
}

nativeTheme.themeSource = 'dark'

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { runner.stopAll(); if (!isMac) app.quit() })
app.on('before-quit', () => runner.stopAll())

/* ─────────────────────────  état  ───────────────────────── */

ipcMain.handle('state:get', () => {
  const s = store.read()
  return {
    ...s,
    projects: s.projects.map((p) => ({ ...p, exists: existsSync(p.path), ...runner.devState(p.id) }))
  }
})
ipcMain.handle('state:patch', (_e, fields) => store.patch(fields))
ipcMain.handle('state:reset-catalog', () => store.patch({
  frameworks: store.DEFAULT_FRAMEWORKS,
  libraries: store.DEFAULT_LIBRARIES
}))

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
  const all = s.libraries.flatMap((c) => c.items)
  const find = (pkg) => all.find((i) => i.pkg === pkg)
  const prod = libs.filter((p) => !find(p)?.dev)
  const dev = libs.filter((p) => find(p)?.dev)
  const jobs = []
  if (prod.length) jobs.push(`npm install ${prod.join(' ')}`)
  if (dev.length) jobs.push(`npm install -D ${dev.join(' ')}`)
  return jobs.reduce(
    (chain, cmd) => chain.then(() => runner.exec(win, projectId, cmd, path, 'librairies')),
    Promise.resolve({ ok: true })
  )
}

ipcMain.handle('project:create', async (_e, payload) => {
  const s = store.read()
  const fw = s.frameworks.find((f) => f.id === payload.frameworkId)
  if (!fw) return { ok: false, error: 'Framework introuvable.' }

  const dirName = slug(payload.name)
  const workspace = payload.workspace || s.workspace
  const path = join(workspace, dirName)
  const id = uid()

  if (existsSync(path)) return { ok: false, error: `Le dossier ${dirName} existe déjà.` }
  mkdirSync(workspace, { recursive: true })

  const project = {
    id,
    name: payload.name,
    path,
    frameworkId: fw.id,
    libs: payload.libs || [],
    blueprintId: payload.blueprintId || null,
    notes: payload.notes || '',
    createdAt: Date.now(),
    status: 'scaffolding'
  }
  store.patch({ projects: [project, ...s.projects] })
  win.webContents.send('project:changed')

  const create = fw.create.replaceAll('{{name}}', dirName)
  let res = await runner.exec(win, id, create, workspace, `création — ${fw.name}`)
  if (res.ok && fw.install) res = await runner.exec(win, id, fw.install, path, 'dépendances')
  if (res.ok && project.libs.length) res = await installLibs(id, path, project.libs)

  // fichiers issus d'un blueprint
  const bp = s.blueprints.find((b) => b.id === payload.blueprintId)
  if (res.ok && bp?.files?.length) {
    for (const f of bp.files) {
      const target = join(path, f.path)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, f.content, 'utf8')
      runner.log(win, id, `fichier écrit : ${f.path}`, 'ok')
    }
    for (const cmd of bp.commands || []) await runner.exec(win, id, cmd, path, 'blueprint')
  }

  const s2 = store.read()
  store.patch({
    projects: s2.projects.map((p) => (p.id === id ? { ...p, status: res.ok ? 'ready' : 'error' } : p))
  })
  win.webContents.send('project:changed')
  return { ok: res.ok, id, path }
})

ipcMain.handle('project:import', async (_e, { path, frameworkId, name }) => {
  const s = store.read()
  if (!existsSync(path)) return { ok: false, error: 'Dossier introuvable.' }
  const project = {
    id: uid(),
    name: name || basename(path),
    path,
    frameworkId: frameworkId || s.frameworks[0].id,
    libs: [],
    createdAt: Date.now(),
    status: 'ready'
  }
  store.patch({ projects: [project, ...s.projects] })
  return { ok: true, id: project.id }
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

  const res = await runner.exec(win, newId, 'npm install', dest, 'dépendances')
  const s2 = store.read()
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
  store.patch({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...fields } : p)) })
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
  }
  return res
})

/* ────────────────────  dev · build · aperçu  ──────────────────── */

const fwOf = (p) => store.read().frameworks.find((f) => f.id === p.frameworkId)

ipcMain.handle('run:dev', (_e, id) => {
  const p = store.read().projects.find((x) => x.id === id)
  const f = fwOf(p)
  return runner.startDev(win, p, f?.dev || 'npm run dev')
})
ipcMain.handle('run:stop', (_e, id) => runner.stopDev(id))
ipcMain.handle('run:build', async (_e, id) => {
  const p = store.read().projects.find((x) => x.id === id)
  const f = fwOf(p)
  const res = await runner.exec(win, id, f?.build || 'npm run build', p.path, 'build de production')
  if (res.ok) {
    const s = store.read()
    store.patch({ projects: s.projects.map((x) => (x.id === id ? { ...x, lastBuild: Date.now() } : x)) })
    win.webContents.send('project:changed')
  }
  return res
})
ipcMain.handle('run:preview', (_e, id) => {
  const p = store.read().projects.find((x) => x.id === id)
  const f = fwOf(p)
  return runner.startDev(win, p, f?.preview || 'npm run preview')
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
  store.patch({ blueprints: s.blueprints.filter((b) => b.id !== id) })
  return { ok: true }
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
    files: [],
    commands: [],
    createdAt: Date.now()
  }
  store.patch({ blueprints: [bp, ...s.blueprints] })
  return { ok: true, id: bp.id }
})

/* ────────────────────────────  IA  ──────────────────────────── */

const controllers = new Map()

ipcMain.handle('ai:providers', () => ai.PROVIDERS)
ipcMain.handle('ai:models', (_e, cfg) => ai.listModels(cfg).catch((e) => ({ error: e.message })))
ipcMain.handle('ai:stop', (_e, chatId) => { controllers.get(chatId)?.abort(); return { ok: true } })

ipcMain.handle('ai:chat', async (_e, { chatId, messages, context }) => {
  const s = store.read()
  const ctrl = new AbortController()
  controllers.set(chatId, ctrl)

  const system = [
    "Tu es l'assistant intégré de PDC Builder, un atelier de projets web sur Mac et Windows.",
    "Réponses courtes, techniques, en français. Pas de préambule.",
    'Pour proposer un fichier, ouvre un bloc de code avec le chemin relatif : ```tsx path=src/App.tsx',
    'Pour proposer un framework à ajouter au catalogue : ```pdc-framework puis un JSON {id,name,tag,description,create,install,dev,build,preview,outDir}.',
    'Pour proposer une librairie : ```pdc-library puis {category,name,pkg,description,dev}.',
    'Design : dark chaud, rayons 16–36px, grille de 8px, Inter, animations 60 fps.',
    context ? `Contexte:\n${context}` : ''
  ].join('\n')

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
