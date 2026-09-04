import { spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { homedir, platform } from 'os'
import * as runner from './runner.js'

const isWin = platform() === 'win32'
const ORIGIN_PAGE = 'https://cursor.com/codebase'

const IGNORE_LINES = [
  'node_modules',
  'dist',
  'build',
  '.DS_Store',
  '.env',
  '.env.*',
  '!.env.example',
  '.next',
  '.output',
  '.turbo',
  '.vite'
]

function run(command, cwd, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0', CI: '1', GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0', ...extraEnv }
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (c) => { stdout += c.toString() })
    child.stderr?.on('data', (c) => { stderr += c.toString() })
    child.on('error', (e) => resolve({ ok: false, code: -1, stdout, stderr: e.message }))
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr }))
  })
}

function q(value) {
  const s = String(value ?? '')
  if (isWin) return `"${s.replace(/"/g, '\\"')}"`
  return `'${s.replace(/'/g, `'\\''`)}'`
}

function logged(win, projectId, command, cwd, label) {
  return runner.exec(win, projectId, command, cwd, label)
}

async function hasCommand(name) {
  const probe = isWin ? `where ${name}` : `command -v ${name}`
  const r = await run(probe, homedir())
  return r.ok
}

function originBin() {
  const local = join(homedir(), '.local', 'bin', isWin ? 'origin.exe' : 'origin')
  return existsSync(local) ? local : 'origin'
}

function firstHttps(text) {
  const m = String(text || '').match(/https?:\/\/[^\s"'<>]+/i)
  return m ? m[0].replace(/[).,]+$/, '') : null
}

function pageUrl(provider, cloneUrl, name) {
  if (!cloneUrl && !name) return null
  if (provider === 'origin') {
    const m = String(cloneUrl || '').match(/origin\.cursor\.com\/([^/\s]+\/[^/\s.]+)/i)
      || String(cloneUrl || '').match(/cursor\.com\/codebase\/([^/\s]+\/[^/\s.]+)/i)
    if (m) return `${ORIGIN_PAGE}/${m[1].replace(/\.git$/, '')}`
    return cloneUrl || null
  }
  if (!cloneUrl) return null
  return cloneUrl
    .replace(/\.git$/, '')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
}

function repoNameFromUrl(url) {
  if (!url) return null
  const clean = url.replace(/\.git$/, '').replace(/\/+$/, '')
  const parts = clean.split('/')
  return parts[parts.length - 1] || null
}

function providerFromUrl(url) {
  const u = String(url || '')
  if (/origin\.cursor\.com|cursor\.com\/codebase/i.test(u)) return 'origin'
  if (/github\.com/i.test(u)) return 'github'
  return 'github'
}

export function normalizeRemote(url) {
  return String(url || '')
    .trim()
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
    .replace(/^git@github\.com:/i, 'https://github.com/')
    .replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/')
    .toLowerCase()
}

export function repoFromRemote(remote) {
  const raw = String(remote || '').trim()
  if (!raw) return null
  const provider = providerFromUrl(raw)
  const fullName = originFullName(raw) || githubFullName(raw)
  const name = repoNameFromUrl(fullName || raw)
  return {
    provider,
    name,
    fullName: fullName || null,
    url: pageUrl(provider, raw, name) || raw.replace(/\.git$/i, ''),
    remote: raw,
    visibility: null
  }
}

/** Lit origin dans le dossier du projet et renvoie les métadonnées dépôt. */
export async function detectRepo(dir) {
  if (!dir || !existsSync(dir)) return null
  const inside = await run('git rev-parse --is-inside-work-tree', dir)
  if (!inside.ok || inside.stdout.trim() !== 'true') return null
  const remote = await currentRemote(dir)
  if (!remote) return null
  return repoFromRemote(remote)
}

export function sameRepo(a, b) {
  if (!a?.remote || !b?.remote) return false
  return normalizeRemote(a.remote) === normalizeRemote(b.remote)
}

export function defaults(partial = {}) {
  return {
    autoCreate: true,
    provider: 'github',
    visibility: 'private',
    org: '',
    branch: 'main',
    ...partial
  }
}

export function resolveOptions(payload = {}, saved = {}) {
  const base = defaults(saved)
  const create = payload.create != null ? Boolean(payload.create) : Boolean(base.autoCreate)
  return {
    create,
    provider: payload.provider || base.provider || 'github',
    visibility: payload.visibility || base.visibility || 'private',
    org: payload.org != null ? payload.org : (base.org || ''),
    branch: payload.branch || base.branch || 'main',
    name: payload.name || '',
    description: payload.description || ''
  }
}

export async function status() {
  const gitOk = await hasCommand('git')
  const ghOk = await hasCommand('gh')
  const originPath = originBin()
  const originOk = isWin ? false : (originPath !== 'origin' || await hasCommand('origin'))

  let gitVersion = ''
  if (gitOk) {
    const v = await run('git --version', homedir())
    gitVersion = v.stdout.trim()
  }

  let github = { ok: false, user: null, error: ghOk ? 'Non connecté. Lance gh auth login.' : 'GitHub CLI (gh) n’est pas installé.' }
  if (ghOk) {
    const user = await run('gh api user --jq .login', homedir())
    if (user.ok && user.stdout.trim()) github = { ok: true, user: user.stdout.trim(), error: null }
    else github = { ok: false, user: null, error: (user.stderr || user.stdout || 'gh auth login requis.').trim() }
  }

  let origin = {
    ok: false,
    bin: originOk,
    user: null,
    error: isWin
      ? 'Cursor Origin n’est pas encore disponible sur Windows. Utilise GitHub.'
      : (originOk ? 'origin auth login requis.' : 'CLI Origin introuvable.')
  }
  if (!isWin && originOk) {
    const auth = await run(`${q(originPath)} auth status`, homedir())
    if (auth.ok) origin = { ok: true, bin: true, user: (auth.stdout || 'connecté').trim().split(/\r?\n/)[0], error: null }
    else origin = { ok: false, bin: true, user: null, error: (auth.stderr || auth.stdout || 'origin auth login requis.').trim() }
  }

  return {
    platform: platform(),
    originSupported: !isWin,
    git: { ok: gitOk, version: gitVersion },
    github,
    origin
  }
}

function ensureGitignore(dir) {
  const file = join(dir, '.gitignore')
  let body = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const have = new Set(body.split(/\r?\n/).map((l) => l.trim()))
  const missing = IGNORE_LINES.filter((l) => !have.has(l))
  if (!missing.length && existsSync(file)) return
  const extra = missing.join('\n')
  writeFileSync(file, body && !body.endsWith('\n') ? `${body}\n${extra}\n` : `${body}${extra}\n`, 'utf8')
}

async function gitIdentity(cwd) {
  const name = await run('git config --get user.name', cwd)
  const email = await run('git config --get user.email', cwd)
  if (name.ok && name.stdout.trim() && email.ok && email.stdout.trim()) {
    return { name: name.stdout.trim(), email: email.stdout.trim() }
  }
  const gh = await run('gh api user --jq .login', cwd)
  const login = gh.ok ? gh.stdout.trim() : ''
  return {
    name: login || 'PDC Builder',
    email: login ? `${login}@users.noreply.github.com` : 'pdc-builder@local'
  }
}

async function ensureLocalRepo(win, projectId, dir, branch) {
  if (!(await hasCommand('git'))) return { ok: false, error: 'Git n’est pas installé.' }
  ensureGitignore(dir)
  const inside = await run('git rev-parse --is-inside-work-tree', dir)
  if (!inside.ok) {
    const init = await logged(win, projectId, `git init -b ${q(branch)}`, dir, 'git init')
    if (!init.ok) return { ok: false, error: init.stderr || 'git init a échoué.' }
  }
  const add = await logged(win, projectId, 'git add -A', dir, 'indexation')
  if (!add.ok) return { ok: false, error: add.stderr || 'git add a échoué.' }

  const dirty = await run('git status --porcelain', dir)
  if (dirty.stdout.trim()) {
    const id = await gitIdentity(dir)
    const msg = 'Initial commit'
    const commit = await logged(
      win,
      projectId,
      `git -c user.name=${q(id.name)} -c user.email=${q(id.email)} commit -m ${q(msg)}`,
      dir,
      'commit initial'
    )
    if (!commit.ok) return { ok: false, error: commit.stderr || 'git commit a échoué.' }
  }
  return { ok: true }
}

async function currentRemote(dir) {
  const r = await run('git remote get-url origin', dir)
  if (!r.ok) return null
  return r.stdout.trim() || null
}

async function currentBranch(dir, fallback = 'main') {
  const r = await run('git rev-parse --abbrev-ref HEAD', dir)
  const name = r.stdout.trim()
  return name && name !== 'HEAD' ? name : fallback
}

export async function publish(win, projectId, dir, options) {
  const opts = resolveOptions(options, options)
  if (!opts.create) return { ok: true, skipped: true, repo: null }

  if (!existsSync(dir)) return { ok: false, error: 'Dossier introuvable.', repo: null }

  if (opts.provider === 'origin' && isWin) {
    return {
      ok: false,
      error: 'Cursor Origin n’est pas disponible sur Windows. Passe sur GitHub dans les réglages.',
      repo: null
    }
  }

  const local = await ensureLocalRepo(win, projectId, dir, opts.branch)
  if (!local.ok) return { ok: false, error: local.error, repo: null }

  if (opts.provider === 'origin') return publishOrigin(win, projectId, dir, opts)
  return publishGithub(win, projectId, dir, opts)
}

async function publishGithub(win, projectId, dir, opts) {
  if (!(await hasCommand('gh'))) {
    return { ok: false, error: 'GitHub CLI (gh) n’est pas installé.', repo: null }
  }
  const who = await run('gh api user --jq .login', dir)
  if (!who.ok || !who.stdout.trim()) {
    return { ok: false, error: 'GitHub n’est pas connecté. Lance gh auth login.', repo: null }
  }
  const user = who.stdout.trim()
  const name = opts.name || 'projet'
  const full = opts.org ? `${opts.org}/${name}` : name
  const visibility = opts.visibility === 'public' ? '--public' : '--private'
  const desc = opts.description || `Projet ${name} — PDC Builder`

  const existing = await currentRemote(dir)
  if (existing) {
    const push = await logged(win, projectId, 'git push -u origin HEAD', dir, 'push')
    const url = pageUrl('github', existing, name)
    const repo = { provider: 'github', name, url, remote: existing, visibility: opts.visibility }
    return push.ok
      ? { ok: true, repo }
      : { ok: false, error: push.stderr || 'git push a échoué.', repo }
  }

  const created = await logged(
    win,
    projectId,
    `gh repo create ${q(full)} ${visibility} --source=. --remote=origin --push --description ${q(desc)}`,
    dir,
    `dépôt GitHub — ${full}`
  )
  const remote = (await currentRemote(dir)) || firstHttps(created.stdout) || firstHttps(created.stderr)
  const url = pageUrl('github', remote, name) || (opts.org
    ? `https://github.com/${opts.org}/${name}`
    : `https://github.com/${user}/${name}`)
  const repo = { provider: 'github', name, url, remote: remote || url, visibility: opts.visibility }
  if (!created.ok) return { ok: false, error: (created.stderr || created.stdout || 'gh repo create a échoué.').trim(), repo: remote ? repo : null }
  return { ok: true, repo }
}

async function publishOrigin(win, projectId, dir, opts) {
  const bin = originBin()
  const name = opts.name || 'projet'
  const created = await logged(win, projectId, `${q(bin)} repo create ${q(name)}`, dir, 'dépôt Cursor Origin')
  if (!created.ok) {
    return { ok: false, error: (created.stderr || created.stdout || 'origin repo create a échoué.').trim(), repo: null }
  }
  const clone = firstHttps(`${created.stdout}\n${created.stderr}`)
  if (!clone) {
    return { ok: false, error: 'Origin a créé le dépôt mais l’URL de clone est introuvable.', repo: null }
  }
  const existing = await currentRemote(dir)
  if (!existing) {
    const add = await logged(win, projectId, `git remote add origin ${q(clone)}`, dir, 'remote origin')
    if (!add.ok) return { ok: false, error: add.stderr || 'git remote add a échoué.', repo: null }
  }
  const push = await logged(win, projectId, 'git push -u origin HEAD', dir, 'push')
  const repo = {
    provider: 'origin',
    name,
    url: pageUrl('origin', clone, name) || clone,
    remote: clone,
    visibility: 'private'
  }
  if (!push.ok) return { ok: false, error: push.stderr || 'git push a échoué.', repo }
  return { ok: true, repo }
}

export async function push(win, projectId, dir) {
  if (!existsSync(dir)) return { ok: false, error: 'Dossier introuvable.' }
  const remote = await currentRemote(dir)
  if (!remote) return { ok: false, error: 'Aucun remote origin. Crée ou lie un dépôt d’abord.' }
  const add = await logged(win, projectId, 'git add -A', dir, 'indexation')
  if (!add.ok) return { ok: false, error: add.stderr || 'git add a échoué.' }
  const dirty = await run('git status --porcelain', dir)
  if (dirty.stdout.trim()) {
    const id = await gitIdentity(dir)
    const branch = await currentBranch(dir)
    const commit = await logged(
      win,
      projectId,
      `git -c user.name=${q(id.name)} -c user.email=${q(id.email)} commit -m ${q('Update')}`,
      dir,
      `commit · ${branch}`
    )
    if (!commit.ok) return { ok: false, error: commit.stderr || 'git commit a échoué.' }
  }
  const pushed = await logged(win, projectId, 'git push -u origin HEAD', dir, 'push')
  if (!pushed.ok) return { ok: false, error: pushed.stderr || 'git push a échoué.' }
  const head = (await recentCommits(dir, 1))[0] || null
  return {
    ok: true,
    url: pageUrl(providerFromUrl(remote), remote),
    head,
    branch: await currentBranch(dir)
  }
}

export async function link(win, projectId, dir, url) {
  const remote = String(url || '').trim()
  if (!remote) return { ok: false, error: 'URL du dépôt manquante.' }
  if (!existsSync(dir)) return { ok: false, error: 'Dossier introuvable.' }
  const local = await ensureLocalRepo(win, projectId, dir, 'main')
  if (!local.ok) return { ok: false, error: local.error }
  const existing = await currentRemote(dir)
  const cmd = existing
    ? `git remote set-url origin ${q(remote)}`
    : `git remote add origin ${q(remote)}`
  const set = await logged(win, projectId, cmd, dir, existing ? 'mise à jour du remote' : 'liaison du remote')
  if (!set.ok) return { ok: false, error: set.stderr || 'git remote a échoué.' }
  const provider = providerFromUrl(remote)
  const name = repoNameFromUrl(remote)
  return {
    ok: true,
    repo: repoFromRemote(remote) || {
      provider,
      name,
      url: pageUrl(provider, remote, name) || remote,
      remote,
      visibility: provider === 'origin' ? 'private' : null
    }
  }
}

function githubFullName(url) {
  const m = String(url || '').match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i)
  if (!m) return null
  return `${m[1]}/${m[2].replace(/\.git$/i, '')}`
}

function originFullName(url) {
  const m = String(url || '').match(/origin\.cursor\.com\/([^/\s]+\/[^/\s.]+)/i)
    || String(url || '').match(/cursor\.com\/codebase\/([^/\s]+\/[^/\s.]+)/i)
  return m ? m[1].replace(/\.git$/i, '') : null
}

export function resolveCloneSource(payload = {}) {
  let url = String(payload.url || '').trim()
  const repo = String(payload.repo || '').trim().replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '')
  const providerHint = payload.provider === 'origin' ? 'origin' : 'github'

  if (/^git@github\.com:/i.test(url)) {
    url = `https://github.com/${url.replace(/^git@github\.com:/i, '')}`
  } else if (/^(github\.com|origin\.cursor\.com)\//i.test(url)) {
    url = `https://${url}`
  }

  if (url) {
    const provider = providerFromUrl(url)
    const fullName = provider === 'origin' ? originFullName(url) : githubFullName(url)
    return {
      provider,
      fullName: fullName || repo || null,
      url,
      name: repoNameFromUrl(fullName || url)
    }
  }

  if (!repo) return null
  const fullName = repo.includes('/') ? repo : null
  const cloneUrl = providerHint === 'origin'
    ? (fullName ? `https://origin.cursor.com/${fullName}.git` : null)
    : (fullName ? `https://github.com/${fullName}.git` : `https://github.com/${repo}.git`)
  return {
    provider: providerHint,
    fullName: fullName || repo,
    url: cloneUrl,
    name: repoNameFromUrl(fullName || repo)
  }
}

function mapGithubRepo(row) {
  const fullName = row.nameWithOwner || row.full_name || row.name
  const url = row.url || (fullName ? `https://github.com/${fullName}` : null)
  return {
    id: fullName,
    name: row.name || repoNameFromUrl(fullName),
    fullName,
    description: row.description || '',
    url,
    private: Boolean(row.isPrivate ?? row.private),
    updatedAt: row.updatedAt || row.updated_at || null,
    provider: 'github'
  }
}

export async function listRepos(provider, { org, limit = 100 } = {}) {
  if (provider === 'origin') {
    if (isWin) {
      return {
        ok: false,
        repos: [],
        error: 'Cursor Origin n’est pas disponible sur Windows. Colle l’URL HTTPS du dépôt.'
      }
    }
    const bin = originBin()
    if (!(bin !== 'origin' || await hasCommand('origin'))) {
      return { ok: false, repos: [], error: 'CLI Origin introuvable. Colle l’URL, ou installe origin.' }
    }
    const listed = await run(`${q(bin)} repo list`, homedir())
    if (!listed.ok) {
      return { ok: false, repos: [], error: (listed.stderr || listed.stdout || 'origin repo list a échoué.').trim() }
    }
    const repos = []
    const seen = new Set()
    for (const line of String(listed.stdout || '').split(/\r?\n/)) {
      const full = (line.match(/([\w.-]+\/[\w.-]+)/) || [])[1]
      const href = firstHttps(line)
      const fullName = full || originFullName(href)
      if (!fullName || seen.has(fullName)) continue
      if (/^name$/i.test(fullName.split('/')[0])) continue
      seen.add(fullName)
      repos.push({
        id: fullName,
        name: repoNameFromUrl(fullName),
        fullName,
        description: '',
        url: pageUrl('origin', href, fullName) || href || `${ORIGIN_PAGE}/${fullName}`,
        private: true,
        updatedAt: null,
        provider: 'origin'
      })
    }
    return { ok: true, repos }
  }

  if (!(await hasCommand('gh'))) {
    return { ok: false, repos: [], error: 'GitHub CLI (gh) n’est pas installé. Colle l’URL du dépôt.' }
  }
  const who = await run('gh api user --jq .login', homedir())
  if (!who.ok || !who.stdout.trim()) {
    return { ok: false, repos: [], error: 'GitHub n’est pas connecté. Lance gh auth login, ou colle l’URL.' }
  }
  const target = org ? ` ${q(org)}` : ''
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const listed = await run(
    `gh repo list${target} --limit ${cap} --json name,nameWithOwner,description,url,isPrivate,updatedAt`,
    homedir()
  )
  if (!listed.ok) {
    return { ok: false, repos: [], error: (listed.stderr || listed.stdout || 'gh repo list a échoué.').trim() }
  }
  let rows = []
  try { rows = JSON.parse(listed.stdout || '[]') }
  catch { return { ok: false, repos: [], error: 'Réponse GitHub illisible.' } }
  return {
    ok: true,
    user: who.stdout.trim(),
    repos: (Array.isArray(rows) ? rows : []).map(mapGithubRepo)
  }
}

/** Indique si un projet local correspond déjà à ce dépôt distant. */
export function projectOwnsRepo(project, remoteRepo) {
  if (!project || !remoteRepo) return false
  const full = String(remoteRepo.fullName || '').toLowerCase()
  const url = normalizeRemote(remoteRepo.url || remoteRepo.remote || '')
  const pFull = String(project.repo?.fullName || '').toLowerCase()
  const pUrl = normalizeRemote(project.repo?.remote || project.repo?.url || '')
  if (full && (pFull === full || pUrl.includes(full))) return true
  if (url && pUrl && url === pUrl) return true
  const folder = String(project.path || '').replace(/\\/g, '/').split('/').pop()?.toLowerCase()
  if (folder && remoteRepo.name && folder === String(remoteRepo.name).toLowerCase() && project.repo) return true
  return false
}

export function detectFramework(dir, frameworks = []) {
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath)) return frameworks[0]?.id || null
  let pkg
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) }
  catch { return frameworks[0]?.id || null }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
  const has = (name) => Boolean(deps[name])
  const pick = (id) => (frameworks.some((f) => f.id === id) ? id : null)
  if (has('next')) return pick('next') || 'next'
  if (has('nuxt') || has('nuxt3')) return pick('nuxt') || 'nuxt'
  if (has('@sveltejs/kit')) return pick('sveltekit') || 'sveltekit'
  if (has('astro')) return pick('astro') || 'astro'
  if (has('electron') && has('react')) return pick('electron-react') || 'electron-react'
  if (has('vue') && has('vite')) return pick('vite-vue') || 'vite-vue'
  if (has('svelte') && has('vite')) return pick('vite-svelte') || 'vite-svelte'
  if (has('react') && has('vite')) return pick('vite-react') || 'vite-react'
  if (has('vite')) return pick('vite-vanilla') || 'vite-vanilla'
  return frameworks[0]?.id || null
}

export function installCommand(dir) {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm install'
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn install'
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun install'
  return 'npm install'
}

export async function clone(win, projectId, dest, payload) {
  const source = resolveCloneSource(payload)
  if (!source?.url && !source?.fullName) {
    return { ok: false, error: 'Indique un dépôt (owner/nom) ou colle une URL.', repo: null }
  }
  if (!(await hasCommand('git'))) return { ok: false, error: 'Git n’est pas installé.', repo: null }

  let cloned
  if (source.provider === 'github' && source.fullName && await hasCommand('gh')) {
    cloned = await logged(
      win,
      projectId,
      `gh repo clone ${q(source.fullName)} ${q(dest)}`,
      homedir(),
      `clone GitHub — ${source.fullName}`
    )
  } else if (source.provider === 'origin' && source.fullName && !isWin) {
    const bin = originBin()
    const parent = dirname(dest)
    cloned = await logged(
      win,
      projectId,
      `${q(bin)} repo clone ${q(source.fullName)}`,
      parent,
      `clone Origin — ${source.fullName}`
    )
    const landed = join(parent, source.name)
    if (cloned.ok && existsSync(landed) && landed !== dest) {
      try { renameSync(landed, dest) }
      catch (e) { return { ok: false, error: e.message, repo: null } }
    }
    if (!cloned.ok && source.url) {
      cloned = await logged(win, projectId, `git clone ${q(source.url)} ${q(dest)}`, homedir(), 'clone git')
    }
  } else {
    cloned = await logged(win, projectId, `git clone ${q(source.url)} ${q(dest)}`, homedir(), 'clone git')
  }

  if (!cloned.ok) {
    return { ok: false, error: (cloned.stderr || cloned.stdout || 'Le clonage a échoué.').trim(), repo: null }
  }

  const remote = (await currentRemote(dest)) || source.url
  const provider = providerFromUrl(remote) || source.provider
  const name = repoNameFromUrl(remote) || source.name
  return {
    ok: true,
    repo: {
      provider,
      name,
      url: pageUrl(provider, remote, name) || remote,
      remote,
      visibility: provider === 'origin' ? 'private' : null
    }
  }
}

export async function pull(win, projectId, dir) {
  if (!existsSync(dir)) return { ok: false, error: 'Dossier introuvable.' }
  const remote = await currentRemote(dir)
  if (!remote) return { ok: false, error: 'Aucun remote origin. Lie un dépôt d’abord.' }
  const pulled = await logged(win, projectId, 'git pull --ff-only', dir, 'pull')
  if (!pulled.ok) return { ok: false, error: pulled.stderr || pulled.stdout || 'git pull a échoué (avance rapide seulement).' }
  return { ok: true, url: pageUrl(providerFromUrl(remote), remote) }
}

function parseLogLine(line) {
  const parts = String(line || '').split('\t')
  if (parts.length < 5) return null
  const [hash, author, email, ts, ...rest] = parts
  const at = Number(ts) * 1000
  if (!hash || !Number.isFinite(at)) return null
  return {
    hash: hash.slice(0, 7),
    fullHash: hash,
    author: author || 'inconnu',
    email: email || '',
    at,
    message: rest.join('\t').trim() || '(sans message)'
  }
}

async function recentCommits(dir, limit = 5) {
  const r = await run(`git log -n ${limit} --pretty=format:%H%x09%an%x09%ae%x09%ct%x09%s`, dir)
  if (!r.ok || !r.stdout.trim()) return []
  return r.stdout.trim().split(/\r?\n/).map(parseLogLine).filter(Boolean)
}

/** État local d’un dépôt pour la carte de suivi des push. */
export async function inspect(dir) {
  if (!dir || !existsSync(dir)) {
    return { ok: false, error: 'Dossier introuvable.', state: 'missing' }
  }
  const inside = await run('git rev-parse --is-inside-work-tree', dir)
  if (!inside.ok || inside.stdout.trim() !== 'true') {
    return { ok: false, error: 'Pas un dépôt Git.', state: 'nogit' }
  }

  const branch = await currentBranch(dir)
  const remote = await currentRemote(dir)
  const repo = remote ? repoFromRemote(remote) : null
  const dirty = await run('git status --porcelain', dir)
  const dirtyLines = dirty.ok ? dirty.stdout.trim().split(/\r?\n/).filter(Boolean) : []
  const dirtyCount = dirtyLines.length

  let ahead = 0
  let behind = 0
  let upstream = null
  if (remote) {
    const up = await run('git rev-parse --abbrev-ref --symbolic-full-name @{u}', dir)
    if (up.ok && up.stdout.trim()) {
      upstream = up.stdout.trim()
      const counts = await run('git rev-list --left-right --count HEAD...@{u}', dir)
      if (counts.ok) {
        const [a, b] = counts.stdout.trim().split(/\s+/).map((n) => Number(n) || 0)
        ahead = a
        behind = b
      }
    }
  }

  const commits = await recentCommits(dir, 6)
  const head = commits[0] || null

  let state = 'synced'
  if (!remote) state = 'noremote'
  else if (dirtyCount > 0) state = 'draft'
  else if (ahead > 0 && behind > 0) state = 'diverged'
  else if (ahead > 0) state = 'ahead'
  else if (behind > 0) state = 'behind'
  else state = 'synced'

  return {
    ok: true,
    state,
    branch,
    upstream,
    remote,
    repo,
    dirtyCount,
    ahead,
    behind,
    head,
    commits
  }
}

/**
 * Carte des push : un snapshot par projet (local ou distant).
 * @param {Array} projects
 */
export async function board(projects = []) {
  const rows = await Promise.all((projects || []).map(async (p) => {
    const base = {
      projectId: p.id,
      name: p.name,
      remoteOnly: Boolean(p.remoteOnly),
      path: p.path || null,
      lastPushAt: p.lastPushAt || null,
      repo: p.repo || null
    }

    if (p.remoteOnly || p.exists === false) {
      return {
        ...base,
        ok: true,
        state: p.remoteOnly ? 'remote' : 'missing',
        branch: null,
        dirtyCount: 0,
        ahead: 0,
        behind: 0,
        head: p.repo?.updatedAt
          ? { at: Date.parse(p.repo.updatedAt) || null, message: 'Activité GitHub', author: '', hash: '' }
          : null,
        commits: []
      }
    }

    const snap = await inspect(p.path)
    return {
      ...base,
      ...snap,
      repo: snap.repo || p.repo || null
    }
  }))

  const order = { draft: 0, ahead: 1, diverged: 2, behind: 3, noremote: 4, remote: 5, missing: 6, nogit: 7, synced: 8 }
  rows.sort((a, b) => {
    const sa = order[a.state] ?? 9
    const sb = order[b.state] ?? 9
    if (sa !== sb) return sa - sb
    const ta = a.head?.at || a.lastPushAt || 0
    const tb = b.head?.at || b.lastPushAt || 0
    return tb - ta
  })

  const summary = {
    total: rows.length,
    draft: rows.filter((r) => r.state === 'draft').length,
    ahead: rows.filter((r) => r.state === 'ahead' || r.state === 'diverged').length,
    behind: rows.filter((r) => r.state === 'behind').length,
    synced: rows.filter((r) => r.state === 'synced').length,
    remote: rows.filter((r) => r.state === 'remote').length
  }

  return { ok: true, at: Date.now(), summary, rows }
}

function dayKey(ts) {
  const d = new Date(ts)
  if (!Number.isFinite(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfLocalDay(ts = Date.now()) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Calendrier d’activité style GitHub : commits locaux + push atelier, par jour.
 * @param {Array} projects
 * @param {Array} pushLog
 * @param {number} weeks
 */
export async function activityCalendar(projects = [], pushLog = [], weeks = 17) {
  const today = startOfLocalDay()
  const spanDays = weeks * 7
  const sinceTs = today - (spanDays - 1) * 86400000
  const sinceSec = Math.floor(sinceTs / 1000)
  const byDay = new Map()

  const bump = (at, event) => {
    const key = dayKey(at)
    if (!key) return
    const t = startOfLocalDay(at)
    if (t < sinceTs || t > today) return
    let row = byDay.get(key)
    if (!row) {
      row = { date: key, at: t, count: 0, events: [] }
      byDay.set(key, row)
    }
    row.count += 1
    if (row.items.length < 12) row.items.push(event)
  }

  await Promise.all((projects || []).map(async (p) => {
    if (!p?.path || p.remoteOnly || p.exists === false || !existsSync(p.path)) return
    const inside = await run('git rev-parse --is-inside-work-tree', p.path)
    if (!inside.ok || inside.stdout.trim() !== 'true') return
    const log = await run(
      `git log --all --since=${sinceSec} --pretty=format:%ct%x09%h%x09%s`,
      p.path
    )
    if (!log.ok || !log.stdout.trim()) return
    for (const line of log.stdout.trim().split(/\r?\n/)) {
      const [sec, hash, ...rest] = line.split('\t')
      const at = Number(sec) * 1000
      if (!Number.isFinite(at)) continue
      bump(at, {
        type: 'commit',
        projectId: p.id,
        name: p.name,
        hash: (hash || '').slice(0, 7),
        message: rest.join('\t').trim() || 'Commit',
        at
      })
    }
  }))

  for (const entry of pushLog || []) {
    if (!entry?.at) continue
    bump(entry.at, {
      type: 'push',
      projectId: entry.projectId,
      name: entry.name,
      hash: entry.hash || '',
      message: entry.message || 'Push',
      at: entry.at,
      url: entry.url || null
    })
  }

  const days = []
  for (let i = 0; i < spanDays; i++) {
    const at = sinceTs + i * 86400000
    const key = dayKey(at)
    const hit = byDay.get(key)
    days.push(hit || { date: key, at, count: 0, items: [] })
  }

  const max = days.reduce((n, d) => Math.max(n, d.count), 0)
  const total = days.reduce((n, d) => n + d.count, 0)
  const activeDays = days.filter((d) => d.count > 0).length

  return {
    weeks,
    since: sinceTs,
    until: today,
    max,
    total,
    activeDays,
    days
  }
}