/**
 * Comptes cloud des bases : CLI, API, MCP.
 * Les secrets restent dans userData (pdc-builder.json), jamais dans le projet git.
 */
import { spawn } from 'child_process'
import { homedir, platform } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'
import * as store from './store.js'
import * as database from './database.js'

const isWin = platform() === 'win32'

export const CLOUD = {
  supabase: {
    name: 'Supabase',
    cli: 'supabase',
    install: 'npm i -g supabase',
    mcp: 'https://mcp.supabase.com/mcp',
    mcpDocs: 'https://supabase.com/docs/guides/getting-started/mcp',
    console: 'https://supabase.com/dashboard',
    via: 'API Management + CLI supabase',
    fields: [
      {
        key: 'token', secret: true, label: 'Access token',
        placeholder: 'sbp_…',
        hint: 'Dashboard → icône compte (en bas à gauche) → Access Tokens → Generate new token.',
        url: 'https://supabase.com/dashboard/account/tokens'
      },
      {
        key: 'orgId', secret: false, label: 'ID organisation',
        placeholder: 'laissé vide = première orga',
        hint: 'Dashboard → Organization Settings → Organization ID. Facultatif si tu n’en as qu’une.',
        url: 'https://supabase.com/dashboard'
      },
      {
        key: 'region', secret: false, label: 'Région',
        placeholder: 'eu-west-1',
        hint: 'eu-west-1 (Irlande), eu-central-1 (Francfort), us-east-1…'
      }
    ]
  },
  firebase: {
    name: 'Firebase',
    cli: 'firebase',
    install: 'npm i -g firebase-tools',
    mcp: 'npx -y firebase-tools@latest mcp',
    mcpDocs: 'https://firebase.google.com/docs/cli',
    console: 'https://console.firebase.google.com',
    via: 'CLI firebase-tools',
    fields: [
      {
        key: 'token', secret: true, label: 'Jeton CI',
        placeholder: '1//0…',
        hint: 'Dans un terminal : firebase login:ci — connecte-toi, puis colle le jeton ici. Inutile si firebase login est déjà fait sur cette machine.',
        url: 'https://console.firebase.google.com'
      }
    ]
  },
  neon: {
    name: 'Neon',
    cli: 'neonctl',
    install: 'npm i -g neonctl',
    mcp: 'https://mcp.neon.tech/mcp',
    mcpDocs: 'https://neon.tech/docs/ai/neon-mcp-server',
    console: 'https://console.neon.tech',
    via: 'API Neon + CLI neonctl',
    fields: [
      {
        key: 'apiKey', secret: true, label: 'API key',
        placeholder: 'napi_…',
        hint: 'Console → Account settings → API keys → Create new API key.',
        url: 'https://console.neon.tech/app/settings/api-keys'
      }
    ]
  },
  appwrite: {
    name: 'Appwrite',
    cli: 'appwrite',
    install: 'npm i -g appwrite-cli',
    mcp: 'https://mcp.appwrite.io',
    mcpDocs: 'https://appwrite.io/docs/tooling/command-line/installation',
    console: 'https://cloud.appwrite.io',
    via: 'API + CLI appwrite',
    fields: [
      {
        key: 'endpoint', secret: false, label: 'Endpoint',
        placeholder: 'https://cloud.appwrite.io/v1',
        hint: 'Cloud : laisse la valeur par défaut. Self-host : l’URL de ton instance + /v1.'
      },
      {
        key: 'apiKey', secret: true, label: 'API key',
        placeholder: 'standard_…',
        hint: 'Cloud → ton projet → Overview → API credentials, ou Settings → API keys (scopes projects / databases).',
        url: 'https://cloud.appwrite.io'
      },
      {
        key: 'projectId', secret: false, label: 'Project ID',
        placeholder: 'facultatif pour lister',
        hint: 'Overview, sous le nom du projet. Requis pour gérer une base existante.'
      }
    ]
  },
  convex: {
    name: 'Convex',
    cli: 'convex',
    install: 'npm i -g convex',
    mcp: 'npx -y @convex-dev/mcp',
    mcpDocs: 'https://docs.convex.dev/cli',
    console: 'https://dashboard.convex.dev',
    via: 'CLI convex',
    fields: [
      {
        key: 'deployKey', secret: true, label: 'Deploy key',
        placeholder: 'prod:… ou project:…',
        hint: 'Dashboard → ton projet → Settings → Deploy Keys → Generate. Ou : npx convex login sur cette machine.',
        url: 'https://dashboard.convex.dev'
      },
      {
        key: 'url', secret: false, label: 'CONVEX_URL',
        placeholder: 'https://….convex.cloud',
        hint: 'Settings du déploiement, champ Deployment URL. Utile si tu ne recrées pas un projet.'
      }
    ]
  },
  pocketbase: {
    name: 'PocketBase',
    cli: 'pocketbase',
    install: 'https://pocketbase.io/docs/',
    mcp: null,
    mcpDocs: 'https://pocketbase.io/docs/',
    console: 'http://127.0.0.1:8090/_/',
    via: 'Binaire local',
    fields: [
      {
        key: 'url', secret: false, label: 'URL',
        placeholder: 'http://127.0.0.1:8090',
        hint: 'L’admin est sur cette URL + /_/. Pas de compte cloud.'
      },
      {
        key: 'binary', secret: false, label: 'Chemin du binaire',
        placeholder: 'C:\\tools\\pocketbase.exe',
        hint: 'Télécharge le zip pour Windows, extraie pocketbase.exe, colle le chemin.',
        url: 'https://github.com/pocketbase/pocketbase/releases'
      }
    ]
  }
}

const EMPTY = {
  supabase: { token: '', orgId: '', region: 'eu-west-1' },
  firebase: { token: '' },
  neon: { apiKey: '' },
  appwrite: { endpoint: 'https://cloud.appwrite.io/v1', apiKey: '', projectId: '' },
  convex: { deployKey: '', url: '' },
  pocketbase: { url: 'http://127.0.0.1:8090', binary: '' }
}

export function defaults() {
  return structuredClone(EMPTY)
}

function accounts() {
  const saved = store.read().database?.accounts || {}
  const next = defaults()
  for (const id of Object.keys(next)) next[id] = { ...next[id], ...(saved[id] || {}) }
  return next
}

function acc(id) {
  return accounts()[id] || {}
}

function run(command, cwd = homedir(), extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0', CI: '1', ...extraEnv }
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (c) => { stdout += c.toString() })
    child.stderr?.on('data', (c) => { stderr += c.toString() })
    child.on('error', (e) => resolve({ ok: false, code: -1, stdout, stderr: e.message }))
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr }))
  })
}

async function hasCommand(name) {
  if (!name) return false
  const probe = isWin ? `where ${name}` : `command -v ${name}`
  const r = await run(probe)
  return r.ok
}

function q(value) {
  const s = String(value ?? '')
  if (isWin) return `"${s.replace(/"/g, '\\"')}"`
  return `'${s.replace(/'/g, `'\\''`)}'`
}

function binPath(id) {
  if (id === 'pocketbase') {
    const p = acc('pocketbase').binary
    if (p && existsSync(p)) return p
  }
  return CLOUD[id]?.cli
}

async function jsonFetch(url, { headers = {}, method = 'GET', body } = {}) {
  const r = await fetch(url, {
    method,
    headers: { Accept: 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await r.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  if (!r.ok) {
    const msg = data?.message || data?.error || data?.msg || text.slice(0, 200) || `HTTP ${r.status}`
    return { ok: false, status: r.status, error: msg, data }
  }
  return { ok: true, status: r.status, data }
}

function ready(id) {
  const a = acc(id)
  if (id === 'supabase') return Boolean(a.token)
  if (id === 'firebase') return true
  if (id === 'neon') return Boolean(a.apiKey)
  if (id === 'appwrite') return Boolean(a.apiKey)
  if (id === 'convex') return Boolean(a.deployKey || a.url)
  if (id === 'pocketbase') return Boolean(a.url || a.binary)
  return false
}

export async function status() {
  const cli = {}
  for (const id of Object.keys(CLOUD)) {
    const name = binPath(id)
    cli[id] = {
      bin: name,
      ok: name ? (id === 'pocketbase' && acc('pocketbase').binary ? existsSync(name) : await hasCommand(CLOUD[id].cli)) : false
    }
  }
  const readyMap = {}
  for (const id of Object.keys(CLOUD)) readyMap[id] = ready(id)
  return { cli, ready: readyMap, catalog: catalog() }
}

export function catalog() {
  return Object.entries(CLOUD).map(([id, meta]) => ({
    id,
    name: meta.name,
    via: meta.via,
    cli: meta.cli,
    install: meta.install,
    mcp: meta.mcp,
    mcpDocs: meta.mcpDocs,
    console: meta.console,
    fields: meta.fields,
    ready: ready(id)
  }))
}

export function mcpSnippet(id) {
  const meta = CLOUD[id]
  const a = acc(id)
  if (!meta) return { ok: false, error: 'Inconnu.' }
  if (id === 'supabase') {
    return {
      ok: true,
      json: {
        mcpServers: {
          supabase: {
            type: 'http',
            url: 'https://mcp.supabase.com/mcp',
            headers: { Authorization: `Bearer ${a.token || 'TON_ACCESS_TOKEN'}` }
          }
        }
      }
    }
  }
  if (id === 'neon') {
    return {
      ok: true,
      json: {
        mcpServers: {
          Neon: {
            command: 'npx',
            args: ['-y', 'mcp-remote@latest', 'https://mcp.neon.tech/mcp', '--header', 'Authorization:${NEON_AUTH_HEADER}'],
            env: { NEON_AUTH_HEADER: `Bearer ${a.apiKey || 'TON_API_KEY'}` }
          }
        }
      }
    }
  }
  if (id === 'firebase') {
    return {
      ok: true,
      json: {
        mcpServers: {
          firebase: { command: 'npx', args: ['-y', 'firebase-tools@latest', 'mcp'] }
        }
      }
    }
  }
  if (id === 'appwrite') {
    return {
      ok: true,
      json: {
        mcpServers: {
          appwrite: { type: 'http', url: meta.mcp || 'https://mcp.appwrite.io' }
        }
      }
    }
  }
  if (id === 'convex') {
    return {
      ok: true,
      json: {
        mcpServers: {
          convex: { command: 'npx', args: ['-y', '@convex-dev/mcp'] }
        }
      }
    }
  }
  return { ok: true, json: null, note: 'Pas de MCP officiel. Le binaire / l’admin suffisent.' }
}

async function supabaseHeaders() {
  const token = acc('supabase').token
  if (!token) throw new Error('Access token Supabase manquant.')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function neonHeaders() {
  const key = acc('neon').apiKey
  if (!key) throw new Error('API key Neon manquante.')
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

export async function test(id) {
  try {
    if (id === 'supabase') {
      const r = await jsonFetch('https://api.supabase.com/v1/organizations', { headers: await supabaseHeaders() })
      if (!r.ok) return r
      const orgs = r.data || []
      return { ok: true, detail: orgs[0] ? `Orga ${orgs[0].name}` : `${orgs.length} organisation(s)` }
    }
    if (id === 'neon') {
      const r = await jsonFetch('https://console.neon.tech/api/v2/projects?limit=1', { headers: await neonHeaders() })
      if (!r.ok) return r
      return { ok: true, detail: 'API Neon OK' }
    }
    if (id === 'firebase') {
      const token = acc('firebase').token
      const extra = token ? { FIREBASE_TOKEN: token } : {}
      const cmd = `${await firebaseBin()} projects:list --json --non-interactive`
      const r = await run(cmd, homedir(), extra)
      if (!r.ok) return { ok: false, error: cleanErr(r) }
      return { ok: true, detail: 'CLI Firebase OK' }
    }
    if (id === 'appwrite') {
      const a = acc('appwrite')
      if (!a.apiKey) return { ok: false, error: 'API key manquante.' }
      const endpoint = (a.endpoint || 'https://cloud.appwrite.io/v1').replace(/\/+$/, '')
      const headers = { 'X-Appwrite-Key': a.apiKey, 'Content-Type': 'application/json' }
      if (a.projectId) headers['X-Appwrite-Project'] = a.projectId
      const r = await jsonFetch(`${endpoint}/health`, { headers })
      if (r.ok) return { ok: true, detail: 'Endpoint joignable' }
      const r2 = await jsonFetch(`${endpoint}/projects`, { headers })
      if (r2.ok) return { ok: true, detail: 'API key acceptée' }
      return { ok: false, error: r2.error || r.error }
    }
    if (id === 'convex') {
      if (acc('convex').url) return { ok: true, detail: 'URL enregistrée' }
      if (acc('convex').deployKey) return { ok: true, detail: 'Deploy key enregistrée' }
      const r = await run('npx --yes convex --version')
      return r.ok ? { ok: true, detail: r.stdout.trim() } : { ok: false, error: 'CLI convex introuvable. npm i -g convex ou npx convex login.' }
    }
    if (id === 'pocketbase') {
      const url = (acc('pocketbase').url || 'http://127.0.0.1:8090').replace(/\/+$/, '')
      try {
        const r = await fetch(`${url}/api/health`)
        return r.ok ? { ok: true, detail: 'Instance joignable' } : { ok: false, error: `HTTP ${r.status}. Lance pocketbase serve.` }
      } catch {
        return { ok: false, error: 'Pas de réponse. Lance le binaire (pocketbase serve).' }
      }
    }
    return { ok: false, error: 'Inconnu.' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function firebaseBin() {
  return (await hasCommand('firebase')) ? 'firebase' : 'npx --yes firebase-tools'
}

function cleanErr(r) {
  return (r.stderr || r.stdout || 'échec').trim().split('\n').filter((l) => !/npm warn|npm notice/i.test(l)).slice(-4).join('\n')
}

function slugName(name) {
  return String(name || 'pdc-app').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'pdc-app'
}

export async function list(id) {
  try {
    if (id === 'supabase') {
      const r = await jsonFetch('https://api.supabase.com/v1/projects', { headers: await supabaseHeaders() })
      if (!r.ok) return r
      const items = (r.data || []).map((p) => ({
        id: p.id, name: p.name, region: p.region, status: p.status, url: `https://${p.id}.supabase.co`
      }))
      return { ok: true, items }
    }
    if (id === 'neon') {
      const r = await jsonFetch('https://console.neon.tech/api/v2/projects', { headers: await neonHeaders() })
      if (!r.ok) return r
      const items = (r.data?.projects || []).map((p) => ({
        id: p.id, name: p.name, region: p.region_id, status: p.created_at
      }))
      return { ok: true, items }
    }
    if (id === 'firebase') {
      const token = acc('firebase').token
      const extra = token ? { FIREBASE_TOKEN: token } : {}
      const r = await run(`${await firebaseBin()} projects:list --json --non-interactive`, homedir(), extra)
      if (!r.ok) return { ok: false, error: cleanErr(r) }
      let data = r.stdout
      try { data = JSON.parse(r.stdout) } catch { /* keep */ }
      const raw = data?.result || data?.projects || (Array.isArray(data) ? data : [])
      const items = raw.map((p) => ({
        id: p.projectId || p.id, name: p.displayName || p.projectId, status: p.state || ''
      }))
      return { ok: true, items }
    }
    if (id === 'appwrite') {
      const a = acc('appwrite')
      const endpoint = (a.endpoint || 'https://cloud.appwrite.io/v1').replace(/\/+$/, '')
      const headers = { 'X-Appwrite-Key': a.apiKey, 'Content-Type': 'application/json' }
      if (a.projectId) headers['X-Appwrite-Project'] = a.projectId
      const r = await jsonFetch(`${endpoint}/projects`, { headers })
      if (!r.ok) return r
      const items = (r.data?.projects || []).map((p) => ({ id: p.$id, name: p.name, status: p.region || '' }))
      return { ok: true, items }
    }
    if (id === 'convex') {
      const a = acc('convex')
      const items = []
      if (a.url) items.push({ id: a.url, name: 'Déploiement enregistré', status: a.url })
      return { ok: true, items }
    }
    if (id === 'pocketbase') {
      return { ok: true, items: [{ id: 'local', name: 'Instance locale', status: acc('pocketbase').url || 'http://127.0.0.1:8090' }] }
    }
    return { ok: false, error: 'Inconnu.' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function supabaseOrgId() {
  const saved = acc('supabase').orgId
  if (saved) return saved
  const r = await jsonFetch('https://api.supabase.com/v1/organizations', { headers: await supabaseHeaders() })
  if (!r.ok) throw new Error(r.error)
  const org = (r.data || [])[0]
  if (!org) throw new Error('Aucune organisation Supabase.')
  return org.id
}

function dbPass() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
  let s = ''
  for (let i = 0; i < 20; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function create(id, { name }) {
  const label = name?.trim() || 'pdc-app'
  try {
    if (id === 'supabase') {
      const org = await supabaseOrgId()
      const region = acc('supabase').region || 'eu-west-1'
      const password = dbPass()
      const r = await jsonFetch('https://api.supabase.com/v1/projects', {
        method: 'POST',
        headers: await supabaseHeaders(),
        body: { name: label, organization_id: org, db_pass: password, region, plan: 'free' }
      })
      if (!r.ok) return r
      return { ok: true, remote: { id: r.data.id, name: r.data.name, password }, detail: `Projet ${r.data.name} en cours de provision.` }
    }
    if (id === 'neon') {
      const r = await jsonFetch('https://console.neon.tech/api/v2/projects', {
        method: 'POST',
        headers: await neonHeaders(),
        body: { project: { name: label } }
      })
      if (!r.ok) return r
      const project = r.data?.project
      const uri = r.data?.connection_uris?.[0]?.connection_uri
      return { ok: true, remote: { id: project?.id, name: project?.name, uri }, detail: `Projet ${project?.name || label} créé.` }
    }
    if (id === 'firebase') {
      const pid = slugName(label)
      const token = acc('firebase').token
      const extra = token ? { FIREBASE_TOKEN: token } : {}
      const bin = await firebaseBin()
      const r = await run(`${bin} projects:create ${q(pid)} --display-name ${q(label)} --non-interactive`, homedir(), extra)
      if (!r.ok) return { ok: false, error: cleanErr(r) }
      await run(`${bin} apps:create WEB ${q(label)} --project ${q(pid)} --non-interactive`, homedir(), extra)
      const cfg = await run(`${bin} apps:sdkconfig WEB --project ${q(pid)} --json --non-interactive`, homedir(), extra)
      let sdk = null
      try { sdk = JSON.parse(cfg.stdout)?.result?.sdkConfig || JSON.parse(cfg.stdout) } catch { /* ignore */ }
      return { ok: true, remote: { id: pid, name: label, sdk }, detail: `Projet ${pid} créé.` }
    }
    if (id === 'appwrite') {
      const a = acc('appwrite')
      const endpoint = (a.endpoint || 'https://cloud.appwrite.io/v1').replace(/\/+$/, '')
      const headers = { 'X-Appwrite-Key': a.apiKey, 'Content-Type': 'application/json' }
      if (a.projectId) headers['X-Appwrite-Project'] = a.projectId
      const r = await jsonFetch(`${endpoint}/projects`, {
        method: 'POST',
        headers,
        body: { projectId: slugName(label), name: label }
      })
      if (!r.ok) return r
      return { ok: true, remote: { id: r.data.$id, name: r.data.name }, detail: `Projet ${r.data.name} créé.` }
    }
    if (id === 'convex') {
      return { ok: false, error: 'Convex se lie dans le dossier du projet (npx convex dev). Enregistre une deploy key ou une URL, puis provisionne le projet local.' }
    }
    if (id === 'pocketbase') {
      const bin = acc('pocketbase').binary
      if (!bin || !existsSync(bin)) return { ok: false, error: 'Indique le chemin du binaire PocketBase dans Réglages.' }
      return { ok: true, remote: { id: 'local', name: 'PocketBase' }, detail: `Binaire prêt : ${bin}. Lance-le, puis ouvre /_/.` }
    }
    return { ok: false, error: 'Inconnu.' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function waitSupabase(ref, tries = 24) {
  for (let i = 0; i < tries; i++) {
    const r = await jsonFetch(`https://api.supabase.com/v1/projects/${ref}`, { headers: await supabaseHeaders() })
    if (r.ok && (r.data.status === 'ACTIVE_HEALTHY' || r.data.status === 'ACTIVE_UNHEALTHY')) return r.data
    await new Promise((ok) => setTimeout(ok, 5000))
  }
  return null
}

async function envFor(id, remote) {
  if (id === 'supabase') {
    const ref = remote.id
    await waitSupabase(ref)
    const keys = await jsonFetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, { headers: await supabaseHeaders() })
    const list = Array.isArray(keys.data) ? keys.data : (keys.data?.api_keys || [])
    const anon = list.find((k) => /anon/i.test(k.name || k.type || '')) || list[0]
    return {
      public: {
        SUPABASE_URL: `https://${ref}.supabase.co`,
        SUPABASE_ANON_KEY: anon?.api_key || anon?.key || ''
      }
    }
  }
  if (id === 'neon') {
    let uri = remote.uri
    if (!uri && remote.id) {
      const r = await jsonFetch(`https://console.neon.tech/api/v2/projects/${remote.id}/connection_uri?database_name=neondb&role_name=neondb`, {
        headers: await neonHeaders()
      })
      uri = r.data?.uri || r.data?.connection_uri
    }
    return { secret: { DATABASE_URL: uri || '' } }
  }
  if (id === 'firebase' && remote.sdk) {
    const c = remote.sdk
    return {
      public: {
        FIREBASE_API_KEY: c.apiKey,
        FIREBASE_AUTH_DOMAIN: c.authDomain,
        FIREBASE_PROJECT_ID: c.projectId,
        FIREBASE_STORAGE_BUCKET: c.storageBucket,
        FIREBASE_MESSAGING_SENDER_ID: c.messagingSenderId,
        FIREBASE_APP_ID: c.appId
      }
    }
  }
  if (id === 'appwrite') {
    const a = acc('appwrite')
    return {
      public: {
        APPWRITE_ENDPOINT: a.endpoint || 'https://cloud.appwrite.io/v1',
        APPWRITE_PROJECT_ID: remote.id || a.projectId
      }
    }
  }
  if (id === 'convex') {
    const a = acc('convex')
    const pub = {}
    const secret = {}
    if (a.url) pub.CONVEX_URL = a.url
    if (a.deployKey) secret.CONVEX_DEPLOY_KEY = a.deployKey
    return { public: pub, secret }
  }
  if (id === 'pocketbase') {
    return { public: { POCKETBASE_URL: acc('pocketbase').url || 'http://127.0.0.1:8090' } }
  }
  return {}
}

export async function provision({ path, frameworkId, databaseId, name, createRemote = true }) {
  if (!databaseId || databaseId === 'none') return { ok: true, skipped: true }
  let remote = null
  let created = false
  if (createRemote && ready(databaseId)) {
    if (databaseId === 'convex' || databaseId === 'pocketbase') {
      remote = { id: databaseId, name }
    } else {
      const made = await create(databaseId, { name })
      if (!made.ok) return { ok: false, error: made.error }
      remote = made.remote
      created = true
    }
  }
  if (!remote && !ready(databaseId)) {
    return { ok: true, skipped: true }
  }
  const env = await envFor(databaseId, remote || {})
  const files = database.applyEnvValues(path, frameworkId, env)
  if (databaseId === 'convex' && path && createRemote) {
    const extra = {}
    if (acc('convex').deployKey) extra.CONVEX_DEPLOY_KEY = acc('convex').deployKey
    await run('npx --yes convex codegen --typecheck disable', path, extra)
  }
  return { ok: true, created, remote, files, envKeys: [...Object.keys(env.public || {}), ...Object.keys(env.secret || {})] }
}

export function guide(id) {
  const meta = CLOUD[id]
  if (!meta) return null
  return {
    id,
    ...meta,
    ready: ready(id)
  }
}

export { ready }
