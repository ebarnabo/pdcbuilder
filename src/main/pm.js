import { spawn } from 'child_process'
import { homedir, platform } from 'os'
import { join } from 'path'
import { existsSync, readdirSync, statSync } from 'fs'

const isWin = platform() === 'win32'

export const MANAGERS = [
  {
    id: 'npm',
    name: 'npm',
    tag: 'Inclus avec Node',
    blurb: 'Le classique. Zéro config, compatible avec tous les tutos.',
    metrics: { vitesse: 3, disque: 2, monorepo: 2, simplicite: 5 },
    npmPkg: 'npm',
    installGlobal: null,
    updateGlobal: 'npm install -g npm@latest'
  },
  {
    id: 'pnpm',
    name: 'pnpm',
    tag: 'Rapide · disque léger',
    blurb: 'Store partagé et liens durs. Très bon pour les monorepos.',
    metrics: { vitesse: 5, disque: 5, monorepo: 5, simplicite: 3 },
    npmPkg: 'pnpm',
    installGlobal: 'npm install -g pnpm',
    updateGlobal: 'npm install -g pnpm@latest'
  },
  {
    id: 'yarn',
    name: 'Yarn',
    tag: 'Classique moderne',
    blurb: 'Berry ou Classic. Bon équilibre vitesse / écosystème.',
    metrics: { vitesse: 4, disque: 4, monorepo: 4, simplicite: 4 },
    npmPkg: 'yarn',
    installGlobal: 'npm install -g yarn',
    updateGlobal: 'npm install -g yarn@latest'
  },
  {
    id: 'bun',
    name: 'Bun',
    tag: 'Ultra rapide',
    blurb: 'Runtime + installateur. Idéal pour itérer vite, écosystème plus jeune.',
    metrics: { vitesse: 5, disque: 4, monorepo: 3, simplicite: 3 },
    npmPkg: 'bun',
    installGlobal: 'npm install -g bun',
    updateGlobal: 'npm install -g bun@latest'
  }
]

const METRIC_LABELS = {
  vitesse: 'Vitesse',
  disque: 'Disque',
  monorepo: 'Monorepo',
  simplicite: 'Simplicité'
}

function run(command, cwd = homedir()) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => { stdout += String(d) })
    child.stderr?.on('data', (d) => { stderr += String(d) })
    child.on('close', (code) => resolve({ ok: code === 0, stdout, stderr }))
  })
}

async function hasCommand(name) {
  const probe = isWin ? `where ${name}` : `command -v ${name}`
  const r = await run(probe, homedir())
  return r.ok
}

async function readVersion(name) {
  const r = await run(`${name} --version`, homedir())
  if (!r.ok) return null
  return (r.stdout || r.stderr || '').trim().split(/\r?\n/)[0] || null
}

async function readLatest(npmPkg) {
  if (!npmPkg) return null
  const r = await run(`npm view ${npmPkg} version`, homedir())
  if (!r.ok) return null
  return (r.stdout || '').trim().split(/\r?\n/)[0] || null
}

/** Compare deux versions (semver simple). Renvoie true si current < latest. */
export function isOutdated(current, latest) {
  if (!current || !latest) return false
  const parse = (v) => String(v).replace(/^v/i, '').split(/[.+-]/).map((n) => {
    const x = parseInt(n, 10)
    return Number.isFinite(x) ? x : 0
  })
  const a = parse(current)
  const b = parse(latest)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0
    const y = b[i] || 0
    if (x < y) return true
    if (x > y) return false
  }
  return false
}

export function metricLabels() {
  return METRIC_LABELS
}

export function byId(id) {
  return MANAGERS.find((m) => m.id === id) || MANAGERS[0]
}

export function installCommand(pmId = 'npm') {
  return ({ npm: 'npm install', pnpm: 'pnpm install', yarn: 'yarn install', bun: 'bun install' })[pmId] || 'npm install'
}

export function addPackages(pmId, pkgs, dev = false) {
  const list = (pkgs || []).filter(Boolean).join(' ')
  if (!list) return null
  const map = {
    npm: dev ? `npm install -D ${list}` : `npm install ${list}`,
    pnpm: dev ? `pnpm add -D ${list}` : `pnpm add ${list}`,
    yarn: dev ? `yarn add -D ${list}` : `yarn add ${list}`,
    bun: dev ? `bun add -d ${list}` : `bun add ${list}`
  }
  return map[pmId] || map.npm
}

export function adaptCommand(cmd, pmId = 'npm') {
  if (!cmd || pmId === 'npm') return cmd
  let c = String(cmd)
  if (pmId === 'pnpm') {
    c = c
      .replace(/^npm create /, 'pnpm create ')
      .replace(/^npx --yes /, 'pnpm dlx ')
      .replace(/^npx /, 'pnpm dlx ')
      .replace(/^npm install\b/, 'pnpm install')
      .replace(/^npm run\b/, 'pnpm run')
  } else if (pmId === 'yarn') {
    c = c
      .replace(/^npm create /, 'yarn create ')
      .replace(/^npx --yes /, 'yarn dlx ')
      .replace(/^npx /, 'yarn dlx ')
      .replace(/^npm install\b/, 'yarn install')
      .replace(/^npm run\b/, 'yarn run')
  } else if (pmId === 'bun') {
    c = c
      .replace(/^npm create /, 'bun create ')
      .replace(/^npx --yes /, 'bunx ')
      .replace(/^npx /, 'bunx ')
      .replace(/^npm install\b/, 'bun install')
      .replace(/^npm run\b/, 'bun run')
  }
  if (pmId !== 'npm') {
    c = c.replace(/--packageManager\s+npm\b/g, `--packageManager ${pmId}`)
    c = c.replace(/--use-npm\b/g, `--use-${pmId}`)
  }
  return c
}

export function installForPath(dir, fallbackPm = 'npm') {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm install'
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn install'
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun install'
  if (existsSync(join(dir, 'package-lock.json'))) return 'npm install'
  return installCommand(fallbackPm)
}

/** Trouve le dossier racine npm (gère un sous-dossier créé par erreur par le scaffold). */
export function resolveProjectRoot(dir) {
  if (!dir || !existsSync(dir)) return null
  if (existsSync(join(dir, 'package.json'))) return dir
  if (
    existsSync(join(dir, 'wp-includes'))
    || existsSync(join(dir, 'wp-config.php'))
    || existsSync(join(dir, 'wp-config-sample.php'))
  ) return dir
  try {
    for (const name of readdirSync(dir)) {
      const child = join(dir, name)
      if (!statSync(child).isDirectory()) continue
      if (existsSync(join(child, 'package.json'))) return child
      if (
        existsSync(join(child, 'wp-includes'))
        || existsSync(join(child, 'wp-config-sample.php'))
      ) return child
    }
  } catch { /* ignore */ }
  return null
}

export function needsInstall(dir) {
  return Boolean(dir && existsSync(join(dir, 'package.json')) && !existsSync(join(dir, 'node_modules')))
}

export function globalInstallCommand(id) {
  return byId(id).installGlobal
}

export function globalUpdateCommand(id) {
  return byId(id).updateGlobal || null
}

export async function status(defaultId = 'npm') {
  const rows = await Promise.all(MANAGERS.map(async (m) => {
    const installed = m.id === 'npm' ? true : await hasCommand(m.id)
    const version = installed ? await readVersion(m.id === 'npm' ? 'npm' : m.id) : null
    const latest = installed ? await readLatest(m.npmPkg || m.id) : null
    const outdated = Boolean(installed && isOutdated(version, latest))
    return {
      ...m,
      installed,
      version,
      latest,
      outdated,
      canUpdate: Boolean(m.updateGlobal && installed)
    }
  }))
  return {
    defaultId: defaultId || 'npm',
    managers: rows,
    outdatedCount: rows.filter((r) => r.outdated).length
  }
}
