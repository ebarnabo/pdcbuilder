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
    installGlobal: null
  },
  {
    id: 'pnpm',
    name: 'pnpm',
    tag: 'Rapide · disque léger',
    blurb: 'Store partagé et liens durs. Très bon pour les monorepos.',
    metrics: { vitesse: 5, disque: 5, monorepo: 5, simplicite: 3 },
    installGlobal: 'npm install -g pnpm'
  },
  {
    id: 'yarn',
    name: 'Yarn',
    tag: 'Classique moderne',
    blurb: 'Berry ou Classic. Bon équilibre vitesse / écosystème.',
    metrics: { vitesse: 4, disque: 4, monorepo: 4, simplicite: 4 },
    installGlobal: 'npm install -g yarn'
  },
  {
    id: 'bun',
    name: 'Bun',
    tag: 'Ultra rapide',
    blurb: 'Runtime + installateur. Idéal pour itérer vite, écosystème plus jeune.',
    metrics: { vitesse: 5, disque: 4, monorepo: 3, simplicite: 3 },
    installGlobal: 'npm install -g bun'
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
  try {
    for (const name of readdirSync(dir)) {
      const child = join(dir, name)
      if (statSync(child).isDirectory() && existsSync(join(child, 'package.json'))) return child
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

export async function status(defaultId = 'npm') {
  const rows = await Promise.all(MANAGERS.map(async (m) => ({
    ...m,
    installed: m.id === 'npm' ? true : await hasCommand(m.id),
    version: m.id === 'npm' ? await readVersion('npm') : await readVersion(m.id)
  })))
  return { defaultId: defaultId || 'npm', managers: rows }
}
