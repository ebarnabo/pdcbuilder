/**
 * Préférences utilisateur exportées en Markdown pour les agents IA.
 * Copie globale : userData/preferences.md
 * Copie projet : <projet>/.pdc/preferences.md
 */
import { app, shell } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { PROVIDERS } from './ai.js'
import { DATABASES } from './database.js'
import { MANAGERS } from './pm.js'

const SECRET_KEYS = new Set([
  'token', 'apiKey', 'deployKey', 'password', 'secret', 'binary'
])

function globalFile() {
  return join(app.getPath('userData'), 'preferences.md')
}

function yesNo(v) {
  return v ? 'oui' : 'non'
}

function configured(v) {
  return v != null && String(v).trim() !== '' ? 'configuré' : 'non configuré'
}

function dbName(id) {
  return DATABASES.find((d) => d.id === id)?.name || id || 'aucune'
}

function pmName(id) {
  return MANAGERS.find((m) => m.id === id)?.name || id || 'npm'
}

function providerLabel(id) {
  return PROVIDERS[id]?.label || id
}

function redactAccount(id, acc = {}) {
  const rows = []
  for (const [key, val] of Object.entries(acc)) {
    if (SECRET_KEYS.has(key)) rows.push(`- ${key} : ${configured(val)}`)
    else if (val != null && String(val).trim() !== '') rows.push(`- ${key} : ${val}`)
  }
  if (!rows.length) return `- ${id} : aucun réglage`
  return [`### ${id}`, ...rows].join('\n')
}

function listThemes(themes) {
  if (!Array.isArray(themes) || !themes.length) return 'aucun'
  return themes.join(', ')
}

export function renderMarkdown(state) {
  const s = state || {}
  const git = { autoCreate: true, provider: 'github', visibility: 'private', org: '', branch: 'main', ...(s.git || {}) }
  const db = {
    defaultId: 'none',
    autoCreate: true,
    accounts: {},
    ...(s.database || {})
  }
  const ai = { ...(s.ai || {}) }
  const onboarding = s.onboarding || {}
  const lines = [
    '# Préférences PDC Builder',
    '',
    'Fichier généré automatiquement pour les agents IA (assistant intégré, Cursor, etc.).',
    'Modifie les réglages dans l’app — ne pas éditer ce fichier à la main.',
    '',
    `Dernière mise à jour : ${new Date().toISOString()}`,
    '',
    '## Atelier',
    '',
    `- **Dossier des projets** : \`${s.workspace || ''}\``,
    `- **Commande éditeur** : \`${s.editor || 'code'}\``,
    `- **Gestionnaire de paquets par défaut** : ${pmName(s.packageManager)} (\`${s.packageManager || 'npm'}\`)`,
    '',
    '## Dépôts Git',
    '',
    `- **Création automatique** : ${yesNo(git.autoCreate)}`,
    `- **Fournisseur** : ${git.provider}`,
    `- **Visibilité** : ${git.visibility}`,
    `- **Organisation** : ${git.org || '—'}`,
    `- **Branche par défaut** : \`${git.branch || 'main'}\``,
    '',
    '## Bases de données',
    '',
    `- **Choix par défaut** : ${dbName(db.defaultId)} (\`${db.defaultId || 'none'}\`)`,
    `- **Provision cloud à la création** : ${yesNo(db.autoCreate)}`,
    '',
    '### Comptes cloud (secrets masqués)',
    '',
    ...Object.keys(db.accounts || {}).map((id) => redactAccount(id, db.accounts[id])),
    '',
    '## Assistant IA',
    '',
    `- **Fournisseur** : ${providerLabel(ai.provider)} (\`${ai.provider || 'ollama'}\`)`,
    `- **URL du service** : \`${ai.baseUrl || ''}\``,
    `- **Modèle** : \`${ai.model || ''}\``,
    `- **Température** : ${ai.temperature ?? 0.4}`,
    `- **Clé API** : ${configured(ai.apiKey)}`,
    '',
    '## Introduction',
    '',
    `- **Terminée** : ${yesNo(onboarding.completed)}`,
    onboarding.completedAt ? `- **Date** : ${new Date(onboarding.completedAt).toISOString()}` : null,
    onboarding.skipped?.length ? `- **Étapes ignorées** : ${onboarding.skipped.join(', ')}` : null,
    '',
    '## Catalogue — frameworks',
    '',
    ...(s.frameworks || []).flatMap((f) => [
      `### ${f.name} (\`${f.id}\`)`,
      `- Tag : ${f.tag || '—'}`,
      `- Famille : ${f.family || '—'}`,
      `- Description : ${f.description || '—'}`,
      `- Sortie build : \`${f.outDir || 'dist'}\``,
      ''
    ]),
    '## Catalogue — librairies',
    '',
    ...(s.libraries || []).flatMap((cat) => [
      `### ${cat.name} (\`${cat.id}\`)`,
      cat.description ? `- ${cat.description}` : null,
      ...(cat.items || []).map((item) =>
        `- **${item.name}** — \`${item.pkg}\`${item.dev ? ' · dev' : ''}${item.for ? ` · ${item.for}` : ''}${item.description ? ` — ${item.description}` : ''}`
      ),
      ''
    ].filter(Boolean)),
    '## Blueprints',
    '',
    ...(s.blueprints || []).length
      ? (s.blueprints || []).flatMap((bp) => {
          const fw = (s.frameworks || []).find((f) => f.id === bp.frameworkId)
          return [
            `### ${bp.name || bp.id} (\`${bp.id}\`)`,
            bp.description ? `- ${bp.description}` : null,
            `- Framework : ${fw?.name || bp.frameworkId}`,
            `- Base : ${dbName(bp.databaseId)}`,
            `- Thèmes : ${listThemes(bp.themes)}`,
            `- Librairies : ${(bp.libs || []).join(', ') || 'aucune'}`,
            `- Fichiers modèle : ${(bp.files || []).length}`,
            `- Commandes : ${(bp.commands || []).length}`,
            ''
          ].filter(Boolean)
        })
      : ['_Aucun blueprint._', ''],
    '## Projets',
    '',
    ...(s.projects || []).length
      ? (s.projects || []).flatMap((p) => {
          const fw = (s.frameworks || []).find((f) => f.id === p.frameworkId)
          return [
            `### ${p.name} (\`${p.id}\`)`,
            `- **Chemin** : \`${p.path || ''}\``,
            `- **Framework** : ${fw?.name || p.frameworkId}`,
            `- **Base** : ${dbName(p.databaseId)}`,
            `- **Thèmes** : ${listThemes(p.themes)}`,
            `- **Librairies** : ${(p.libs || []).join(', ') || 'aucune'}`,
            p.repo ? `- **Dépôt** : ${typeof p.repo === 'string' ? p.repo : p.repo.url || JSON.stringify(p.repo)}` : null,
            p.status ? `- **Statut** : ${p.status}` : null,
            ''
          ].filter(Boolean)
        })
      : ['_Aucun projet._', ''],
    '## Ressources agents dans chaque projet',
    '',
    '- `.pdc/preferences.md` — ce fichier (préférences globales)',
    '- `.pdc/database.md` — guide base de données du projet',
    '- `.pdc/docs/` — documentation locale des librairies',
    '- `.pdc/README.md` — index des ressources',
    ''
  ].filter((line) => line !== null)

  return `${lines.join('\n')}\n`
}

export function sync(state) {
  const md = renderMarkdown(state)
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(globalFile(), md, 'utf8')

  for (const project of state?.projects || []) {
    if (!project?.path || !existsSync(project.path)) continue
    const pdc = join(project.path, '.pdc')
    mkdirSync(pdc, { recursive: true })
    writeFileSync(join(pdc, 'preferences.md'), md, 'utf8')
  }
}

export function readText() {
  const file = globalFile()
  if (!existsSync(file)) return null
  return readFileSync(file, 'utf8')
}

export function forPrompt(state, { maxChars = 14_000 } = {}) {
  const text = readText() || renderMarkdown(state)
  if (text.length <= maxChars) return `\n## Préférences utilisateur\n\n${text}`
  return `\n## Préférences utilisateur\n\n${text.slice(0, maxChars)}\n\n[Préférences tronquées — fichier complet : ${globalFile()}]`
}

export function path() {
  return globalFile()
}

export function openFolder() {
  mkdirSync(app.getPath('userData'), { recursive: true })
  return shell.openPath(app.getPath('userData'))
}
