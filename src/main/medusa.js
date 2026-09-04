/**
 * Medusa (e-commerce headless) — scaffold non interactif, prérequis, config auto.
 */
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import { platform } from 'os'
import { randomBytes } from 'crypto'
import * as toolchain from './toolchain.js'

const isWin = platform() === 'win32'

export const STARTERS = [
  {
    id: 'backend',
    name: 'Backend seul',
    blurb: 'API Medusa + admin. Tu branches le front plus tard.'
  },
  {
    id: 'storefront',
    name: 'Backend + Storefront',
    blurb: 'Monorepo avec Next.js Starter Storefront.'
  }
]

export const DB_MODES = [
  {
    id: 'skip',
    name: 'Plus tard',
    blurb: 'Scaffold sans créer la base. Tu poses DATABASE_URL ensuite.',
    requirePostgres: false
  },
  {
    id: 'local',
    name: 'Postgres local',
    blurb: 'Écrit une DATABASE_URL vers 127.0.0.1 (service Postgres requis).',
    requirePostgres: true
  },
  {
    id: 'url',
    name: 'URL fournie',
    blurb: 'Utilise ta chaîne Postgres (Neon, Supabase, local…).',
    requirePostgres: false
  }
]

const MIN_NODE = { major: 20, minor: 0 }

function parseSemver(v) {
  const m = String(v || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!m) return null
  return { major: +m[1], minor: +m[2], patch: +(m[3] || 0) }
}

function nodeOk(version) {
  const v = parseSemver(version)
  if (!v) return false
  if (v.major > MIN_NODE.major) return true
  if (v.major < MIN_NODE.major) return false
  return v.minor >= MIN_NODE.minor
}

function slugify(name) {
  return String(name || 'medusa-store')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'medusa-store'
}

export function normalizeStarter(id) {
  return STARTERS.some((s) => s.id === id) ? id : 'backend'
}

export function normalizeDbMode(id) {
  return DB_MODES.some((d) => d.id === id) ? id : 'skip'
}

export function pmFlag(pmId = 'npm') {
  return ({
    npm: '--use-npm',
    pnpm: '--use-pnpm',
    yarn: '--use-yarn'
  })[pmId] || '--use-npm'
}

function shellQuote(s) {
  const v = String(s ?? '')
  if (/^[a-zA-Z0-9._@:/-]+$/.test(v)) return v
  if (isWin) return `"${v.replace(/"/g, '\\"')}"`
  return `'${v.replace(/'/g, `'\\''`)}'`
}

/**
 * create-medusa-app non interactif.
 * --with-nextjs-starter évite le prompt inquirer ; sinon on pipe « n ».
 */
export function buildCreateCommand({
  name,
  starter = 'backend',
  dbMode = 'skip',
  dbUrl = '',
  pmId = 'npm'
} = {}) {
  const n = slugify(name)
  const st = normalizeStarter(starter)
  const mode = normalizeDbMode(dbMode)
  const parts = [
    'npx --yes create-medusa-app@latest',
    n,
    '--no-browser',
    '--verbose',
    pmFlag(pmId)
  ]

  if (st === 'storefront') parts.push('--with-nextjs-starter')

  if (mode === 'url' && String(dbUrl || '').trim()) {
    parts.push(`--db-url ${shellQuote(String(dbUrl).trim())}`)
    parts.push('--no-migrations')
  } else {
    parts.push('--skip-db')
  }

  let cmd = parts.join(' ')
  // Sans --with-nextjs-starter, le CLI pose une question inquirer → réponse non interactive
  if (st !== 'storefront') {
    cmd = isWin ? `echo n| ${cmd}` : `printf 'n\\n' | ${cmd}`
  }
  return cmd
}

export async function checkPrereqs(dbMode = 'skip') {
  const status = await toolchain.status()
  const byId = Object.fromEntries([
    ...(status.tools || []).map((t) => [t.id, t]),
    ...(status.python || []).map((t) => [t.id, t])
  ])
  const mode = DB_MODES.find((d) => d.id === normalizeDbMode(dbMode)) || DB_MODES[0]
  const rows = []

  const node = byId.node
  const nodeVersion = node?.version || null
  const nodeReady = Boolean(node?.installed && nodeOk(nodeVersion))
  rows.push({
    id: 'node',
    toolId: 'node',
    name: 'Node.js LTS',
    detail: nodeReady
      ? `v${nodeVersion}`
      : node?.installed
        ? `v${nodeVersion || '?'} — Medusa 2 exige ≥ ${MIN_NODE.major}`
        : `Absent — ≥ ${MIN_NODE.major} requis`,
    required: true,
    ok: nodeReady,
    installed: Boolean(node?.installed),
    canInstall: Boolean(node?.canInstall || (node?.installed && !nodeReady && node?.canUpdate)),
    installAs: 'node',
    hint: 'Runtime JS. create-medusa-app inclut npm install.'
  })

  const git = byId.git
  rows.push({
    id: 'git',
    toolId: 'git',
    name: 'Git',
    detail: git?.installed ? (git.version ? `v${git.version}` : 'Détecté') : 'Absent',
    required: true,
    ok: Boolean(git?.installed),
    installed: Boolean(git?.installed),
    canInstall: Boolean(git?.canInstall),
    installAs: 'git',
    hint: 'Le scaffold clone le starter Medusa.'
  })

  const pg = byId.postgres
  const pgRequired = Boolean(mode.requirePostgres)
  rows.push({
    id: 'postgres',
    toolId: 'postgres',
    name: 'PostgreSQL',
    detail: pg?.installed
      ? (pg.version ? `v${pg.version}` : 'Détecté')
      : pgRequired
        ? 'Absent — requis pour la DATABASE_URL locale'
        : 'Recommandé pour lancer le serveur (migrations)',
    required: pgRequired,
    ok: pgRequired ? Boolean(pg?.installed) : true,
    installed: Boolean(pg?.installed),
    canInstall: Boolean(pg?.canInstall),
    installAs: 'postgres',
    hint: 'Medusa ne tourne pas sans Postgres. Neon / autre cloud ok via URL.'
  })

  const missing = rows.filter((r) => r.required && !r.ok)
  return {
    starterOptions: STARTERS,
    dbModeOptions: DB_MODES,
    minNode: String(MIN_NODE.major),
    items: rows,
    ready: missing.length === 0,
    missing: missing.map((r) => r.id),
    installer: status.installer
  }
}

function upsertEnv(file, key, value) {
  if (!existsSync(file)) {
    writeFileSync(file, `${key}=${value}\n`, 'utf8')
    return
  }
  const raw = readFileSync(file, 'utf8')
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(raw)) writeFileSync(file, raw.replace(re, `${key}=${value}`), 'utf8')
  else {
    const pad = raw.endsWith('\n') || !raw ? '' : '\n'
    appendFileSync(file, `${pad}${key}=${value}\n`, 'utf8')
  }
}

function ensureEnvKey(file, key, value) {
  if (!existsSync(file)) {
    writeFileSync(file, `${key}=${value}\n`, 'utf8')
    return
  }
  const raw = readFileSync(file, 'utf8')
  if (new RegExp(`^${key}=`, 'm').test(raw)) return
  const pad = raw.endsWith('\n') || !raw ? '' : '\n'
  appendFileSync(file, `${pad}${key}=${value}\n`, 'utf8')
}

function findBackendRoot(projectPath) {
  const candidates = [
    projectPath,
    join(projectPath, 'apps', 'backend'),
    join(projectPath, 'backend')
  ]
  for (const c of candidates) {
    if (existsSync(join(c, 'package.json'))) {
      const pkg = JSON.parse(readFileSync(join(c, 'package.json'), 'utf8'))
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
      if (deps['@medusajs/medusa'] || deps['@medusajs/framework'] || existsSync(join(c, 'medusa-config.ts')) || existsSync(join(c, 'medusa-config.js'))) {
        return c
      }
    }
  }
  // fallback : premier package.json avec script dev
  if (existsSync(join(projectPath, 'apps', 'backend', 'package.json'))) {
    return join(projectPath, 'apps', 'backend')
  }
  return projectPath
}

function defaultLocalDbUrl(name) {
  const db = `medusa-${slugify(name)}`.replace(/-/g, '_')
  return `postgres://postgres@127.0.0.1:5432/${db}`
}

/**
 * Post-scaffold : JWT secrets, DATABASE_URL, guide .pdc.
 */
export function finalize(projectPath, {
  starter = 'backend',
  dbMode = 'skip',
  dbUrl = '',
  name = ''
} = {}) {
  const st = normalizeStarter(starter)
  const mode = normalizeDbMode(dbMode)
  const written = []
  const backend = findBackendRoot(projectPath)
  const envPath = join(backend, '.env')
  const envTemplate = join(backend, '.env.template')

  if (!existsSync(envPath) && existsSync(envTemplate)) {
    writeFileSync(envPath, readFileSync(envTemplate, 'utf8'), 'utf8')
    written.push(join(backend === projectPath ? '' : 'apps/backend/', '.env').replace(/^\//, '') || '.env')
  }

  const jwt = randomBytes(32).toString('hex')
  const cookie = randomBytes(32).toString('hex')
  if (existsSync(envPath) || true) {
    ensureEnvKey(envPath, 'JWT_SECRET', jwt)
    ensureEnvKey(envPath, 'COOKIE_SECRET', cookie)
  }

  let finalUrl = String(dbUrl || '').trim()
  if (mode === 'local' && !finalUrl) finalUrl = defaultLocalDbUrl(name || 'store')
  if (finalUrl) {
    upsertEnv(envPath, 'DATABASE_URL', finalUrl)
  } else {
    ensureEnvKey(envPath, 'DATABASE_URL', defaultLocalDbUrl(name || 'store'))
  }
  written.push(backend === projectPath ? '.env' : 'apps/backend/.env')

  const pdcDir = join(projectPath, '.pdc')
  mkdirSync(pdcDir, { recursive: true })
  const guide = `# Medusa — PDC Builder

E-commerce headless généré avec **create-medusa-app** (non interactif).

| | |
|---|---|
| Starter | \`${st}\` |
| Base | \`${mode}\` |
| Backend | \`${backend === projectPath ? '.' : 'apps/backend'}\` |

## Prérequis

- Node.js ≥ ${MIN_NODE.major}
- Git
- PostgreSQL (local ou \`DATABASE_URL\` cloud)

## Démarrer

\`\`\`bash
${backend === projectPath ? 'npm run dev' : 'cd apps/backend && npm run dev'}
\`\`\`

Admin : http://localhost:9000/app (après migrations).

Si tu as utilisé \`--skip-db\` :

\`\`\`bash
cd ${backend === projectPath ? '.' : 'apps/backend'}
npx medusa db:create
npx medusa db:migrate
\`\`\`

Docs : https://docs.medusajs.com
`
  writeFileSync(join(pdcDir, 'MEDUSA.md'), guide, 'utf8')
  writeFileSync(join(pdcDir, 'medusa.json'), JSON.stringify({
    framework: 'medusa',
    starter: st,
    dbMode: mode,
    backend: backend === projectPath ? '.' : 'apps/backend',
    createdAt: Date.now()
  }, null, 2), 'utf8')
  written.push('.pdc/MEDUSA.md', '.pdc/medusa.json')

  return { ok: true, files: written, starter: st, dbMode: mode, backend }
}

export function isMedusaFramework(fw) {
  if (!fw) return false
  return fw.id === 'medusa' || fw.kind === 'commerce-medusa'
}
