import { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme } from 'electron'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { platform } from 'os'
import * as store from './store.js'
import * as runner from './runner.js'
import * as ai from './ai.js'
import * as git from './git.js'
import * as updater from './updater.js'
import * as docs from './docs.js'
import * as database from './database.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isMac = platform() === 'darwin'
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
let win = null

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

function createWindow() {
  const preload = resolvePreload()
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    backgroundColor: '#141110',
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 20, y: 22 },
    titleBarOverlay: isMac ? false : { color: '#141110', symbolColor: '#F3EDE6', height: 56 },
    vibrancy: isMac ? 'under-window' : undefined,
    webPreferences: {
      preload,
      sandbox: false,
      contextIsolation: true
    }
  })

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

  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  updater.attach(win)
}

nativeTheme.themeSource = 'dark'

app.whenReady().then(() => {
  if (!isMac) app.setAppUserModelId('com.pdcdesign.builder')
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

async function applyDatabase(projectId, path, frameworkId, databaseId) {
  const db = database.byId(databaseId)
  if (!db || db.id === 'none') return { ok: true, databaseId: 'none' }
  const written = database.writeFiles(path, db.id, frameworkId)
  for (const rel of database.relativeFiles(path, written.files)) {
    runner.log(win, projectId, `fichier écrit : ${rel}`, 'ok')
  }
  let res = { ok: true }
  if (written.packages.length) {
    res = await runner.exec(win, projectId, `npm install ${written.packages.join(' ')}`, path, 'base de données')
  }
  if (res.ok && written.extraDev.length) {
    res = await runner.exec(win, projectId, `npm install -D ${written.extraDev.join(' ')}`, path, 'base de données (dev)')
  }
  return { ok: res.ok, databaseId: db.id, error: res.error }
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
    databaseId: payload.databaseId || s.database?.defaultId || 'none',
    notes: payload.notes || '',
    createdAt: Date.now(),
    status: 'scaffolding',
    repo: null
  }
  store.patch({ projects: [project, ...s.projects] })
  win.webContents.send('project:changed')

  const create = fw.create.replaceAll('{{name}}', dirName)
  let res = await runner.exec(win, id, create, workspace, `création — ${fw.name}`)
  if (res.ok && fw.install) res = await runner.exec(win, id, fw.install, path, 'dépendances')
  if (res.ok && project.libs.length) res = await installLibs(id, path, project.libs)

  if (res.ok && project.databaseId && project.databaseId !== 'none') {
    const dbRes = await applyDatabase(id, path, fw.id, project.databaseId)
    if (!dbRes.ok) res = dbRes
  }

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
    docs.syncAllProjects()
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
    databaseId: p.databaseId || 'none',
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

function patchProject(id, fields) {
  const s = store.read()
  store.patch({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...fields } : p)) })
}

ipcMain.handle('git:status', () => git.status())
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
  win.webContents.send('project:changed')
  return published
})
ipcMain.handle('git:push', async (_e, id) => {
  const p = projectById(id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  return git.push(win, id, p.path)
})
ipcMain.handle('git:link', async (_e, { id, url }) => {
  const p = projectById(id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  const linked = await git.link(win, id, p.path, url)
  if (linked.repo) patchProject(id, { repo: linked.repo })
  win.webContents.send('project:changed')
  return linked
})

/* ────────────────────────────  IA  ──────────────────────────── */

const controllers = new Map()

ipcMain.handle('ai:providers', () => ai.PROVIDERS)
ipcMain.handle('ai:models', (_e, cfg) => ai.listModels(cfg).catch((e) => ({ error: e.message })))
ipcMain.handle('ai:stop', (_e, chatId) => { controllers.get(chatId)?.abort(); return { ok: true } })

ipcMain.handle('ai:chat', async (_e, { chatId, messages, context, libs }) => {
  const s = store.read()
  const ctrl = new AbortController()
  controllers.set(chatId, ctrl)
  const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user')
  const docContext = docs.forPrompt({
    query: lastUser?.content || '',
    projectLibs: libs || []
  })

  const system = [
    "Tu es l'assistant intégré de PDC Builder, un atelier de projets web sur Mac et Windows.",
    "Réponses courtes, techniques, en français. Pas de préambule.",
    'Pour proposer un fichier, ouvre un bloc de code avec le chemin relatif : ```tsx path=src/App.tsx',
    'Pour proposer un framework à ajouter au catalogue : ```pdc-framework puis un JSON {id,name,tag,description,create,install,dev,build,preview,outDir}.',
    'Pour proposer une librairie : ```pdc-library puis {category,name,pkg,description,dev,docs}.',
    'Design : dark chaud, rayons 16–36px, grille de 8px, Inter, animations 60 fps.',
    context ? `Contexte:\n${context}` : '',
    docContext
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

ipcMain.handle('database:list', () => ({
  providers: database.list(),
  guide: database.GUIDE
}))
ipcMain.handle('database:apply', async (_e, { id, databaseId }) => {
  const p = projectById(id)
  if (!p) return { ok: false, error: 'Projet introuvable.' }
  if (!existsSync(p.path)) return { ok: false, error: 'Dossier introuvable.' }
  const fw = store.read().frameworks.find((f) => f.id === p.frameworkId)
  const res = await applyDatabase(id, p.path, fw?.id || p.frameworkId, databaseId)
  if (res.ok) {
    patchProject(id, { databaseId: res.databaseId })
    win.webContents.send('project:changed')
  }
  return res
})
ipcMain.handle('app:update-status', () => updater.getSnapshot())
ipcMain.handle('app:update-check', () => updater.check())
ipcMain.handle('app:update-install', () => updater.install())

ipcMain.handle('docs:status', () => docs.getSnapshot())
ipcMain.handle('docs:index', () => docs.listIndex())
ipcMain.handle('docs:get', (_e, pkg) => docs.readDoc(pkg))
ipcMain.handle('docs:refresh', () => docs.refresh({ force: true }))
ipcMain.handle('docs:open', () => docs.openFolder())
