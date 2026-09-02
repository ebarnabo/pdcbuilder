/**
 * Cache local de la documentation des librairies.
 * Source : registre npm (liens + README) puis pages docs / llms.txt.
 * Fichiers .md dans userData, copiés dans chaque projet (.pdc/docs) pour les agents.
 */
import { app, shell } from 'electron'
import { join } from 'path'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync
} from 'fs'

const TTL_MS = 7 * 24 * 60 * 60 * 1000
const CONCURRENCY = 3
const MAX_PAGES = 5
const MAX_MD = 70_000
const MAX_README = 42_000
const TIMEOUT = 12_000
const UA = 'PDC-Builder/1.0 (+https://github.com/ebarnabo/pdcbuilder)'
const DOC_PATH = /\/(docs?|guide|guides|api|learn|reference|manual|getting-started|tutorial|tutorials|components|hooks|examples|llms)(\/|$)/i
const SKIP_PATH = /(\/login|\/signup|\/pricing|\/careers|\/privacy|\/terms|\/blog\/|\/changelog|\/jobs|\.(png|jpe?g|gif|svg|webp|css|js|mjs|woff2?|mp4)$)/i

let onStatus = () => {}
let getLibraries = () => []
let getProjects = () => []
let queueRunning = false
let timer = null

const snapshot = {
  status: 'idle',
  done: 0,
  total: 0,
  updated: 0,
  failed: 0,
  current: null,
  lastRun: null
}

function rootDir() {
  return join(app.getPath('userData'), 'docs')
}
function libDir() {
  return join(rootDir(), 'libraries')
}
function indexPath() {
  return join(rootDir(), 'index.json')
}
function slugPkg(pkg) {
  return String(pkg).replace(/^@/, '').replace(/\//g, '__')
}
function fileFor(pkg) {
  return join(libDir(), `${slugPkg(pkg)}.md`)
}

function emit() {
  try { onStatus({ ...snapshot }) } catch { /* fenêtre fermée */ }
}

function loadIndex() {
  try {
    if (existsSync(indexPath())) return JSON.parse(readFileSync(indexPath(), 'utf8'))
  } catch { /* ignore */ }
  return { updatedAt: null, packages: {} }
}

function saveIndex(index) {
  mkdirSync(rootDir(), { recursive: true })
  index.updatedAt = new Date().toISOString()
  writeFileSync(indexPath(), JSON.stringify(index, null, 2), 'utf8')
  writeIndexMarkdown(index)
}

function writeIndexMarkdown(index) {
  const rows = Object.values(index.packages || {})
    .sort((a, b) => String(a.name || a.pkg).localeCompare(String(b.name || b.pkg)))
    .map((m) => {
      const url = m.docsUrl || m.homepage || ''
      const pages = (m.pages || []).length
      return `- **${m.name || m.pkg}** (\`${m.pkg}\`) — ${url || 'pas d’URL'}${pages ? ` · ${pages} pages` : ''}${m.ok === false ? ' · incomplet' : ''}`
    })
  const md = [
    '# Documentation des librairies',
    '',
    'Extraits locaux pour les agents IA (PDC Builder).',
    `Dernière passe : ${index.updatedAt || 'jamais'}.`,
    '',
    ...rows,
    ''
  ].join('\n')
  writeFileSync(join(rootDir(), 'index.md'), md, 'utf8')
}

function decode(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

function stripTags(s) {
  return decode(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function absUrl(href, base) {
  try { return new URL(href, base).href } catch { return null }
}

function repoUrl(repo) {
  if (!repo) return null
  let raw = typeof repo === 'string' ? repo : repo.url
  if (!raw) return null
  raw = raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '')
  if (raw.startsWith('github:')) raw = `https://github.com/${raw.slice(7)}`
  if (raw.startsWith('git@github.com:')) raw = `https://github.com/${raw.slice('git@github.com:'.length)}`
  return raw
}

async function fetchRes(url, type = 'text') {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: type === 'json' ? 'application/json' : 'text/html,text/markdown,text/plain,*/*' }
    })
    const ct = res.headers.get('content-type') || ''
    if (type === 'json') {
      const json = await res.json().catch(() => null)
      return { ok: res.ok, status: res.status, json, url: res.url, ct }
    }
    const text = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, text, url: res.url, ct }
  } catch (err) {
    return { ok: false, status: 0, text: '', json: null, url, ct: '', error: err.message }
  } finally {
    clearTimeout(t)
  }
}

function mdLinks(md, base) {
  const out = []
  const re = /\[([^\]]+)\]\((https?:[^)\s]+|\/[^)\s]+)\)/g
  let m
  while ((m = re.exec(md))) {
    const href = absUrl(m[2], base)
    if (href) out.push({ title: m[1].trim(), url: href })
  }
  return out
}

function htmlLinks(html, base) {
  const out = []
  const re = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = absUrl(m[1], base)
    if (!href || href.startsWith('mailto:') || href.startsWith('javascript:')) continue
    out.push({ title: stripTags(m[2]).slice(0, 80), url: href })
  }
  return out
}

function scoreLink(link, host) {
  let s = 0
  try {
    const u = new URL(link.url)
    if (u.host === host || u.host.endsWith(`.${host}`)) s += 4
    if (DOC_PATH.test(u.pathname)) s += 8
    if (/llms\.txt$/i.test(u.pathname)) s += 20
    if (SKIP_PATH.test(u.pathname)) s -= 20
    if (u.hash) s -= 1
  } catch { return -99 }
  if (/doc|guide|api|getting started|reference/i.test(link.title || '')) s += 3
  return s
}

function pickPages(links, homepage) {
  let host = ''
  try { host = new URL(homepage || links[0]?.url || 'https://example.com').host } catch { /* ignore */ }
  const seen = new Set()
  const ranked = []
  for (const link of links) {
    const clean = (link.url || '').split('#')[0]
    if (!clean || seen.has(clean)) continue
    if (SKIP_PATH.test(clean)) continue
    const sc = scoreLink({ ...link, url: clean }, host)
    if (sc < 4) continue
    seen.add(clean)
    ranked.push({ ...link, url: clean, score: sc })
  }
  ranked.sort((a, b) => b.score - a.score)
  return ranked.slice(0, 40)
}

function htmlToMarkdown(html, base) {
  let s = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
  const main = s.match(/<main[\s\S]*?<\/main>/i) || s.match(/<article[\s\S]*?<\/article>/i)
  if (main) s = main[0]
  s = s
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n${'#'.repeat(Number(n))} ${stripTags(t)}\n`)
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, t) => `\n\`\`\`\n${decode(t.replace(/<[^>]+>/g, ''))}\n\`\`\`\n`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${stripTags(t)}\``)
    .replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
      const u = absUrl(href, base)
      const label = stripTags(t)
      return u && label ? `[${label}](${u})` : label
    })
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${stripTags(t)}\n`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n${stripTags(t)}\n`)
    .replace(/<[^>]+>/g, ' ')
  return decode(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

async function npmLatest(pkg) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`
  const r = await fetchRes(url, 'json')
  if (!r.ok || !r.json) throw new Error(r.error || `npm ${r.status}`)
  return r.json
}

async function githubReadme(repo) {
  const m = String(repo || '').match(/github\.com\/([^/]+)\/([^/#?]+)/i)
  if (!m) return ''
  const owner = m[1]
  const repoName = m[2].replace(/\.git$/, '')
  for (const branch of ['HEAD', 'main', 'master']) {
    const r = await fetchRes(`https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/README.md`)
    if (r.ok && r.text && r.text.length > 40 && !r.ct.includes('text/html')) return r.text
  }
  return ''
}

async function fetchReadme(pkg, repository) {
  const fromGithub = await githubReadme(repository)
  if (fromGithub) return fromGithub
  for (const url of [
    `https://cdn.jsdelivr.net/npm/${pkg}/README.md`,
    `https://unpkg.com/${pkg}/README.md`
  ]) {
    const r = await fetchRes(url)
    if (r.ok && r.text && r.text.length > 40 && !r.ct.includes('text/html')) return r.text
  }
  return ''
}

async function tryLlms(homepage) {
  if (!homepage) return { url: null, text: '' }
  let origin
  try { origin = new URL(homepage).origin } catch { return { url: null, text: '' } }
  const candidates = [
    absUrl('/llms.txt', homepage),
    absUrl('/docs/llms.txt', homepage),
    `${origin}/llms.txt`
  ].filter(Boolean)
  for (const url of candidates) {
    const r = await fetchRes(url)
    if (r.ok && r.text && !r.ct.includes('html') && r.text.length > 40) {
      return { url: r.url || url, text: r.text }
    }
  }
  return { url: null, text: '' }
}

function buildMarkdown(item, meta, parts) {
  const pages = meta.pages || []
  const body = [
    `# ${item.name} (\`${item.pkg}\`)`,
    '',
    item.description || meta.description || '',
    '',
    '## Liens',
    meta.docsUrl ? `- Documentation : ${meta.docsUrl}` : '',
    meta.homepage ? `- Site : ${meta.homepage}` : '',
    meta.repository ? `- Dépôt : ${meta.repository}` : '',
    `- npm : https://www.npmjs.com/package/${item.pkg}`,
    meta.version ? `- Version : ${meta.version}` : '',
    '',
    pages.length ? '## Pages de documentation' : '',
    ...pages.map((p) => `- [${p.title || p.url}](${p.url})`),
    '',
    ...parts
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n')
  return body.slice(0, MAX_MD)
}

async function ingest(item, { force = false } = {}) {
  mkdirSync(libDir(), { recursive: true })
  const index = loadIndex()
  const prev = index.packages[item.pkg]
  const stale = !prev?.fetchedAt || Date.now() - prev.fetchedAt > TTL_MS
  if (!force && prev?.ok && existsSync(fileFor(item.pkg)) && !stale) return { skipped: true }

  const meta = {
    name: item.name,
    pkg: item.pkg,
    description: item.description || '',
    version: null,
    homepage: item.docs || null,
    docsUrl: item.docs || null,
    repository: null,
    pages: [],
    fetchedAt: Date.now(),
    ok: false,
    error: null,
    file: `libraries/${slugPkg(item.pkg)}.md`
  }

  const parts = []
  try {
    const npm = await npmLatest(item.pkg)
    meta.version = npm.version || null
    meta.description = meta.description || npm.description || ''
    meta.homepage = item.docs || npm.homepage || meta.homepage
    meta.repository = repoUrl(npm.repository)
    meta.docsUrl = item.docs || npm.homepage || meta.repository
    let readme = typeof npm.readme === 'string' ? npm.readme : ''
    if (!readme) readme = await fetchReadme(item.pkg, meta.repository)

    const llms = await tryLlms(meta.docsUrl || meta.homepage)
    if (llms.text) {
      meta.docsUrl = meta.docsUrl || llms.url
      parts.push('## llms.txt', '', llms.text.slice(0, MAX_README), '')
    }

    const seedLinks = [
      meta.docsUrl && { title: 'Documentation', url: meta.docsUrl },
      meta.homepage && { title: 'Site', url: meta.homepage }
    ].filter(Boolean)
    if (readme) seedLinks.push(...mdLinks(readme, meta.homepage || meta.docsUrl || 'https://www.npmjs.com'))

    let homeHtml = ''
    const home = meta.docsUrl || meta.homepage
    if (home) {
      const page = await fetchRes(home)
      if (page.ok && page.text) {
        homeHtml = page.text
        if ((page.ct || '').includes('html')) {
          seedLinks.push(...htmlLinks(page.text, page.url || home))
        } else if (!llms.text) {
          parts.push('## Page principale', '', page.text.slice(0, 16_000), '')
        }
      }
    }

    meta.pages = pickPages(seedLinks, home)
    if (readme) parts.push('## README npm', '', readme.slice(0, MAX_README), '')

    const extra = meta.pages
      .filter((p) => p.url !== home)
      .slice(0, MAX_PAGES)
    for (const p of extra) {
      const page = await fetchRes(p.url)
      if (!page.ok || !page.text) continue
      const md = (page.ct || '').includes('html') || page.text.trim().startsWith('<')
        ? htmlToMarkdown(page.text, page.url || p.url)
        : page.text
      if (md.length < 80) continue
      parts.push(`## ${p.title || p.url}`, '', `Source : ${p.url}`, '', md.slice(0, 10_000), '')
    }

    if (!readme && homeHtml && (homeHtml.includes('<html') || homeHtml.includes('<HTML'))) {
      const converted = htmlToMarkdown(homeHtml, home)
      if (converted.length > 80) parts.push('## Page principale', '', converted.slice(0, 16_000), '')
    }

    meta.ok = true
  } catch (err) {
    meta.error = err.message || String(err)
    parts.push('## Erreur', '', meta.error, '')
  }

  writeFileSync(fileFor(item.pkg), buildMarkdown(item, meta, parts), 'utf8')
  const next = loadIndex()
  next.packages[item.pkg] = meta
  saveIndex(next)
  return { skipped: false, ok: meta.ok }
}

function allItems(libraries) {
  return (libraries || []).flatMap((c) => (c.items || []).map((item) => ({
    ...item,
    docs: item.docs || item.docsUrl || null
  })))
}

async function mapPool(items, n, fn) {
  let i = 0
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
}

function syncProjects(projects, index) {
  for (const project of projects || []) {
    if (!project?.path || !existsSync(project.path)) continue
    const dest = join(project.path, '.pdc', 'docs')
    mkdirSync(dest, { recursive: true })
    const libs = project.libs || []
    const lines = [
      '# Ressources PDC Builder',
      '',
      'Fichiers pour les agents IA dans ce dépôt.',
      '',
      '- [Préférences utilisateur](./preferences.md) — atelier, Git, bases, catalogue, projets.',
      '',
      '## Documentation des librairies',
      '',
      'Extraits locaux générés par PDC Builder pour les agents IA.',
      ''
    ]
    for (const pkg of libs) {
      const src = fileFor(pkg)
      if (!existsSync(src)) continue
      const name = `${slugPkg(pkg)}.md`
      try { copyFileSync(src, join(dest, name)) } catch { continue }
      const meta = index.packages?.[pkg]
      const url = meta?.docsUrl || meta?.homepage || ''
      lines.push(`- [${meta?.name || pkg}](./docs/${name})${url ? ` — ${url}` : ''}`)
    }
    writeFileSync(join(project.path, '.pdc', 'README.md'), `${lines.join('\n')}\n`, 'utf8')
  }
}

export function getSnapshot() {
  return { ...snapshot }
}

export function listIndex() {
  const index = loadIndex()
  return {
    updatedAt: index.updatedAt,
    dir: rootDir(),
    packages: Object.values(index.packages || {}).map((m) => ({
      pkg: m.pkg,
      name: m.name,
      docsUrl: m.docsUrl || m.homepage || null,
      repository: m.repository || null,
      pages: (m.pages || []).length,
      ok: m.ok !== false,
      fetchedAt: m.fetchedAt || null
    }))
  }
}

export function readDoc(pkg) {
  const file = fileFor(pkg)
  if (!existsSync(file)) return null
  return readFileSync(file, 'utf8')
}

export function openFolder() {
  mkdirSync(rootDir(), { recursive: true })
  return shell.openPath(rootDir())
}

export function forPrompt({ query = '', projectLibs = [], maxChars = 28_000 } = {}) {
  const index = loadIndex()
  const pkgs = Object.values(index.packages || {})
  if (!pkgs.length) return ''

  const lines = [
    '## Documentation locale des librairies',
    'Appuie-toi sur ces extraits (README et pages officielles) plutôt que d’inventer une API.',
    ''
  ]
  for (const m of pkgs) {
    lines.push(`- ${m.name || m.pkg} (\`${m.pkg}\`) — ${m.docsUrl || m.homepage || 'sans URL'}`)
  }

  let out = lines.join('\n')
  const wanted = new Set((projectLibs || []).filter(Boolean))
  const q = String(query || '').toLowerCase()
  const tokens = q.split(/[^a-z0-9@/_-]+/).filter((t) => t.length > 2)
  for (const m of pkgs) {
    const pkg = m.pkg.toLowerCase()
    const unscoped = pkg.replace(/^@/, '').split('/').pop()
    const name = String(m.name || '').toLowerCase()
    if (q.includes(pkg) || (unscoped && q.includes(unscoped)) || (name.length > 3 && q.includes(name))) {
      wanted.add(m.pkg)
      continue
    }
    if (tokens.some((t) => pkg.includes(t) || name.includes(t) || t === unscoped)) wanted.add(m.pkg)
  }

  const order = [...wanted].filter((pkg) => index.packages[pkg])
  for (const pkg of order) {
    const md = readDoc(pkg)
    if (!md) continue
    const chunk = `\n\n### ${pkg}\n${md.slice(0, 7_500)}`
    if (out.length + chunk.length > maxChars) {
      out += `\n\n[Documentation tronquée — d’autres fichiers sont dans ${rootDir()}]`
      break
    }
    out += chunk
  }
  return out
}

export async function refresh({ force = false } = {}) {
  if (queueRunning) return getSnapshot()
  const items = allItems(getLibraries())
  if (!items.length) {
    snapshot.status = 'done'
    snapshot.total = 0
    emit()
    return getSnapshot()
  }
  queueRunning = true
  snapshot.status = 'running'
  snapshot.done = 0
  snapshot.total = items.length
  snapshot.updated = 0
  snapshot.failed = 0
  snapshot.current = null
  emit()

  await mapPool(items, CONCURRENCY, async (item) => {
    snapshot.current = item.pkg
    emit()
    try {
      const r = await ingest(item, { force })
      if (!r.skipped) snapshot.updated += 1
      if (r.ok === false) snapshot.failed += 1
    } catch {
      snapshot.failed += 1
    }
    snapshot.done += 1
    emit()
  })

  snapshot.status = 'done'
  snapshot.current = null
  snapshot.lastRun = new Date().toISOString()
  queueRunning = false
  emit()
  try { syncProjects(getProjects(), loadIndex()) } catch { /* ignore */ }
  return getSnapshot()
}

export function enqueue(pkg) {
  const item = allItems(getLibraries()).find((i) => i.pkg === pkg)
  if (!item) return
  ingest(item, { force: true }).then(() => {
    try { syncProjects(getProjects(), loadIndex()) } catch { /* ignore */ }
    emit()
  }).catch(() => {})
}

export function syncAllProjects() {
  try { syncProjects(getProjects(), loadIndex()) } catch { /* ignore */ }
}

export function start(opts = {}) {
  if (opts.onStatus) onStatus = opts.onStatus
  if (opts.getLibraries) getLibraries = opts.getLibraries
  if (opts.getProjects) getProjects = opts.getProjects
  setTimeout(() => { refresh({ force: false }).catch(() => {}) }, 2200)
  if (timer) clearInterval(timer)
  timer = setInterval(() => { refresh({ force: false }).catch(() => {}) }, 24 * 60 * 60 * 1000)
}
