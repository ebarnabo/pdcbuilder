import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'

const FILE = () => join(app.getPath('userData'), 'pdc-builder.json')

const fw = (id, name, tag, description, create, extra = {}) => ({
  id,
  name,
  tag,
  description,
  create,
  install: 'npm install',
  dev: 'npm run dev',
  build: 'npm run build',
  preview: 'npm run preview',
  outDir: 'dist',
  builtin: true,
  ...extra
})

export const DEFAULT_FRAMEWORKS = [
  fw('vite-react', 'Vite + React', 'React', 'SPA rapide, TypeScript, HMR instantané. Le choix par défaut pour une interface riche.',
    'npm create vite@latest {{name}} -- --template react-ts'),
  fw('vite-vue', 'Vite + Vue', 'Vue', 'SPA Vue 3 avec <script setup> et TypeScript.',
    'npm create vite@latest {{name}} -- --template vue-ts'),
  fw('vite-svelte', 'Vite + Svelte', 'Svelte', 'Compilé, sans runtime lourd. Idéal pour les interfaces animées légères.',
    'npm create vite@latest {{name}} -- --template svelte-ts'),
  fw('vite-vanilla', 'Vite + Vanilla', 'JS', 'Zéro framework, TypeScript et bundling moderne. Parfait pour un prototype ou une PWA.',
    'npm create vite@latest {{name}} -- --template vanilla-ts'),
  fw('next', 'Next.js', 'React', 'App Router, rendu serveur, routes API. Pour un site avec SEO et back-end intégré.',
    'npx --yes create-next-app@latest {{name}} --ts --tailwind --eslint --app --src-dir --use-npm --no-import-alias --no-turbopack',
    { outDir: '.next', preview: 'npm run start' }),
  fw('astro', 'Astro', 'Contenu', 'Sites de contenu ultra-légers, îlots interactifs à la demande.',
    'npm create astro@latest {{name}} -- --template minimal --typescript strict --no-install --no-git --skip-houston'),
  fw('sveltekit', 'SvelteKit', 'Svelte', 'Full-stack Svelte : routing fichier, endpoints, adaptateurs de déploiement.',
    'npx --yes sv create {{name}} --template minimal --types ts --no-add-ons --no-install',
    { outDir: 'build' }),
  fw('nuxt', 'Nuxt', 'Vue', 'Full-stack Vue avec rendu hybride et auto-imports.',
    'npx --yes nuxi@latest init {{name}} --packageManager npm --no-install --gitInit false',
    { outDir: '.output' }),
  fw('electron-react', 'Electron + React', 'Desktop', 'Application de bureau Mac/Windows avec Vite et React.',
    'npm create --yes @quick-start/electron@latest {{name}} -- --template react-ts',
    { outDir: 'dist', preview: 'npm run start' })
]

const lib = (name, pkg, description, dev = false) => ({ id: pkg, name, pkg, description, dev })

export const DEFAULT_LIBRARIES = [
  {
    id: 'ui', name: 'Interface & composants',
    description: 'Bases visuelles, primitives accessibles et systèmes de style.',
    items: [
      lib('Tailwind CSS', 'tailwindcss', 'Utilitaires CSS, thème centralisé, purge automatique.', true),
      lib('Radix UI', '@radix-ui/react-dialog', 'Primitives non stylées et accessibles : modales, menus, popovers.'),
      lib('Headless UI', '@headlessui/react', 'Composants sans style, pensés pour Tailwind.'),
      lib('Lucide', 'lucide-react', 'Icônes vectorielles cohérentes, tree-shakables.'),
      lib('Vaul', 'vaul', 'Drawers façon iOS avec gestes tactiles.'),
      lib('Sonner', 'sonner', 'Toasts empilables, discrets et animés.')
    ]
  },
  {
    id: 'motion', name: 'Animation & mouvement',
    description: 'Transitions, gestes et défilement animé à 60 fps.',
    items: [
      lib('Motion (Framer)', 'framer-motion', 'Animations déclaratives, layout animations, gestes.'),
      lib('GSAP', 'gsap', 'Timeline puissante pour les séquences complexes.'),
      lib('Lenis', 'lenis', 'Défilement lissé, base des effets de scroll.'),
      lib('Auto Animate', '@formkit/auto-animate', 'Une ligne pour animer ajouts et suppressions de listes.'),
      lib('React Spring', '@react-spring/web', 'Animations basées sur la physique.')
    ]
  },
  {
    id: 'state', name: 'État & données',
    description: 'Stockage local, cache réseau et synchronisation serveur.',
    items: [
      lib('Zustand', 'zustand', 'Store minimal, sans boilerplate ni provider.'),
      lib('TanStack Query', '@tanstack/react-query', 'Cache, revalidation et états de chargement du réseau.'),
      lib('Jotai', 'jotai', 'État atomique, granularité fine.'),
      lib('Redux Toolkit', '@reduxjs/toolkit', 'Store centralisé pour les grosses applications.')
    ]
  },
  {
    id: 'forms', name: 'Formulaires & validation',
    description: 'Saisie contrôlée, schémas et messages d\'erreur.',
    items: [
      lib('React Hook Form', 'react-hook-form', 'Formulaires performants, peu de re-rendus.'),
      lib('Zod', 'zod', 'Schémas TypeScript avec inférence de types.'),
      lib('Hookform Resolvers', '@hookform/resolvers', 'Pont entre React Hook Form et Zod ou Yup.')
    ]
  },
  {
    id: 'backend', name: 'Back-end & base de données',
    description: 'Auth, stockage, requêtes et ORM.',
    items: [
      lib('Supabase', '@supabase/supabase-js', 'Postgres, auth, storage et temps réel en une clé.'),
      lib('Prisma', 'prisma', 'ORM typé avec migrations et studio.', true),
      lib('Drizzle', 'drizzle-orm', 'ORM SQL léger, proche du langage.'),
      lib('Axios', 'axios', 'Client HTTP avec intercepteurs.'),
      lib('Better Auth', 'better-auth', 'Authentification complète côté serveur.')
    ]
  },
  {
    id: '3d', name: '3D, canvas & jeux',
    description: 'Rendu temps réel et scènes interactives.',
    items: [
      lib('Three.js', 'three', 'Moteur 3D WebGL de référence.'),
      lib('React Three Fiber', '@react-three/fiber', 'Three.js en composants React.'),
      lib('Drei', '@react-three/drei', 'Helpers prêts à l\'emploi pour R3F.'),
      lib('PixiJS', 'pixi.js', 'Rendu 2D accéléré pour jeux et effets.'),
      lib('Phaser', 'phaser', 'Moteur de jeu 2D complet.')
    ]
  },
  {
    id: 'dataviz', name: 'Graphiques & données',
    description: 'Visualisation et tableaux.',
    items: [
      lib('Recharts', 'recharts', 'Graphiques composables construits sur D3.'),
      lib('D3', 'd3', 'Contrôle total sur la représentation des données.'),
      lib('TanStack Table', '@tanstack/react-table', 'Tableaux triables, filtrables, virtualisés.'),
      lib('Chart.js', 'chart.js', 'Graphiques canvas simples et rapides.')
    ]
  },
  {
    id: 'routing', name: 'Navigation',
    description: 'Routage client et transitions de page.',
    items: [
      lib('React Router', 'react-router-dom', 'Routage déclaratif, loaders et actions.'),
      lib('TanStack Router', '@tanstack/react-router', 'Routage typé de bout en bout.')
    ]
  },
  {
    id: 'pwa', name: 'PWA & hors ligne',
    description: 'Installation, cache et stockage local.',
    items: [
      lib('Vite PWA', 'vite-plugin-pwa', 'Manifest, service worker et mise à jour automatique.', true),
      lib('Workbox Window', 'workbox-window', 'Contrôle fin du cycle de vie du service worker.'),
      lib('Dexie', 'dexie', 'IndexedDB avec une API lisible.')
    ]
  },
  {
    id: 'content', name: 'Contenu & SEO',
    description: 'Markdown, métadonnées et coloration syntaxique.',
    items: [
      lib('Gray Matter', 'gray-matter', 'Lecture du front-matter des fichiers Markdown.'),
      lib('Marked', 'marked', 'Conversion Markdown vers HTML.'),
      lib('Shiki', 'shiki', 'Coloration de code fidèle à VS Code.'),
      lib('Next SEO', 'next-seo', 'Balises méta et données structurées pour Next.js.')
    ]
  },
  {
    id: 'quality', name: 'Qualité & tests',
    description: 'Lint, format et tests automatisés.',
    items: [
      lib('Vitest', 'vitest', 'Tests unitaires rapides, compatibles Vite.', true),
      lib('Testing Library', '@testing-library/react', 'Tests centrés sur l\'usage réel des composants.', true),
      lib('Playwright', '@playwright/test', 'Tests de bout en bout multi-navigateurs.', true),
      lib('Prettier', 'prettier', 'Formatage automatique du code.', true),
      lib('Husky', 'husky', 'Hooks Git pour bloquer le code non conforme.', true)
    ]
  },
  {
    id: 'utils', name: 'Utilitaires',
    description: 'Petites briques utilisées partout.',
    items: [
      lib('date-fns', 'date-fns', 'Manipulation de dates modulaire.'),
      lib('clsx', 'clsx', 'Composition de classes conditionnelles.'),
      lib('tailwind-merge', 'tailwind-merge', 'Fusion des classes Tailwind en conflit.'),
      lib('nanoid', 'nanoid', 'Identifiants courts et sûrs.'),
      lib('lodash-es', 'lodash-es', 'Fonctions utilitaires tree-shakables.')
    ]
  }
]

export const DEFAULTS = {
  workspace: join(homedir(), 'PDC Projects'),
  packageManager: 'npm',
  editor: 'code',
  projects: [],
  blueprints: [],
  frameworks: DEFAULT_FRAMEWORKS,
  libraries: DEFAULT_LIBRARIES,
  ai: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5-coder:7b',
    apiKey: '',
    temperature: 0.4
  },
  git: {
    autoCreate: true,
    provider: 'github',
    visibility: 'private',
    org: '',
    branch: 'main'
  }
}

let cache = null

export function read() {
  if (cache) return cache
  try {
    if (existsSync(FILE())) {
      const parsed = JSON.parse(readFileSync(FILE(), 'utf8'))
      cache = {
        ...DEFAULTS,
        ...parsed,
        ai: { ...DEFAULTS.ai, ...(parsed.ai || {}) },
        git: { ...DEFAULTS.git, ...(parsed.git || {}) }
      }
    } else {
      cache = structuredClone(DEFAULTS)
      write(cache)
    }
  } catch {
    cache = structuredClone(DEFAULTS)
  }
  if (!existsSync(cache.workspace)) {
    try { mkdirSync(cache.workspace, { recursive: true }) } catch { /* ignore */ }
  }
  return cache
}

export function write(next) {
  cache = next
  writeFileSync(FILE(), JSON.stringify(next, null, 2), 'utf8')
  return cache
}

export function patch(fields) {
  return write({ ...read(), ...fields })
}
