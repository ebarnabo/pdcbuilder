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
      lib('Sonner', 'sonner', 'Toasts empilables, discrets et animés.'),
      lib('shadcn/ui', 'shadcn', 'CLI pour copier des composants soignés, à toi ensuite.', true),
      lib('HeroUI', '@heroui/react', 'Système de composants Tailwind, thème cohérent, accessible.'),
      lib('Base UI', '@base-ui/react', 'Primitives headless de MUI, sans style imposé.'),
      lib('React Aria', 'react-aria-components', 'Composants accessibles Adobe, comportement clavier et lecteurs d’écran.'),
      lib('DaisyUI', 'daisyui', 'Classes de composants prêtes à l’emploi au-dessus de Tailwind.', true),
      lib('Radix Themes', '@radix-ui/themes', 'Design system Radix : tokens, layout et composants déjà habillés.'),
      lib('CVA', 'class-variance-authority', 'Variants de classes typés pour boutons, chips et états.'),
      lib('cmdk', 'cmdk', 'Palette de commandes façon Spotlight, filtrable au clavier.'),
      lib('Embla Carousel', 'embla-carousel-react', 'Carrousels fluides, gestes et boucle, sans CSS imposé.'),
      lib('Floating UI', '@floating-ui/react', 'Positionnement précis des popovers, tooltips et menus.'),
      lib('next-themes', 'next-themes', 'Clair / sombre / système, sans flash au chargement.'),
      lib('React Day Picker', 'react-day-picker', 'Calendrier de dates, plages et localisation.'),
      lib('React Error Boundary', 'react-error-boundary', 'Isole un crash UI : le reste de l’app continue.'),
      lib('React Resizable Panels', 'react-resizable-panels', 'Panneaux redimensionnables, IDE et dashboards.'),
      lib('dnd kit', '@dnd-kit/core', 'Drag-and-drop accessible, clavier compris.'),
      lib('dnd kit Sortable', '@dnd-kit/sortable', 'Listes réordonnables, empilement et animations.'),
      lib('React Dropzone', 'react-dropzone', 'Zone de dépôt de fichiers, drag, preview, validation.'),
      lib('input-otp', 'input-otp', 'Champ code à 6 chiffres, SMS et 2FA.')
    ]
  },
  {
    id: 'design', name: 'Design visuel',
    description: 'Icônes, typographie, couleur, illustration et micro-détails d’interface.',
    items: [
      lib('Phosphor Icons', '@phosphor-icons/react', 'Famille d’icônes à six graisses, très lisible en petit.'),
      lib('Tabler Icons', '@tabler/icons-react', 'Trait fin, grille régulière, couvre presque tous les usages produit.'),
      lib('Iconify', '@iconify/react', 'Un composant, des milliers de sets (Lucide, Tabler, Heroicons…).'),
      lib('Simple Icons', 'simple-icons', 'Logos de marques en SVG, pour les stacks et crédits.'),
      lib('Fontsource Inter', '@fontsource-variable/inter', 'Inter variable auto-hébergée, plus de Google Fonts au runtime.', true),
      lib('Fontsource JetBrains Mono', '@fontsource-variable/jetbrains-mono', 'Mono variable pour le code, les chemins et les compteurs.', true),
      lib('Tailwind Typography', '@tailwindcss/typography', 'Prose soignée : titres, listes, citations, code inline.', true),
      lib('tw-animate-css', 'tw-animate-css', 'Animations Tailwind v4 : enter, accordion, overlay.', true),
      lib('chroma.js', 'chroma-js', 'Rampes, contrastes et conversions de couleur pour un thème solide.'),
      lib('Number Flow', '@number-flow/react', 'Chiffres qui se dévident, pour les totaux et les prix.'),
      lib('Lottie', '@lottiefiles/dotlottie-react', 'Illustrations et micro-animations After Effects, légères.'),
      lib('Spline', '@splinetool/react-spline', 'Scènes 3D conçues dans Spline, embarquées en React.'),
      lib('Rive', '@rive-app/react-canvas', 'Animations interactives, états et runtimes temps réel.')
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
      lib('React Spring', '@react-spring/web', 'Animations basées sur la physique.'),
      lib('anime.js', 'animejs', 'Tweens et timelines JS, idéal pour les mises en scène.'),
      lib('Theatre.js', '@theatre/core', 'Studio visuel pour chorégraphier caméra, overlay et timing.'),
      lib('GSAP React', '@gsap/react', 'Hook useGSAP : timelines liées au cycle de vie React.', true),
      lib('Animate.css', 'animate.css', 'Classes d’entrée, de sortie et d’attention, sans JavaScript.', true),
      lib('Use Gesture', '@use-gesture/react', 'Drag, pinch, wheel : le geste pilote l’animation.'),
      lib('React Flip Toolkit', 'react-flip-toolkit', 'FLIP : les listes se réorganisent sans sauter.'),
      lib('React Scroll Parallax', 'react-scroll-parallax', 'Couches de parallaxe au scroll, offsets et easing.'),
      lib('Locomotive Scroll', 'locomotive-scroll', 'Défilement cinématique, speed et data-scroll.'),
      lib('SplitType', 'split-type', 'Découpe mots, lettres et lignes pour animer un titre.'),
      lib('Typed.js', 'typed.js', 'Machine à écrire : titres, placeholders, dialogues.'),
      lib('Rough Notation', 'rough-notation', 'Soulignements, cercles et encadrés dessinés à la main.'),
      lib('Vivus', 'vivus', 'Tracé SVG ligne par ligne, comme un dessin en direct.'),
      lib('Barba.js', '@barba/core', 'Transitions de pages, vues qui se croisent sans recharger.'),
      lib('Next View Transitions', 'next-view-transitions', 'View Transitions API branchée sur l’App Router.'),
      lib('React Transition Group', 'react-transition-group', 'Enter / exit des composants React, le classique fiable.'),
      lib('tsParticles', '@tsparticles/react', 'Particules, confettis et fonds vivants.'),
      lib('Matter.js', 'matter-js', 'Physique 2D : chutes, collisions, objets qui rebondissent.'),
      lib('Swiper', 'swiper', 'Sliders tactiles, effets coverflow, fade et cubes.'),
      lib('React CountUp', 'react-countup', 'Compteurs qui montent, pour les stats et les totaux.'),
      lib('React Intersection Observer', 'react-intersection-observer', 'Déclenche l’animation dès que l’élément entre dans le cadre.'),
      lib('Popmotion', 'popmotion', 'Moteur de tweens et de springs, pour piloter n’importe quelle valeur.'),
      lib('React Awesome Reveal', 'react-awesome-reveal', 'Reveals au scroll, une prop et le bloc apparaît.'),
      lib('Bezier Easing', 'bezier-easing', 'Courbes de Bézier custom, les mêmes que dans After Effects.')
    ]
  },
  {
    id: 'state', name: 'État & données',
    description: 'Stockage local, cache réseau et synchronisation serveur.',
    items: [
      lib('Zustand', 'zustand', 'Store minimal, sans boilerplate ni provider.'),
      lib('TanStack Query', '@tanstack/react-query', 'Cache, revalidation et états de chargement du réseau.'),
      lib('Jotai', 'jotai', 'État atomique, granularité fine.'),
      lib('Redux Toolkit', '@reduxjs/toolkit', 'Store centralisé pour les grosses applications.'),
      lib('SWR', 'swr', 'Cache HTTP de Vercel, revalidation au focus.'),
      lib('nuqs', 'nuqs', 'État dans l’URL : filtres, onglets, pagination.'),
      lib('TanStack Virtual', '@tanstack/react-virtual', 'Listes et grilles virtualisées, 10 000 lignes sans mal.'),
      lib('XState', '@xstate/react', 'Machines à états : tunnels, wizards, sockets.'),
      lib('idb-keyval', 'idb-keyval', 'IndexedDB en get/set, persistance simple hors ligne.')
    ]
  },
  {
    id: 'forms', name: 'Formulaires & validation',
    description: 'Saisie contrôlée, schémas et messages d\'erreur.',
    items: [
      lib('React Hook Form', 'react-hook-form', 'Formulaires performants, peu de re-rendus.'),
      lib('Zod', 'zod', 'Schémas TypeScript avec inférence de types.'),
      lib('Hookform Resolvers', '@hookform/resolvers', 'Pont entre React Hook Form et Zod ou Yup.'),
      lib('Valibot', 'valibot', 'Schémas plus légers que Zod, même idée.'),
      lib('TanStack Form', '@tanstack/react-form', 'Formulaires typés, framework-agnostic, peu de re-rendus.')
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
      lib('Better Auth', 'better-auth', 'Authentification complète côté serveur.'),
      lib('Hono', 'hono', 'API ultra-légère, Edge, Node et workers.'),
      lib('tRPC', '@trpc/client', 'RPC bout-en-bout typé, plus de contrat OpenAPI à tenir.'),
      lib('ky', 'ky', 'Fetch moderne : timeout, retry, JSON, sans Axios.'),
      lib('Auth.js', 'next-auth', 'Sessions, OAuth et magic links, Next et au-delà.'),
      lib('Stripe', 'stripe', 'Paiements, webhooks et factures côté serveur.'),
      lib('Stripe.js', '@stripe/stripe-js', 'Checkout et Elements dans le navigateur.'),
      lib('Resend', 'resend', 'E-mails transactionnels, React Email, DNS propre.'),
      lib('UploadThing', '@uploadthing/react', 'Uploads de fichiers typés, sans te battre avec S3.'),
      lib('GraphQL Request', 'graphql-request', 'Client GraphQL minimal, une fonction, un typage.'),
      lib('Drizzle Kit', 'drizzle-kit', 'Migrations et studio pour Drizzle.', true)
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
      lib('Phaser', 'phaser', 'Moteur de jeu 2D complet.'),
      lib('Rapier', '@react-three/rapier', 'Physique 3D dans R3F, collisions et corps rigides.'),
      lib('Postprocessing', '@react-three/postprocessing', 'Bloom, DOF, SSAO : la couche cinéma de Three.')
    ]
  },
  {
    id: 'dataviz', name: 'Graphiques & données',
    description: 'Visualisation et tableaux.',
    items: [
      lib('Recharts', 'recharts', 'Graphiques composables construits sur D3.'),
      lib('D3', 'd3', 'Contrôle total sur la représentation des données.'),
      lib('TanStack Table', '@tanstack/react-table', 'Tableaux triables, filtrables, virtualisés.'),
      lib('Chart.js', 'chart.js', 'Graphiques canvas simples et rapides.'),
      lib('ECharts', 'echarts-for-react', 'Grands volumes, cartes, polar, le standard dashboard.'),
      lib('Tremor', '@tremor/react', 'Blocs de dashboard Tailwind : KPI, charts, listes.')
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
      lib('Next SEO', 'next-seo', 'Balises méta et données structurées pour Next.js.'),
      lib('React Markdown', 'react-markdown', 'Markdown sûr en React, plugins remark / rehype.'),
      lib('MDX', '@mdx-js/react', 'Markdown + JSX : doc, blog, MDX dans l’app.'),
      lib('DOMPurify', 'isomorphic-dompurify', 'Nettoie le HTML, coupe XSS serveur et client.'),
      lib('Tiptap', '@tiptap/react', 'Éditeur riche headless, extensions, collab.'),
      lib('Tiptap Starter', '@tiptap/starter-kit', 'Gras, listes, titres, liens : le kit de départ Tiptap.'),
      lib('Monaco Editor', '@monaco-editor/react', 'L’éditeur de VS Code dans la page.'),
      lib('next-sitemap', 'next-sitemap', 'sitemap.xml et robots.txt à chaque build.', true)
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
      lib('Husky', 'husky', 'Hooks Git pour bloquer le code non conforme.', true),
      lib('TypeScript', 'typescript', 'Types, autocomplete et refactors, le socle.', true),
      lib('ESLint', 'eslint', 'Règles de code, importe, hooks, a11y.', true),
      lib('Biome', '@biomejs/biome', 'Lint + format ultra-rapide, un binaire à la place de deux.', true),
      lib('MSW', 'msw', 'Mocke le réseau dans les tests et en local.', true),
      lib('lint-staged', 'lint-staged', 'Ne lint que les fichiers du commit.', true),
      lib('Storybook', 'storybook', 'Isoler, documenter et recetter chaque composant.', true)
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
      lib('lodash-es', 'lodash-es', 'Fonctions utilitaires tree-shakables.'),
      lib('Day.js', 'dayjs', 'Dates minuscules, même API que Moment.'),
      lib('es-toolkit', 'es-toolkit', 'Le lodash moderne, plus petit, mieux typé.'),
      lib('Immer', 'immer', 'Mutations immutables, pour les stores et les reducers.'),
      lib('uuid', 'uuid', 'Identifiants RFC, v4 et v7.'),
      lib('ts-pattern', 'ts-pattern', 'Pattern matching exhaustif en TypeScript.'),
      lib('SuperJSON', 'superjson', 'Date, Map, Set et BigInt à travers le JSON.'),
      lib('Papa Parse', 'papaparse', 'CSV dans les deux sens, streaming, workers.'),
      lib('slugify', 'slugify', 'Noms de fichiers et d’URL, ASCII propre.')
    ]
  },
  {
    id: 'i18n', name: 'Internationalisation',
    description: 'Langues, locales et messages.',
    items: [
      lib('i18next', 'i18next', 'Moteur i18n : pluriels, namespaces, détection.'),
      lib('React i18next', 'react-i18next', 'Hooks et Suspense pour i18next dans React.'),
      lib('next-intl', 'next-intl', 'i18n App Router : messages, dates, middleware de locale.')
    ]
  },
  {
    id: 'ai', name: 'IA & modèles',
    description: 'SDK pour chat, embeddings et outils.',
    items: [
      lib('Vercel AI SDK', 'ai', 'Streaming, tools et UI de chat, tous fournisseurs.'),
      lib('AI SDK React', '@ai-sdk/react', 'useChat, useCompletion, le pont React du SDK.'),
      lib('OpenAI', 'openai', 'Client officiel GPT, embeddings et images.')
    ]
  },
  {
    id: 'media', name: 'Média & fichiers',
    description: 'Audio, vidéo, images, PDF et capture.',
    items: [
      lib('Howler', 'howler', 'Audio web : sprites, fade, Web Audio et HTML5.'),
      lib('hls.js', 'hls.js', 'Lecture HLS dans le navigateur, live et VOD.'),
      lib('Lightbox', 'yet-another-react-lightbox', 'Galerie plein écran, zoom, clavier.'),
      lib('pdf-lib', 'pdf-lib', 'Créer et modifier des PDF dans le navigateur.'),
      lib('html-to-image', 'html-to-image', 'Capture un nœud DOM en PNG, JPEG ou SVG.'),
      lib('Sharp', 'sharp', 'Redimensionne et convertit les images côté Node.', true)
    ]
  },
  {
    id: 'realtime', name: 'Temps réel & collab',
    description: 'Sockets, présence et documents partagés.',
    items: [
      lib('Socket.IO', 'socket.io-client', 'WebSocket avec fallback, salles et reconnexion.'),
      lib('Yjs', 'yjs', 'CRDT : un même document édité à plusieurs, sans conflit.')
    ]
  },
  {
    id: 'observability', name: 'Observabilité',
    description: 'Erreurs, produit et perf en production.',
    items: [
      lib('Sentry', '@sentry/react', 'Crashes, traces et session replay.'),
      lib('PostHog', 'posthog-js', 'Analytics, feature flags et replays, auto-hébergeable.')
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

function mergeLibraries(saved, defaults) {
  const byId = new Map((saved || []).map((c) => [c.id, { ...c, items: [...(c.items || [])] }]))
  for (const cat of defaults) {
    if (!byId.has(cat.id)) {
      byId.set(cat.id, structuredClone(cat))
      continue
    }
    const existing = byId.get(cat.id)
    const pkgs = new Set(existing.items.map((i) => i.pkg))
    for (const item of cat.items) {
      if (!pkgs.has(item.pkg)) existing.items.push(structuredClone(item))
    }
  }
  const ordered = []
  const seen = new Set()
  for (const cat of defaults) {
    ordered.push(byId.get(cat.id))
    seen.add(cat.id)
  }
  for (const cat of saved || []) {
    if (!seen.has(cat.id)) ordered.push(byId.get(cat.id))
  }
  return ordered
}

export function read() {
  if (cache) return cache
  try {
    if (existsSync(FILE())) {
      const parsed = JSON.parse(readFileSync(FILE(), 'utf8'))
      cache = {
        ...DEFAULTS,
        ...parsed,
        ai: { ...DEFAULTS.ai, ...(parsed.ai || {}) },
        git: { ...DEFAULTS.git, ...(parsed.git || {}) },
        libraries: mergeLibraries(parsed.libraries, DEFAULT_LIBRARIES)
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
