/**
 * Publication vers pdc-design-showroom :
 * - entrée Firestore (projects) → URL /projet/{slug}
 * - copie optionnelle vers public/maquettes/{slug}/{folder}/
 */
import { BrowserWindow } from 'electron'
import { join, dirname, relative } from 'path'
import {
  existsSync, mkdirSync, cpSync, readdirSync, statSync, readFileSync, writeFileSync, rmSync
} from 'fs'
import * as store from './store.js'

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function publicUrl(siteUrl, slug) {
  const base = String(siteUrl || '').replace(/\/+$/, '')
  if (!base || !slug) return ''
  return `${base}/projet/${slug}`
}

function cfg() {
  const s = store.read().showroom || {}
  return {
    siteUrl: String(s.siteUrl || '').trim(),
    repoPath: String(s.repoPath || '').trim(),
    apiKey: String(s.apiKey || '').trim(),
    projectId: String(s.projectId || '').trim(),
    authDomain: String(s.authDomain || '').trim(),
    refreshToken: String(s.refreshToken || '').trim(),
    uid: String(s.uid || '').trim()
  }
}

function saveAuth({ refreshToken, uid, email }) {
  const cur = store.read().showroom || {}
  store.patch({
    showroom: {
      ...cur,
      refreshToken: refreshToken || cur.refreshToken || '',
      uid: uid || cur.uid || '',
      email: email || cur.email || ''
    }
  })
}

export function status() {
  const c = cfg()
  return {
    configured: Boolean(c.siteUrl && c.apiKey && c.projectId),
    connected: Boolean(c.refreshToken),
    hasRepo: Boolean(c.repoPath && existsSync(c.repoPath)),
    siteUrl: c.siteUrl,
    repoPath: c.repoPath,
    projectId: c.projectId,
    uid: c.uid,
    email: store.read().showroom?.email || ''
  }
}

async function idToken() {
  const c = cfg()
  if (!c.apiKey || !c.refreshToken) {
    throw new Error('Connecte-toi au showroom dans Réglages → Showroom.')
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: c.refreshToken
  })
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(c.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Session showroom expirée — reconnecte-toi.')
  }
  if (data.refresh_token && data.refresh_token !== c.refreshToken) {
    saveAuth({ refreshToken: data.refresh_token, uid: data.user_id })
  }
  return { token: data.id_token, uid: data.user_id }
}

function firestoreBase(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
}

function decodeFields(fields = {}) {
  const out = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue != null) out[k] = v.stringValue
    else if (v.timestampValue != null) out[k] = v.timestampValue
    else if (v.integerValue != null) out[k] = Number(v.integerValue)
    else if (v.booleanValue != null) out[k] = v.booleanValue
    else if (v.arrayValue) {
      out[k] = (v.arrayValue.values || []).map((item) => {
        if (item.mapValue) return decodeFields(item.mapValue.fields)
        if (item.stringValue != null) return item.stringValue
        return null
      })
    } else if (v.mapValue) out[k] = decodeFields(v.mapValue.fields)
  }
  return out
}

function encodeProposition(p) {
  return {
    mapValue: {
      fields: {
        label: { stringValue: String(p.label || '') },
        folder: { stringValue: String(p.folder || '') }
      }
    }
  }
}

function encodeProjectFields({ clientName, projectSlug, dateIso, propositions, createdBy, createdAtIso }) {
  const fields = {
    clientName: { stringValue: clientName },
    projectSlug: { stringValue: projectSlug },
    date: { timestampValue: dateIso },
    propositions: {
      arrayValue: { values: propositions.map(encodeProposition) }
    },
    createdBy: { stringValue: createdBy }
  }
  if (createdAtIso) fields.createdAt = { timestampValue: createdAtIso }
  return fields
}

function docIdFromName(name) {
  const m = String(name || '').match(/\/documents\/projects\/([^/]+)$/)
  return m ? m[1] : null
}

export async function listProjects() {
  const c = cfg()
  if (!c.projectId || !c.apiKey) {
    return { ok: false, error: 'Configure l’API Firebase du showroom dans Réglages.', projects: [] }
  }
  const url = `${firestoreBase(c.projectId)}/projects?pageSize=100&key=${encodeURIComponent(c.apiKey)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    return { ok: false, error: data?.error?.message || 'Lecture Firestore impossible', projects: [] }
  }
  const projects = (data.documents || []).map((doc) => {
    const fields = decodeFields(doc.fields)
    return {
      id: docIdFromName(doc.name),
      clientName: fields.clientName || '',
      projectSlug: fields.projectSlug || '',
      date: fields.date || null,
      createdAt: fields.createdAt || null,
      createdBy: fields.createdBy || '',
      propositions: Array.isArray(fields.propositions) ? fields.propositions : [],
      url: publicUrl(c.siteUrl, fields.projectSlug)
    }
  }).filter((p) => p.id && p.projectSlug)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

  return { ok: true, projects }
}

function toDateIso(dateStr) {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d, 12, 0, 0).toISOString()
  }
  return new Date().toISOString()
}

function nextFolder(propositions = []) {
  const used = new Set((propositions || []).map((p) => p.folder))
  let n = propositions.length + 1
  while (used.has(`v${n}`)) n += 1
  return `v${n}`
}

function findIndexHtml(dir) {
  if (!dir || !existsSync(dir)) return null
  const direct = join(dir, 'index.html')
  if (existsSync(direct)) return dir
  try {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        const nested = join(p, 'index.html')
        if (existsSync(nested)) return p
      }
    }
  } catch { /* ignore */ }
  return null
}

function copyMaquettes(repoPath, slug, folder, sourceDir) {
  const root = findIndexHtml(sourceDir)
  if (!root) {
    return { ok: false, error: `Aucun index.html dans ${sourceDir}` }
  }
  const target = join(repoPath, 'public', 'maquettes', slug, folder)
  mkdirSync(dirname(target), { recursive: true })
  if (existsSync(target)) rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  cpSync(root, target, { recursive: true })
  return {
    ok: true,
    target: relative(repoPath, target).replace(/\\/g, '/'),
    source: root
  }
}

async function createProject(auth, payload) {
  const c = cfg()
  const now = new Date().toISOString()
  const fields = encodeProjectFields({
    clientName: payload.clientName,
    projectSlug: payload.projectSlug,
    dateIso: payload.dateIso,
    propositions: payload.propositions,
    createdBy: auth.uid,
    createdAtIso: now
  })
  const res = await fetch(`${firestoreBase(c.projectId)}/projects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Création Firestore refusée')
  return docIdFromName(data.name)
}

async function updateProject(auth, projectId, payload) {
  const c = cfg()
  const fields = encodeProjectFields({
    clientName: payload.clientName,
    projectSlug: payload.projectSlug,
    dateIso: payload.dateIso,
    propositions: payload.propositions,
    createdBy: payload.createdBy,
    createdAtIso: payload.createdAtIso
  })
  const mask = ['clientName', 'projectSlug', 'date', 'propositions', 'createdBy', 'createdAt']
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join('&')
  const res = await fetch(`${firestoreBase(c.projectId)}/projects/${projectId}?${mask}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Mise à jour Firestore refusée')
  return projectId
}

/**
 * @param {object} opts
 * @param {'new'|'existing'} opts.mode
 * @param {string} [opts.existingId]
 * @param {string} opts.clientName
 * @param {string} opts.projectSlug
 * @param {string} [opts.date]
 * @param {string} opts.label
 * @param {string} opts.folder
 * @param {string} [opts.sourceDir]
 * @param {boolean} [opts.copyFiles]
 * @param {string} [opts.projectId] — id projet PDC Builder (pour mémoriser le lien)
 */
export async function publish(opts = {}) {
  const c = cfg()
  if (!c.siteUrl) return { ok: false, error: 'Indique l’URL du showroom dans Réglages → Showroom.' }
  if (!c.apiKey || !c.projectId) {
    return { ok: false, error: 'Configure Firebase (apiKey + projectId) dans Réglages → Showroom.' }
  }

  const projectSlug = slugify(opts.projectSlug || opts.clientName)
  const folder = slugify(opts.folder || 'v1')
  const label = String(opts.label || 'Proposition 1').trim() || 'Proposition 1'
  const clientName = String(opts.clientName || '').trim()

  if (!clientName) return { ok: false, error: 'Nom du client requis.' }
  if (!SLUG_RE.test(projectSlug)) return { ok: false, error: 'Slug projet invalide (a-z, 0-9, tirets).' }
  if (!SLUG_RE.test(folder)) return { ok: false, error: 'Dossier proposition invalide.' }

  let auth
  try {
    auth = await idToken()
  } catch (e) {
    return { ok: false, error: e.message }
  }

  const listed = await listProjects()
  if (!listed.ok) return listed

  let firestoreId = opts.existingId || null
  let propositions = [{ label, folder }]
  let createdBy = auth.uid
  let createdAtIso = new Date().toISOString()
  let dateIso = toDateIso(opts.date)

  if (opts.mode === 'existing') {
    const existing = listed.projects.find((p) => p.id === opts.existingId)
    if (!existing) return { ok: false, error: 'Projet showroom introuvable.' }
    if ((existing.propositions || []).some((p) => p.folder === folder)) {
      return { ok: false, error: `Le dossier « ${folder} » existe déjà sur ce projet.` }
    }
    propositions = [...(existing.propositions || []), { label, folder }]
    if (propositions.length > 12) return { ok: false, error: 'Maximum 12 propositions par projet.' }
    firestoreId = existing.id
    createdBy = existing.createdBy || auth.uid
    createdAtIso = existing.createdAt || createdAtIso
    dateIso = existing.date || dateIso
  } else {
    const clash = listed.projects.find((p) => p.projectSlug === projectSlug)
    if (clash) {
      return {
        ok: false,
        error: `Le slug « ${projectSlug} » existe déjà. Choisis « Ajouter une proposition » ou un autre nom.`
      }
    }
  }

  let copy = null
  const shouldCopy = opts.copyFiles !== false && c.repoPath && opts.sourceDir
  if (shouldCopy) {
    if (!existsSync(c.repoPath)) {
      return { ok: false, error: `Dépôt showroom introuvable : ${c.repoPath}` }
    }
    copy = copyMaquettes(c.repoPath, projectSlug, folder, opts.sourceDir)
    if (!copy.ok) return copy
  }

  try {
    if (opts.mode === 'existing') {
      const existing = listed.projects.find((p) => p.id === firestoreId)
      await updateProject(auth, firestoreId, {
        clientName: existing.clientName,
        projectSlug: existing.projectSlug,
        dateIso,
        propositions,
        createdBy,
        createdAtIso
      })
    } else {
      firestoreId = await createProject(auth, {
        clientName,
        projectSlug,
        dateIso,
        propositions
      })
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }

  const url = publicUrl(c.siteUrl, projectSlug)
  const link = {
    projectId: firestoreId,
    slug: projectSlug,
    folder,
    label,
    url,
    publishedAt: Date.now()
  }

  if (opts.projectId) {
    const s = store.read()
    const projects = s.projects.map((p) => (
      p.id === opts.projectId ? { ...p, showroom: link } : p
    ))
    store.patch({ projects })
  }

  return {
    ok: true,
    url,
    slug: projectSlug,
    folder,
    label,
    firestoreId,
    copied: Boolean(copy?.ok),
    target: copy?.target || null,
    link
  }
}

export function suggestFromProject(project, frameworks = []) {
  const fw = frameworks.find((f) => f.id === project?.frameworkId)
  const outDir = fw?.outDir || 'dist'
  const buildPath = project?.path ? join(project.path, outDir) : ''
  const sourceDir = findIndexHtml(buildPath) || findIndexHtml(project?.path) || buildPath || ''
  const slug = slugify(project?.name || 'projet')
  return {
    clientName: project?.name || '',
    projectSlug: slug,
    label: 'Proposition 1',
    folder: 'v1',
    sourceDir,
    outDir,
    url: publicUrl(cfg().siteUrl, slug),
    nextFolderFor: (propositions) => nextFolder(propositions)
  }
}

export async function login(parent) {
  const c = cfg()
  if (!c.apiKey || !c.projectId) {
    return { ok: false, error: 'Renseigne apiKey et projectId Firebase d’abord.' }
  }
  const authDomain = c.authDomain || `${c.projectId}.firebaseapp.com`

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Connexion showroom</title>
<style>
  body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0b1b2b;color:#f4f7fb}
  .box{text-align:center;padding:2rem;max-width:28rem}
  button{background:#00b7c7;color:#0b1b2b;border:0;padding:.85rem 1.4rem;font-weight:700;cursor:pointer;border-radius:4px}
  button:disabled{opacity:.5;cursor:wait}
  p{opacity:.8;line-height:1.45}
  .err{color:#ff6b6b}
</style></head><body>
<div class="box">
  <h1>Showroom PDC</h1>
  <p>Connecte le compte Google admin pour publier des projets.</p>
  <button id="go">Se connecter avec Google</button>
  <p id="msg"></p>
</div>
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'
  import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'
  const app = initializeApp({
    apiKey: ${JSON.stringify(c.apiKey)},
    authDomain: ${JSON.stringify(authDomain)},
    projectId: ${JSON.stringify(c.projectId)}
  })
  const auth = getAuth(app)
  const msg = document.getElementById('msg')
  const btn = document.getElementById('go')
  btn.onclick = async () => {
    btn.disabled = true
    msg.textContent = 'Fenêtre Google…'
    msg.className = ''
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const cred = await signInWithPopup(auth, provider)
      const user = cred.user
      const refreshToken = user.refreshToken
      const payload = {
        ok: true,
        refreshToken,
        uid: user.uid,
        email: user.email || ''
      }
      msg.textContent = 'Connecté · ' + (user.email || user.uid)
      window.pdcShowroomDone?.(payload)
    } catch (e) {
      msg.textContent = e.message || 'Échec de connexion'
      msg.className = 'err'
      btn.disabled = false
      window.pdcShowroomDone?.({ ok: false, error: e.message })
    }
  }
</script></body></html>`

  const tmp = join(process.env.TEMP || process.env.TMPDIR || '.', `pdc-showroom-login-${Date.now()}.html`)
  writeFileSync(tmp, html, 'utf8')

  return new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      try { if (!child.isDestroyed()) child.close() } catch { /* ignore */ }
      try { rmSync(tmp, { force: true }) } catch { /* ignore */ }
      resolve(result)
    }

    const child = new BrowserWindow({
      width: 480,
      height: 640,
      parent: parent || undefined,
      modal: Boolean(parent),
      title: 'Connexion showroom',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    })

    child.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 520,
        height: 720,
        parent: child,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      }
    }))

    child.webContents.on('did-finish-load', async () => {
      try {
        await child.webContents.executeJavaScript(`
          window.pdcShowroomDone = (payload) => {
            window.__pdcShowroomResult = payload
          }
        `)
      } catch { /* ignore */ }
    })

    const poll = setInterval(async () => {
      if (settled || child.isDestroyed()) {
        clearInterval(poll)
        return
      }
      try {
        const result = await child.webContents.executeJavaScript('window.__pdcShowroomResult || null')
        if (!result) return
        clearInterval(poll)
        if (result.ok && result.refreshToken) {
          saveAuth({
            refreshToken: result.refreshToken,
            uid: result.uid,
            email: result.email
          })
          finish({ ok: true, uid: result.uid, email: result.email })
        } else {
          finish({ ok: false, error: result.error || 'Connexion annulée' })
        }
      } catch { /* ignore */ }
    }, 400)

    child.on('closed', () => {
      clearInterval(poll)
      finish({ ok: false, error: 'Fenêtre fermée' })
    })

    child.loadFile(tmp).catch((e) => finish({ ok: false, error: e.message }))
  })
}

export function logout() {
  const cur = store.read().showroom || {}
  store.patch({
    showroom: {
      ...cur,
      refreshToken: '',
      uid: '',
      email: ''
    }
  })
  return { ok: true }
}

export { nextFolder, findIndexHtml }
