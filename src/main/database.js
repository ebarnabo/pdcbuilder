/**
 * Bases de données proposées à la création d’un projet.
 * Génère le client, .env.example et un guide dans .pdc/
 */
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs'

export const DATABASES = [
  {
    id: 'none',
    name: 'Pas de base',
    kind: 'Aucun',
    summary: 'Front uniquement. Tu pourras en brancher une plus tard.',
    choose: 'Le projet n’a pas encore de données à stocker, ou tu préfères décider après le scaffold.',
    skip: 'Tu sais déjà que tu auras des comptes, un CMS ou des enregistrements à persister.',
    features: [],
    packages: [],
    docsUrl: null,
    consoleUrl: null
  },
  {
    id: 'supabase',
    name: 'Supabase',
    kind: 'Postgres + BaaS',
    summary: 'Postgres vrai, auth, fichiers et temps réel — le choix SQL le plus complet.',
    choose: 'Tu veux du SQL, des jointures, Row Level Security, et l’auth + le storage dans le même produit. Open source, tu peux self-host plus tard.',
    skip: 'Tu n’as besoin que d’un JSON sans SQL, ou tu veux rester 100 % hors ligne sur ta machine.',
    features: ['Postgres', 'Auth', 'Storage', 'Realtime', 'RLS', 'Open source'],
    packages: ['@supabase/supabase-js'],
    extraNext: ['@supabase/ssr'],
    docsUrl: 'https://supabase.com/docs',
    consoleUrl: 'https://supabase.com/dashboard'
  },
  {
    id: 'firebase',
    name: 'Firebase',
    kind: 'BaaS Google',
    summary: 'Firestore, Auth et Storage chez Google. Très fort en temps réel et mobile.',
    choose: 'Tu vises une app temps réel, tu prévois iOS/Android après le web, et l’écosystème Google te va.',
    skip: 'Tu as besoin de SQL / Postgres, d’un self-host, ou d’éviter le lock-in Google et la facturation Blaze.',
    features: ['Firestore', 'Auth', 'Storage', 'Realtime', 'Hosting', 'Mobile'],
    packages: ['firebase'],
    docsUrl: 'https://firebase.google.com/docs',
    consoleUrl: 'https://console.firebase.google.com'
  },
  {
    id: 'neon',
    name: 'Neon',
    kind: 'Postgres serverless',
    summary: 'Postgres managé, branches comme Git, scale-to-zero. Tu apportes l’auth.',
    choose: 'Tu veux du SQL sérieux (Drizzle, Prisma) sans gérer un serveur, et tu branches l’auth à part (Better Auth, Clerk…).',
    skip: 'Tu n’as que du front Vite sans serveur : le mot de passe Postgres ne doit jamais aller dans le navigateur. Prends Next/Nuxt, ou un BaaS.',
    features: ['Postgres', 'Serverless', 'Branching', 'Drizzle / Prisma', 'Serveur only'],
    packages: ['@neondatabase/serverless', 'drizzle-orm'],
    extraDev: ['drizzle-kit'],
    docsUrl: 'https://neon.tech/docs',
    consoleUrl: 'https://console.neon.tech'
  },
  {
    id: 'appwrite',
    name: 'Appwrite',
    kind: 'BaaS open source',
    summary: 'Auth, base, fichiers, functions — comme Firebase, mais self-host possible.',
    choose: 'Tu veux un backend tout-en-un, open source, RGPD / self-host, sans passer par Google.',
    skip: 'Tu tiens à du Postgres SQL natif (requêtes SQL brutes, migrations Drizzle). Préfère Supabase ou Neon.',
    features: ['Auth', 'Database', 'Storage', 'Functions', 'Self-host', 'Cloud'],
    packages: ['appwrite'],
    docsUrl: 'https://appwrite.io/docs',
    consoleUrl: 'https://cloud.appwrite.io'
  },
  {
    id: 'convex',
    name: 'Convex',
    kind: 'Backend réactif',
    summary: 'Queries/mutations TypeScript, sync live. Pensé pour React et Next.',
    choose: 'Stack React/Next, tu veux un backend typé qui pousse les updates tout seul, sans écrire de SQL.',
    skip: 'Projet Vue/Svelte/vanilla, besoin de SQL, ou tu refuses un backend propriétaire.',
    features: ['TypeScript', 'Realtime', 'React/Next', 'Auth plugin', 'Sans SQL'],
    packages: ['convex'],
    docsUrl: 'https://docs.convex.dev',
    consoleUrl: 'https://dashboard.convex.dev'
  },
  {
    id: 'pocketbase',
    name: 'PocketBase',
    kind: 'SQLite self-host',
    summary: 'Un binaire : API, auth, admin, SQLite. Idéal en local et petits déploiements.',
    choose: 'Prototype, outil interne, self-host simple, zéro cloud obligatoire. Tu lances `pocketbase serve` et c’est tout.',
    skip: 'Tu vises un scale mondial, du serverless multi-région, ou une équipe qui exige Postgres managé.',
    features: ['SQLite', 'Auth', 'Admin UI', 'Realtime', 'Un binaire', 'Self-host'],
    packages: ['pocketbase'],
    docsUrl: 'https://pocketbase.io/docs',
    consoleUrl: 'https://pocketbase.io'
  }
]

export const GUIDE = [
  { match: 'SQL + auth + fichiers, open source', id: 'supabase' },
  { match: 'Postgres seul, tu gères l’auth', id: 'neon' },
  { match: 'Temps réel + mobile Google', id: 'firebase' },
  { match: 'BaaS self-host, pas Google', id: 'appwrite' },
  { match: 'React/Next réactif, sans SQL', id: 'convex' },
  { match: 'Local / petit self-host SQLite', id: 'pocketbase' }
]

export function list() {
  return DATABASES.map(({ packages, extraNext, extraDev, ...pub }) => pub)
}

export function byId(id) {
  return DATABASES.find((d) => d.id === id) || DATABASES[0]
}

function envStyle(frameworkId) {
  if (frameworkId === 'next') return 'next'
  if (frameworkId === 'nuxt') return 'nuxt'
  if (frameworkId === 'astro' || frameworkId === 'sveltekit') return 'public'
  return 'vite'
}

function pubKey(style, name) {
  if (style === 'next') return `NEXT_PUBLIC_${name}`
  if (style === 'nuxt') return `NUXT_PUBLIC_${name}`
  if (style === 'public') return `PUBLIC_${name}`
  return `VITE_${name}`
}

function readEnv(style, key, secret = false) {
  if (secret || style === 'next' && key.startsWith('DATABASE')) return `process.env.${key}`
  if (style === 'next') return `process.env.${key}`
  if (style === 'nuxt') return `process.env.${key}`
  return `import.meta.env.${key}`
}

function packagesFor(db, frameworkId) {
  const extra = frameworkId === 'next' ? (db.extraNext || []) : []
  return [...new Set([...(db.packages || []), ...extra])]
}

function clientDir(root) {
  if (existsSync(join(root, 'src/renderer/src'))) return join(root, 'src/renderer/src/lib')
  if (existsSync(join(root, 'src'))) return join(root, 'src/lib')
  return join(root, 'lib')
}

function clientSource(db, frameworkId) {
  const style = envStyle(frameworkId)
  const e = (name, secret = false) => readEnv(style, secret ? name : pubKey(style, name), secret)

  if (db.id === 'supabase') {
    return `import { createClient } from '@supabase/supabase-js'

const url = ${e('SUPABASE_URL')}
const key = ${e('SUPABASE_ANON_KEY')}

if (!url || !key) {
  console.warn('Supabase : renseigne ${pubKey(style, 'SUPABASE_URL')} et ${pubKey(style, 'SUPABASE_ANON_KEY')} dans .env')
}

export const supabase = createClient(url || '', key || '')
`
  }

  if (db.id === 'firebase') {
    return `import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: ${e('FIREBASE_API_KEY')},
  authDomain: ${e('FIREBASE_AUTH_DOMAIN')},
  projectId: ${e('FIREBASE_PROJECT_ID')},
  storageBucket: ${e('FIREBASE_STORAGE_BUCKET')},
  messagingSenderId: ${e('FIREBASE_MESSAGING_SENDER_ID')},
  appId: ${e('FIREBASE_APP_ID')}
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)
`
  }

  if (db.id === 'neon') {
    return `import { neon } from '@neondatabase/serverless'

/**
 * Neon expose Postgres : la DATABASE_URL ne doit jamais partir dans le bundle client.
 * Importe ce module depuis une route serveur (Next Route Handler, Nuxt server, API Vite).
 */
if (typeof window !== 'undefined') {
  throw new Error('Neon est serveur uniquement. Passe par une route API.')
}

export const sql = neon(process.env.DATABASE_URL)
`
  }

  if (db.id === 'appwrite') {
    return `import { Client, Account, Databases, Storage } from 'appwrite'

export const appwrite = new Client()
  .setEndpoint(${e('APPWRITE_ENDPOINT')} || 'https://cloud.appwrite.io/v1')
  .setProject(${e('APPWRITE_PROJECT_ID')} || '')

export const account = new Account(appwrite)
export const databases = new Databases(appwrite)
export const storage = new Storage(appwrite)
`
  }

  if (db.id === 'convex') {
    return `import { ConvexHttpClient } from 'convex/browser'

const url = ${e('CONVEX_URL')}

export const convex = url ? new ConvexHttpClient(url) : null

/** Pour React : enveloppe l’app avec ConvexProvider (voir .pdc/database.md). */
`
  }

  if (db.id === 'pocketbase') {
    return `import PocketBase from 'pocketbase'

export const pb = new PocketBase(${e('POCKETBASE_URL')} || 'http://127.0.0.1:8090')
`
  }

  return ''
}

function envExample(db, frameworkId) {
  const style = envStyle(frameworkId)
  const p = (name) => pubKey(style, name)
  const lines = ['# Copie ce fichier vers .env et remplis les valeurs.', '# Ne commit jamais .env', '']
  if (db.id === 'supabase') {
    lines.push(`${p('SUPABASE_URL')}=https://xxxx.supabase.co`, `${p('SUPABASE_ANON_KEY')}=`)
  } else if (db.id === 'firebase') {
    lines.push(
      `${p('FIREBASE_API_KEY')}=`,
      `${p('FIREBASE_AUTH_DOMAIN')}=`,
      `${p('FIREBASE_PROJECT_ID')}=`,
      `${p('FIREBASE_STORAGE_BUCKET')}=`,
      `${p('FIREBASE_MESSAGING_SENDER_ID')}=`,
      `${p('FIREBASE_APP_ID')}=`
    )
  } else if (db.id === 'neon') {
    lines.push('# Serveur uniquement — ne pas préfixer VITE_ / NEXT_PUBLIC_', 'DATABASE_URL=postgresql://user:pass@host/db?sslmode=require')
  } else if (db.id === 'appwrite') {
    lines.push(`${p('APPWRITE_ENDPOINT')}=https://cloud.appwrite.io/v1`, `${p('APPWRITE_PROJECT_ID')}=`)
  } else if (db.id === 'convex') {
    lines.push(`${p('CONVEX_URL')}=https://happy-animal-123.convex.cloud`, '# Après `npx convex dev`, Convex écrit aussi CONVEX_DEPLOYMENT.')
  } else if (db.id === 'pocketbase') {
    lines.push(`${p('POCKETBASE_URL')}=http://127.0.0.1:8090`)
  }
  return `${lines.join('\n')}\n`
}

function guideMd(db, frameworkId) {
  const others = DATABASES.filter((d) => d.id !== 'none' && d.id !== db.id)
    .map((d) => `- **${d.name}** — ${d.summary}`)
    .join('\n')
  const next = []
  if (db.id === 'supabase') next.push('1. Crée un projet sur https://supabase.com/dashboard', '2. Copie URL + anon key dans `.env`', '3. Active Auth si besoin, crée tes tables dans le SQL editor.')
  if (db.id === 'firebase') next.push('1. Console Firebase → ajoute une app Web', '2. Copie la config dans `.env`', '3. Crée Firestore + Authentication.')
  if (db.id === 'neon') next.push('1. https://console.neon.tech → New Project', '2. Copie `DATABASE_URL` dans `.env` (jamais exposée au client)', '3. `npx drizzle-kit generate` puis migrate quand tu auras un schéma.')
  if (db.id === 'appwrite') next.push('1. Cloud https://cloud.appwrite.io ou Docker self-host', '2. Crée un projet, copie l’endpoint et l’ID', '3. Ajoute une plateforme Web (hostname).')
  if (db.id === 'convex') next.push('1. `npx convex dev` dans le projet (compte Convex)', '2. Le CLI écrit `CONVEX_URL`', '3. En React : `ConvexProvider` autour de l’app (docs.convex.dev/client/react).')
  if (db.id === 'pocketbase') next.push('1. Télécharge le binaire : https://pocketbase.io/docs/', '2. `./pocketbase serve` → admin http://127.0.0.1:8090/_/', '3. Crée collections + auth, laisse `POCKETBASE_URL` sur localhost.')

  return `# Base de données : ${db.name}

${db.summary}

## Pourquoi ce choix

**À prendre si** ${db.choose}

**À éviter si** ${db.skip}

Framework du projet : \`${frameworkId}\`.

## Suite

${next.join('\n')}

Client généré : \`src/lib/database.js\` (ou \`lib/database.js\`).
Variables : \`.env.example\` → copie en \`.env\`.

## Les autres options

${others}

Guide rapide : SQL+auth → Supabase · Postgres seul → Neon · Google/mobile → Firebase · self-host BaaS → Appwrite · React réactif → Convex · SQLite local → PocketBase.
`
}

function convexSchema() {
  return `import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  items: defineTable({
    title: v.string(),
    createdAt: v.number()
  })
})
`
}

function neonSchema() {
  return `import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const items = pgTable('items', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow()
})
`
}

function ensureGitignore(root) {
  const file = join(root, '.gitignore')
  const extra = ['.env', '.env.local', '.env*.local']
  let current = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const add = extra.filter((line) => !current.split(/\r?\n/).includes(line))
  if (!add.length) return
  const block = `${current.endsWith('\n') || !current ? '' : '\n'}# secrets locaux (PDC Builder)\n${add.join('\n')}\n`
  if (existsSync(file)) appendFileSync(file, block)
  else writeFileSync(file, block, 'utf8')
}

function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

export function writeFiles(root, databaseId, frameworkId) {
  const db = byId(databaseId)
  if (!db || db.id === 'none') return { files: [], packages: [], extraDev: [] }

  const files = []
  const dir = clientDir(root)
  const clientPath = join(dir, 'database.js')
  writeFile(clientPath, clientSource(db, frameworkId))
  files.push(clientPath)

  const envPath = join(root, '.env.example')
  writeFile(envPath, envExample(db, frameworkId))
  files.push(envPath)

  const mdPath = join(root, '.pdc', 'database.md')
  writeFile(mdPath, guideMd(db, frameworkId))
  files.push(mdPath)

  if (db.id === 'convex') {
    const schema = join(root, 'convex', 'schema.js')
    writeFile(schema, convexSchema())
    files.push(schema)
  }
  if (db.id === 'neon') {
    const schema = join(dir, 'schema.js')
    writeFile(schema, neonSchema())
    files.push(schema)
  }

  ensureGitignore(root)
  return {
    files,
    packages: packagesFor(db, frameworkId),
    extraDev: db.extraDev || []
  }
}

export function relativeFiles(root, files) {
  return files.map((f) => f.slice(root.length).replace(/^[\\/]/, '').replace(/\\/g, '/'))
}
