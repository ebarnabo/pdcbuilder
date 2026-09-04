/**
 * Payload CMS — scaffold non interactif, prérequis machine, config auto.
 */
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import { randomBytes } from 'crypto'
import * as toolchain from './toolchain.js'

export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank',
    blurb: 'Next + Payload, collections vides. Le plus léger pour démarrer.'
  },
  {
    id: 'website',
    name: 'Website',
    blurb: 'Site éditorial : pages, médias, SEO, admin prêt.'
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    blurb: 'Catalogue, panier, checkout. Plus lourd, plus complet.'
  }
]

export const DATABASES = [
  {
    id: 'sqlite',
    name: 'SQLite',
    blurb: 'Fichier local. Zéro serveur à installer — idéal pour prototyper.',
    tools: []
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    blurb: 'Document store. Requiert MongoDB sur la machine (ou Atlas).',
    tools: ['mongodb']
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    blurb: 'SQL relationnel. Requiert Postgres local (ou Neon / autre).',
    tools: ['postgres']
  }
]

const MIN_NODE = { major: 20, minor: 9 }

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

function secret() {
  return randomBytes(32).toString('hex')
}

export function normalizeTemplate(id) {
  return TEMPLATES.some((t) => t.id === id) ? id : 'blank'
}

export function normalizeDb(id) {
  return DATABASES.some((d) => d.id === id) ? id : 'sqlite'
}

export function pmFlag(pmId = 'npm') {
  return ({
    npm: '--use-npm',
    pnpm: '--use-pnpm',
    yarn: '--use-yarn',
    bun: '--use-bun'
  })[pmId] || '--use-npm'
}

/** Commande create-payload-app 100 % non interactive. */
export function buildCreateCommand({ name, template = 'blank', db = 'sqlite', pmId = 'npm' } = {}) {
  const t = normalizeTemplate(template)
  const d = normalizeDb(db)
  const n = String(name || 'payload-app').replace(/[^a-z0-9-_]/gi, '-').toLowerCase()
  return [
    'npx --yes create-payload-app@latest',
    `-n ${n}`,
    `-t ${t}`,
    `--db ${d}`,
    '--db-accept-recommended',
    '--no-agent',
    '--no-deps',
    '--no-git',
    pmFlag(pmId)
  ].join(' ')
}

export function requiredToolIds(db = 'sqlite') {
  const d = DATABASES.find((x) => x.id === normalizeDb(db))
  return ['node', 'git', ...(d?.tools || [])]
}

/**
 * État des prérequis pour un projet Payload (outil + version Node).
 */
export async function checkPrereqs(db = 'sqlite') {
  const status = await toolchain.status()
  const byId = Object.fromEntries([
    ...(status.tools || []).map((t) => [t.id, t]),
    ...(status.python || []).map((t) => [t.id, t])
  ])

  const dbMeta = DATABASES.find((d) => d.id === normalizeDb(db)) || DATABASES[0]
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
        ? `v${nodeVersion || '?'} — Payload exige ≥ ${MIN_NODE.major}.${MIN_NODE.minor}`
        : `Absent — ≥ ${MIN_NODE.major}.${MIN_NODE.minor} requis`,
    required: true,
    ok: nodeReady,
    installed: Boolean(node?.installed),
    canInstall: Boolean(node?.canInstall || (node?.installed && !nodeReady && node?.canUpdate)),
    installAs: 'node',
    hint: 'Runtime JS. Inclus npm.'
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
    hint: 'Contrôle de version (dépôt distant optionnel).'
  })

  if (dbMeta.tools.includes('mongodb')) {
    const mongo = byId.mongodb
    rows.push({
      id: 'mongodb',
      toolId: 'mongodb',
      name: 'MongoDB',
      detail: mongo?.installed ? (mongo.version ? `v${mongo.version}` : 'Détecté') : 'Absent — serveur local ou Atlas',
      required: true,
      ok: Boolean(mongo?.installed),
      installed: Boolean(mongo?.installed),
      canInstall: Boolean(mongo?.canInstall),
      installAs: 'mongodb',
      hint: 'Service mongod. Après install Windows, un redémarrage de session peut être nécessaire.'
    })
  }

  if (dbMeta.tools.includes('postgres')) {
    const pg = byId.postgres
    rows.push({
      id: 'postgres',
      toolId: 'postgres',
      name: 'PostgreSQL',
      detail: pg?.installed ? (pg.version ? `v${pg.version}` : 'Détecté') : 'Absent — serveur local ou Neon',
      required: true,
      ok: Boolean(pg?.installed),
      installed: Boolean(pg?.installed),
      canInstall: Boolean(pg?.canInstall),
      installAs: 'postgres',
      hint: 'Client psql détecté = OK. Vérifie que le service tourne.'
    })
  }

  const missing = rows.filter((r) => r.required && !r.ok)
  return {
    db: dbMeta.id,
    templateOptions: TEMPLATES,
    databaseOptions: DATABASES,
    minNode: `${MIN_NODE.major}.${MIN_NODE.minor}`,
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
  if (re.test(raw)) {
    writeFileSync(file, raw.replace(re, `${key}=${value}`), 'utf8')
  } else {
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

/**
 * Post-scaffold : secret, guide .pdc, marqueurs projet.
 * create-payload-app a déjà posé DATABASE_URI / adapter.
 */
export function finalize(projectPath, { template = 'blank', db = 'sqlite', name = '' } = {}) {
  const t = normalizeTemplate(template)
  const d = normalizeDb(db)
  const written = []

  const envPath = join(projectPath, '.env')
  const envExample = join(projectPath, '.env.example')
  const sec = secret()

  if (existsSync(envPath)) {
    ensureEnvKey(envPath, 'PAYLOAD_SECRET', sec)
  } else if (existsSync(envExample)) {
    const example = readFileSync(envExample, 'utf8')
    writeFileSync(envPath, example.replace(/PAYLOAD_SECRET=.*/g, `PAYLOAD_SECRET=${sec}`), 'utf8')
    if (!/^PAYLOAD_SECRET=/m.test(readFileSync(envPath, 'utf8'))) {
      ensureEnvKey(envPath, 'PAYLOAD_SECRET', sec)
    }
  } else {
    upsertEnv(envPath, 'PAYLOAD_SECRET', sec)
  }
  written.push('.env')

  const pdcDir = join(projectPath, '.pdc')
  mkdirSync(pdcDir, { recursive: true })
  const guide = `# Payload CMS — PDC Builder

Projet généré avec **create-payload-app** (non interactif).

| | |
|---|---|
| Template | \`${t}\` |
| Base | \`${d}\` |
| Nom | ${name || '—'} |

## Démarrer

\`\`\`bash
npm run dev
\`\`\`

Admin : \`http://localhost:3000/admin\` (crée le premier utilisateur au premier lancement).

## Prérequis machine

- Node.js ≥ ${MIN_NODE.major}.${MIN_NODE.minor}
- Git
${d === 'mongodb' ? '- MongoDB (service local ou URI Atlas dans `.env`)\n' : ''}${d === 'postgres' ? '- PostgreSQL (service local ou URI managée dans `.env`)\n' : ''}${d === 'sqlite' ? '- Aucun serveur DB — fichier SQLite dans le projet\n' : ''}
## Config auto

PDC a posé \`PAYLOAD_SECRET\` dans \`.env\` et laissé l’adaptateur DB choisi par le scaffold.
Modifie \`DATABASE_URI\` / \`DATABASE_URL\` si tu pointes vers un cloud (Neon, MongoDB Atlas…).

Docs : https://payloadcms.com/docs
`
  writeFileSync(join(pdcDir, 'PAYLOAD.md'), guide, 'utf8')
  written.push('.pdc/PAYLOAD.md')

  writeFileSync(join(pdcDir, 'payload.json'), JSON.stringify({
    framework: 'payload',
    template: t,
    db: d,
    createdAt: Date.now()
  }, null, 2), 'utf8')
  written.push('.pdc/payload.json')

  return { ok: true, files: written, template: t, db: d }
}

export function isPayloadFramework(fw) {
  if (!fw) return false
  return fw.id === 'payload' || fw.kind === 'cms' || /payload/i.test(fw.create || '')
}
