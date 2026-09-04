/**
 * Sanity CMS — studio local, prérequis machine, config auto.
 * Scaffold sans login cloud (projectId placeholder) pour rester non interactif.
 */
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import * as toolchain from './toolchain.js'

export const TEMPLATES = [
  {
    id: 'clean',
    name: 'Clean',
    blurb: 'Studio vide. Tu ajoutes les schémas ensuite.'
  },
  {
    id: 'blog',
    name: 'Blog',
    blurb: 'Articles + auteurs. Bon départ éditorial.'
  },
  {
    id: 'shop',
    name: 'Shop',
    blurb: 'Produits simples (titre, prix, image).'
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

export function normalizeTemplate(id) {
  return TEMPLATES.some((t) => t.id === id) ? id : 'clean'
}

function slugify(name) {
  return String(name || 'sanity-studio')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'sanity-studio'
}

export async function checkPrereqs() {
  const status = await toolchain.status()
  const byId = Object.fromEntries([
    ...(status.tools || []).map((t) => [t.id, t]),
    ...(status.python || []).map((t) => [t.id, t])
  ])

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
        ? `v${nodeVersion || '?'} — Sanity recommande ≥ ${MIN_NODE.major}`
        : `Absent — ≥ ${MIN_NODE.major} requis`,
    required: true,
    ok: nodeReady,
    installed: Boolean(node?.installed),
    canInstall: Boolean(node?.canInstall || (node?.installed && !nodeReady && node?.canUpdate)),
    installAs: 'node',
    hint: 'Runtime JS pour Sanity Studio.'
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
    hint: 'Contrôle de version.'
  })

  const sanity = byId.sanity
  rows.push({
    id: 'sanity',
    toolId: 'sanity',
    name: 'Sanity CLI',
    detail: sanity?.installed
      ? (sanity.version ? `v${sanity.version}` : 'Détecté')
      : 'Optionnel — login / lien projet cloud',
    required: false,
    ok: true,
    installed: Boolean(sanity?.installed),
    canInstall: Boolean(sanity?.canInstall),
    installAs: 'sanity',
    hint: 'Utile après le scaffold : sanity login, sanity init / manage.'
  })

  const missing = rows.filter((r) => r.required && !r.ok)
  return {
    templateOptions: TEMPLATES,
    minNode: String(MIN_NODE.major),
    items: rows,
    ready: missing.length === 0,
    missing: missing.map((r) => r.id),
    installer: status.installer
  }
}

function write(path, content) {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content.trimStart().replace(/^\n/, ''), 'utf8')
}

function schemaFor(template) {
  if (template === 'blog') {
    return {
      files: {
        'schemaTypes/post.ts': `
import {defineField, defineType} from 'sanity'

export const post = defineType({
  name: 'post',
  title: 'Article',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Titre', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' } }),
    defineField({ name: 'author', title: 'Auteur', type: 'reference', to: [{ type: 'author' }] }),
    defineField({ name: 'mainImage', title: 'Image', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'publishedAt', title: 'Publié le', type: 'datetime' }),
    defineField({ name: 'body', title: 'Corps', type: 'array', of: [{ type: 'block' }] }),
  ],
})
`,
        'schemaTypes/author.ts': `
import {defineField, defineType} from 'sanity'

export const author = defineType({
  name: 'author',
  title: 'Auteur',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Nom', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'image', title: 'Photo', type: 'image' }),
    defineField({ name: 'bio', title: 'Bio', type: 'text' }),
  ],
})
`,
        'schemaTypes/index.ts': `
import {post} from './post'
import {author} from './author'

export const schemaTypes = [post, author]
`
      }
    }
  }
  if (template === 'shop') {
    return {
      files: {
        'schemaTypes/product.ts': `
import {defineField, defineType} from 'sanity'

export const product = defineType({
  name: 'product',
  title: 'Produit',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Nom', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' } }),
    defineField({ name: 'price', title: 'Prix', type: 'number' }),
    defineField({ name: 'image', title: 'Image', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
  ],
})
`,
        'schemaTypes/index.ts': `
import {product} from './product'

export const schemaTypes = [product]
`
      }
    }
  }
  return {
    files: {
      'schemaTypes/index.ts': `
import {defineType, defineField} from 'sanity'

const page = defineType({
  name: 'page',
  title: 'Page',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Titre', type: 'string' }),
    defineField({ name: 'body', title: 'Contenu', type: 'array', of: [{ type: 'block' }] }),
  ],
})

export const schemaTypes = [page]
`
    }
  }
}

/**
 * Écrit un studio Sanity v3 prêt à `npm install` + `npm run dev`.
 * projectId / dataset : placeholders ou valeurs fournies.
 */
export function scaffold(projectPath, {
  name = 'Sanity Studio',
  template = 'clean',
  projectId = '',
  dataset = 'production'
} = {}) {
  const t = normalizeTemplate(template)
  const slug = slugify(name)
  const pid = String(projectId || '').trim() || 'your-project-id'
  const ds = String(dataset || 'production').trim() || 'production'
  const written = []

  mkdirSync(projectPath, { recursive: true })
  mkdirSync(join(projectPath, 'schemaTypes'), { recursive: true })
  mkdirSync(join(projectPath, 'static'), { recursive: true })

  const pkg = {
    name: slug,
    private: true,
    version: '1.0.0',
    description: `Sanity Studio — ${name}`,
    scripts: {
      dev: 'sanity dev',
      start: 'sanity start',
      build: 'sanity build',
      deploy: 'sanity deploy'
    },
    dependencies: {
      '@sanity/vision': '^3.68.0',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      sanity: '^3.68.0',
      'styled-components': '^6.1.13'
    },
    devDependencies: {
      '@types/react': '^18.3.12',
      typescript: '^5.6.3'
    }
  }
  writeFileSync(join(projectPath, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  written.push('package.json')

  write(join(projectPath, 'sanity.config.ts'), `
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: '${slug}',
  title: ${JSON.stringify(name)},
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || '${pid}',
  dataset: process.env.SANITY_STUDIO_DATASET || '${ds}',
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
})
`)
  written.push('sanity.config.ts')

  write(join(projectPath, 'sanity.cli.ts'), `
import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || '${pid}',
    dataset: process.env.SANITY_STUDIO_DATASET || '${ds}',
  },
})
`)
  written.push('sanity.cli.ts')

  write(join(projectPath, 'tsconfig.json'), `
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "Preserve",
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
`)
  written.push('tsconfig.json')

  write(join(projectPath, '.gitignore'), `
node_modules
dist
.sanity
.env
.env.*
!.env.example
`)
  written.push('.gitignore')

  write(join(projectPath, '.env.example'), `
SANITY_STUDIO_PROJECT_ID=${pid === 'your-project-id' ? '' : pid}
SANITY_STUDIO_DATASET=${ds}
`)
  written.push('.env.example')

  write(join(projectPath, '.env'), `
SANITY_STUDIO_PROJECT_ID=${pid === 'your-project-id' ? '' : pid}
SANITY_STUDIO_DATASET=${ds}
`)
  written.push('.env')

  const schema = schemaFor(t)
  for (const [rel, content] of Object.entries(schema.files)) {
    write(join(projectPath, rel), content)
    written.push(rel)
  }

  return { ok: true, files: written, template: t, projectId: pid, dataset: ds, slug }
}

export function finalize(projectPath, {
  template = 'clean',
  name = '',
  projectId = '',
  dataset = 'production'
} = {}) {
  const t = normalizeTemplate(template)
  const pid = String(projectId || '').trim()
  const ds = String(dataset || 'production').trim() || 'production'
  const pdcDir = join(projectPath, '.pdc')
  mkdirSync(pdcDir, { recursive: true })

  const guide = `# Sanity — PDC Builder

Studio généré localement (non interactif). Le contenu vit sur le cloud Sanity.

| | |
|---|---|
| Template | \`${t}\` |
| Dataset | \`${ds}\` |
| Project ID | ${pid || '*(à renseigner)*'} |

## Brancher un projet cloud

1. Crée un compte / projet sur https://www.sanity.io/manage
2. \`npx sanity login\` (ou installe la Sanity CLI depuis Outils)
3. Mets \`SANITY_STUDIO_PROJECT_ID\` dans \`.env\`
4. \`npm run dev\` → Studio sur http://localhost:3333

## Démarrer

\`\`\`bash
npm run dev
\`\`\`

Docs : https://www.sanity.io/docs
`
  writeFileSync(join(pdcDir, 'SANITY.md'), guide, 'utf8')
  writeFileSync(join(pdcDir, 'sanity.json'), JSON.stringify({
    framework: 'sanity',
    template: t,
    projectId: pid || null,
    dataset: ds,
    createdAt: Date.now()
  }, null, 2), 'utf8')

  return {
    ok: true,
    files: ['.pdc/SANITY.md', '.pdc/sanity.json'],
    template: t,
    projectId: pid,
    dataset: ds
  }
}

/** Placeholder — le scaffold réel est dans scaffold(). */
export function buildCreateCommand() {
  return 'echo Sanity scaffold géré par PDC Builder'
}

export function isSanityFramework(fw) {
  if (!fw) return false
  return fw.id === 'sanity' || fw.kind === 'cms-sanity'
}
