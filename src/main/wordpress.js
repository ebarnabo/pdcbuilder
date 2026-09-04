/**
 * WordPress — téléchargement core, prérequis machine, config auto (WP-CLI).
 */
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { randomBytes } from 'crypto'
import * as toolchain from './toolchain.js'

export const LOCALES = [
  { id: 'fr_FR', name: 'Français' },
  { id: 'en_US', name: 'English' },
  { id: 'es_ES', name: 'Español' },
  { id: 'de_DE', name: 'Deutsch' }
]

export const MODES = [
  {
    id: 'download',
    name: 'Fichiers seuls',
    blurb: 'Télécharge le core + wp-config. Tu branches MySQL ensuite.'
  },
  {
    id: 'full',
    name: 'Install complète',
    blurb: 'Download + config + tables + admin (MySQL doit tourner).'
  }
]

const MIN_PHP = { major: 8, minor: 1 }

function parseSemver(v) {
  const m = String(v || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!m) return null
  return { major: +m[1], minor: +m[2], patch: +(m[3] || 0) }
}

function phpOk(version) {
  const v = parseSemver(version)
  if (!v) return false
  if (v.major > MIN_PHP.major) return true
  if (v.major < MIN_PHP.major) return false
  return v.minor >= MIN_PHP.minor
}

function secretKeys() {
  const one = () => randomBytes(32).toString('base64').replace(/[/+=]/g, '').slice(0, 64)
  return {
    AUTH_KEY: one(),
    SECURE_AUTH_KEY: one(),
    LOGGED_IN_KEY: one(),
    NONCE_KEY: one(),
    AUTH_SALT: one(),
    SECURE_AUTH_SALT: one(),
    LOGGED_IN_SALT: one(),
    NONCE_SALT: one()
  }
}

export function normalizeLocale(id) {
  return LOCALES.some((l) => l.id === id) ? id : 'fr_FR'
}

export function normalizeMode(id) {
  return MODES.some((m) => m.id === id) ? id : 'download'
}

function shellQuote(s) {
  const v = String(s ?? '')
  if (/^[a-zA-Z0-9._@:/-]+$/.test(v)) return v
  return `"${v.replace(/"/g, '\\"')}"`
}

export async function checkPrereqs(mode = 'download') {
  const status = await toolchain.status()
  const byId = Object.fromEntries([
    ...(status.tools || []).map((t) => [t.id, t]),
    ...(status.python || []).map((t) => [t.id, t])
  ])
  const full = normalizeMode(mode) === 'full'
  const rows = []

  const php = byId.php
  const phpVersion = php?.version || null
  const phpReady = Boolean(php?.installed && phpOk(phpVersion))
  rows.push({
    id: 'php',
    toolId: 'php',
    name: 'PHP',
    detail: phpReady
      ? `v${phpVersion}`
      : php?.installed
        ? `v${phpVersion || '?'} — WordPress exige ≥ ${MIN_PHP.major}.${MIN_PHP.minor}`
        : `Absent — ≥ ${MIN_PHP.major}.${MIN_PHP.minor}`,
    required: true,
    ok: phpReady,
    installed: Boolean(php?.installed),
    canInstall: Boolean(php?.canInstall || (php?.installed && !phpReady && php?.canUpdate)),
    installAs: 'php',
    hint: 'Runtime PHP + serveur intégré (php -S).'
  })

  const wp = byId['wp-cli']
  rows.push({
    id: 'wp-cli',
    toolId: 'wp-cli',
    name: 'WP-CLI',
    detail: wp?.installed ? (wp.version ? `v${wp.version}` : 'Détecté') : 'Absent — télécharge le core WordPress',
    required: true,
    ok: Boolean(wp?.installed),
    installed: Boolean(wp?.installed),
    canInstall: Boolean(wp?.canInstall),
    installAs: 'wp-cli',
    hint: 'Ligne de commande officielle WordPress.'
  })

  const mysql = byId.mysql
  rows.push({
    id: 'mysql',
    toolId: 'mysql',
    name: 'MySQL / MariaDB',
    detail: mysql?.installed
      ? (mysql.version ? `v${mysql.version}` : 'Client détecté')
      : full
        ? 'Absent — requis pour l’install complète'
        : 'Optionnel pour le mode « fichiers seuls »',
    required: full,
    ok: full ? Boolean(mysql?.installed) : true,
    installed: Boolean(mysql?.installed),
    canInstall: Boolean(mysql?.canInstall),
    installAs: 'mysql',
    hint: 'Serveur SQL. Vérifie que le service tourne avant une install full.'
  })

  const missing = rows.filter((r) => r.required && !r.ok)
  return {
    localeOptions: LOCALES,
    modeOptions: MODES,
    minPhp: `${MIN_PHP.major}.${MIN_PHP.minor}`,
    items: rows,
    ready: missing.length === 0,
    missing: missing.map((r) => r.id),
    installer: status.installer
  }
}

export function buildDownloadCommand({ path, locale = 'fr_FR' } = {}) {
  const loc = normalizeLocale(locale)
  const p = path ? `--path=${shellQuote(path)}` : ''
  return `wp core download ${p} --locale=${loc} --force`.replace(/\s+/g, ' ').trim()
}

export function buildConfigCommand({
  path,
  dbName = 'wordpress',
  dbUser = 'root',
  dbPass = '',
  dbHost = '127.0.0.1',
  dbPrefix = 'wp_'
} = {}) {
  const p = path ? `--path=${shellQuote(path)}` : ''
  const parts = [
    'wp config create',
    p,
    `--dbname=${shellQuote(dbName)}`,
    `--dbuser=${shellQuote(dbUser)}`,
    `--dbpass=${shellQuote(dbPass)}`,
    `--dbhost=${shellQuote(dbHost)}`,
    `--dbprefix=${shellQuote(dbPrefix)}`,
    '--skip-check',
    '--force'
  ]
  return parts.filter(Boolean).join(' ')
}

export function buildDbCreateCommand({ path } = {}) {
  const p = path ? `--path=${shellQuote(path)}` : ''
  return `wp db create ${p}`.trim()
}

export function buildInstallCommand({
  path,
  url = 'http://localhost:8080',
  title = 'WordPress',
  adminUser = 'admin',
  adminPassword = '',
  adminEmail = 'admin@example.com'
} = {}) {
  const p = path ? `--path=${shellQuote(path)}` : ''
  const pass = adminPassword || randomBytes(9).toString('base64url')
  return [
    'wp core install',
    p,
    `--url=${shellQuote(url)}`,
    `--title=${shellQuote(title)}`,
    `--admin_user=${shellQuote(adminUser)}`,
    `--admin_password=${shellQuote(pass)}`,
    `--admin_email=${shellQuote(adminEmail)}`,
    '--skip-email'
  ].filter(Boolean).join(' ')
}

/** Fallback si WP-CLI config create échoue : écrit wp-config.php depuis le sample. */
export function writeConfigFile(projectPath, {
  dbName = 'wordpress',
  dbUser = 'root',
  dbPass = '',
  dbHost = '127.0.0.1',
  dbPrefix = 'wp_'
} = {}) {
  const sample = join(projectPath, 'wp-config-sample.php')
  const target = join(projectPath, 'wp-config.php')
  const keys = secretKeys()
  let raw = existsSync(sample)
    ? readFileSync(sample, 'utf8')
    : `<?php
define('DB_NAME', 'database_name_here');
define('DB_USER', 'username_here');
define('DB_PASSWORD', 'password_here');
define('DB_HOST', 'localhost');
$table_prefix = 'wp_';
`

  raw = raw
    .replace(/database_name_here/g, dbName)
    .replace(/username_here/g, dbUser)
    .replace(/password_here/g, dbPass)
    .replace(/localhost/g, dbHost)

  for (const [k, v] of Object.entries(keys)) {
    raw = raw.replace(new RegExp(`put your unique phrase here`, 'i'), v)
  }
  // Remplacer chaque put your unique phrase here restant
  let i = 0
  const vals = Object.values(keys)
  raw = raw.replace(/put your unique phrase here/gi, () => vals[i++ % vals.length])

  if (!/\$table_prefix\s*=/.test(raw)) {
    raw += `\n$table_prefix = '${dbPrefix}';\n`
  } else {
    raw = raw.replace(/\$table_prefix\s*=\s*'[^']*'/, `$table_prefix = '${dbPrefix}'`)
  }

  writeFileSync(target, raw, 'utf8')
  return { ok: true, file: 'wp-config.php', adminHint: null }
}

export function finalize(projectPath, {
  locale = 'fr_FR',
  mode = 'download',
  name = '',
  dbName = 'wordpress',
  url = 'http://localhost:8080',
  adminUser = 'admin',
  adminPassword = ''
} = {}) {
  const pdcDir = join(projectPath, '.pdc')
  mkdirSync(pdcDir, { recursive: true })
  const loc = normalizeLocale(locale)
  const m = normalizeMode(mode)

  const guide = `# WordPress — PDC Builder

| | |
|---|---|
| Mode | \`${m}\` |
| Locale | \`${loc}\` |
| Base | \`${dbName}\` |
| URL locale | ${url} |

## Démarrer (PHP intégré)

\`\`\`bash
php -S localhost:8080
\`\`\`

Puis ouvre ${url}${m === 'download' ? ' et termine l’installateur web si la base n’est pas encore créée.' : ' — admin déjà posé si l’install full a réussi.'}

## Prérequis

- PHP ≥ ${MIN_PHP.major}.${MIN_PHP.minor}
- WP-CLI
${m === 'full' ? '- MySQL / MariaDB en marche\n' : '- MySQL recommandé pour passer en prod\n'}
## Admin

- Utilisateur : \`${adminUser}\`
${adminPassword ? `- Mot de passe (install full) : voir la console de création / notes projet\n` : '- Mot de passe : celui fourni à la création, ou défini dans l’installateur web\n'}
Docs : https://wordpress.org/documentation/
`
  writeFileSync(join(pdcDir, 'WORDPRESS.md'), guide, 'utf8')
  writeFileSync(join(pdcDir, 'wordpress.json'), JSON.stringify({
    framework: 'wordpress',
    locale: loc,
    mode: m,
    dbName,
    url,
    adminUser,
    createdAt: Date.now()
  }, null, 2), 'utf8')

  // Marqueur pour resolveProjectRoot / scripts
  if (!existsSync(join(projectPath, 'package.json'))) {
    writeFileSync(join(projectPath, 'package.json'), JSON.stringify({
      name: String(name || 'wordpress').toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'wordpress',
      private: true,
      scripts: {
        dev: 'php -S localhost:8080',
        start: 'php -S localhost:8080',
        build: 'echo WordPress — pas de build npm',
        preview: 'php -S localhost:8080'
      }
    }, null, 2) + '\n', 'utf8')
  }

  return {
    ok: true,
    files: ['.pdc/WORDPRESS.md', '.pdc/wordpress.json', 'package.json'],
    locale: loc,
    mode: m
  }
}

export function isWordpressRoot(dir) {
  if (!dir || !existsSync(dir)) return false
  return existsSync(join(dir, 'wp-includes'))
    || existsSync(join(dir, 'wp-config.php'))
    || existsSync(join(dir, 'wp-config-sample.php'))
}

export function isWordpressFramework(fw) {
  if (!fw) return false
  return fw.id === 'wordpress' || fw.kind === 'cms-wordpress'
}
