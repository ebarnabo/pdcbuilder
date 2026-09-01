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
    id: 'react', name: 'React & Next',
    description: 'Kits de composants pour React et Next.js : design systems, primitives headless et docs.',
    items: [
      lib('MUI', '@mui/material', 'Material Design pour React : 100+ composants, thèmes, MUI X.'),
      lib('Mantine', '@mantine/core', 'Suite complète, hooks, style props, très à l’aise avec Next.'),
      lib('Chakra UI', '@chakra-ui/react', 'Composants accessibles, Ark UI et Panda CSS sous le capot.'),
      lib('Ant Design', 'antd', 'Design system entreprise : tables, formulaires, layouts admin.'),
      lib('PrimeReact', 'primereact', 'Large catalogue, DataTable, thèmes Aura, mode unstyled.'),
      lib('Ark UI', '@ark-ui/react', 'Primitives headless Zag, React / Vue / Solid, accessibles.'),
      lib('Ariakit', '@ariakit/react', 'Primitives accessibles, successeur de Reach UI.'),
      lib('Flowbite React', 'flowbite-react', 'Composants Tailwind prêts à l’emploi, version React.'),
      lib('React Bootstrap', 'react-bootstrap', 'Bootstrap 5 en composants React, sans jQuery.'),
      lib('Fluent UI', '@fluentui/react-components', 'Design system Microsoft : Office, Teams, dense et familier.'),
      lib('Polaris', '@shopify/polaris', 'Composants Shopify : admin, commerce, patterns produit.'),
      lib('Blueprint', '@blueprintjs/core', 'UI dense Palantir, pensée pour les outils desktop et data.'),
      lib('TDesign React', 'tdesign-react', 'Design system Tencent : dense, soigné, React.'),
      lib('Arco Design React', '@arco-design/web-react', 'Design system ByteDance, clair/sombre, React.'),
      lib('React Suite', 'rsuite', 'Suite mid-size : date pickers, tables, drawers, thèmes.'),
      lib('Semi Design', '@douyinfe/semi-ui', 'Design system Douyin : dashboards, semi-controlled, React.'),
      lib('Tamagui', 'tamagui', 'UI unifiée web et native, tokens, compilateur, Next et Expo.'),
      lib('Ionic React', '@ionic/react', 'Composants mobiles iOS/Android, PWA et Next.'),
      lib('Park UI', 'park-ui', 'CLI Ark + Panda : tu copies les composants, comme shadcn.', true),
      lib('Gluestack UI', '@gluestack-ui/core', 'Composants universels React et React Native, accessibles.'),
      lib('Fumadocs UI', 'fumadocs-ui', 'Composants de documentation pour Next : sidebar, TOC, search.'),
      lib('Evergreen', 'evergreen-ui', 'Design system Segment : soigné, desktop, React.')
    ]
  },
  {
    id: 'vue', name: 'Vue & Nuxt',
    description: 'Kits de composants pour Vue 3 et Nuxt : design systems, primitives headless et modules UI.',
    items: [
      lib('Nuxt UI', '@nuxt/ui', 'Kit officiel Nuxt/Vue : 120+ composants, Reka UI, Tailwind, thèmes.'),
      lib('Reka UI', 'reka-ui', 'Primitives headless accessibles (ex-Radix Vue) : modales, menus, focus.'),
      lib('shadcn-vue', 'shadcn-vue', 'CLI pour copier des composants Tailwind + Reka, à toi ensuite.', true),
      lib('Naive UI', 'naive-ui', 'Design system Vue 3 complet, TypeScript, thème clair/sombre.'),
      lib('Element Plus', 'element-plus', 'Suite de composants Element pour Vue 3, dashboards et admin.'),
      lib('Vuetify', 'vuetify', 'Material Design 3 pour Vue : grille, formulaires, navigation.'),
      lib('PrimeVue', 'primevue', 'Large catalogue, thèmes Aura/Lara, mode unstyled pour Tailwind.'),
      lib('Ant Design Vue', 'ant-design-vue', 'Ant Design porté sur Vue : tables, formulaires, layouts entreprise.'),
      lib('Headless UI Vue', '@headlessui/vue', 'Composants sans style, pensés pour Tailwind, version Vue.'),
      lib('Quasar', 'quasar', 'Composants Material, SPA, SSR, mobile et Electron avec une base.'),
      lib('Flowbite Vue', 'flowbite-vue', 'Composants Tailwind prêts à l’emploi, version Vue.'),
      lib('TDesign Vue', 'tdesign-vue-next', 'Design system Tencent : dense, soigné, Vue 3.'),
      lib('Arco Design Vue', '@arco-design/web-vue', 'Design system ByteDance, clair/sombre, Vue 3.'),
      lib('Vant', 'vant', 'Composants mobiles Vue, gestes et layouts 375 px.'),
      lib('Varlet', '@varlet/ui', 'Material You pour Vue 3, mobile first, léger.'),
      lib('Vuestic UI', 'vuestic-ui', 'Composants Vue pour dashboards, accessible, thème configurable.'),
      lib('Lucide Vue', 'lucide-vue-next', 'Icônes vectorielles Lucide en composants Vue.'),
      lib('Iconify Vue', '@iconify/vue', 'Un composant Vue, des milliers de sets d’icônes.'),
      lib('Floating Vue', 'floating-vue', 'Tooltips, dropdowns et popovers positionnés, Vue 3.'),
      lib('Vue Sonner', 'vue-sonner', 'Toasts empilables façon Sonner, pour Vue.'),
      lib('Vaul Vue', 'vaul-vue', 'Drawers façon iOS avec gestes, port Vue de Vaul.')
    ]
  },
  {
    id: 'landing', name: 'Design 2026',
    description: 'Landing, motion, shaders et registres shadcn : le polish visuel du moment.',
    items: [
      lib('Magic UI', 'magicui-cli', '150+ composants animés shadcn : marquee, bento, shine, beams.', true),
      lib('Aceternity UI', 'aceternity-ui', 'Effets 3D, spotlights, cartes lumineuses — le wow des landings SaaS.', true),
      lib('Motion Primitives', 'motion-primitives', 'CLI de composants animés soignés, au-dessus de Motion.', true),
      lib('Shadcnblocks', 'shadcnblocks', 'Blocs marketing shadcn : heroes, pricing, FAQ, social proof.', true),
      lib('Motion', 'motion', 'Le moteur d’animation 2026 (ex-Framer Motion) : layout, gestes, spring.'),
      lib('Paper Shaders', '@paper-design/shaders-react', 'Mesh gradients, grain, orbit — fonds génératifs Paper Design.'),
      lib('Shader Gradient', 'shadergradient', 'Dégradés WebGL animés, le fond de hero signature.'),
      lib('Animata', 'animata', 'Micro-animations CSS réutilisables, légères, copy-ready.'),
      lib('Assistant UI', '@assistant-ui/react', 'Chat IA soigné : bulles, tools, composer — le pattern 2026.'),
      lib('Fast Marquee', 'react-fast-marquee', 'Bandes logos et témoignages qui défilent, fluide.'),
      lib('Cobe', 'cobe', 'Globe WebGL minuscule, le hero « worldwide ».'),
      lib('Wrap Balancer', 'react-wrap-balancer', 'Titres équilibrés, plus de veuves sur les headlines.'),
      lib('Tailwind Variants', 'tailwind-variants', 'Variants typés, slots, merge — le CVA des kits 2026.'),
      lib('Tailwind Forms', '@tailwindcss/forms', 'Inputs reset, focus ring propre, base des formulaires soignés.', true),
      lib('Geist', 'geist', 'Typo Vercel : sans et mono, le défaut des produits 2026.', true),
      lib('React Tweet', 'react-tweet', 'Tweets embeddables, SSR-friendly, preuve sociale propre.'),
      lib('Mux Player', '@mux/mux-player-react', 'Player vidéo premium, posters, chapitres, design soigné.'),
      lib('Embla Autoplay', 'embla-carousel-autoplay', 'Carrousels qui avancent seuls, landings et logos.'),
      lib('Unpic', '@unpic/react', 'Images responsives, CDN-aware, nettes sur tous les breakpoints.'),
      lib('Iconoir', 'iconoir-react', 'Icônes trait fin, très 2026, cohérentes en petit.'),
      lib('Remix Icon', '@remixicon/react', 'Système d’icônes neutre, filled et line, pour le produit.'),
      lib('Hugeicons', '@hugeicons/react', 'Set immense, style product contemporain.')
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
      lib('Fontsource Geist', '@fontsource-variable/geist', 'Geist variable auto-hébergée, le sans des interfaces 2026.', true),
      lib('Fontsource Syne', '@fontsource-variable/syne', 'Syne variable : display un peu bizarre, titres de landing.', true),
      lib('Fontsource Outfit', '@fontsource-variable/outfit', 'Outfit variable : géométrique, friendly, pricing et UI.', true),
      lib('Fontsource Instrument Sans', '@fontsource-variable/instrument-sans', 'Instrument Sans : éditorial chaud, plus doux qu’Inter.', true),
      lib('Fontsource Playfair', '@fontsource-variable/playfair-display', 'Playfair Display : serif de luxe, split headlines.', true),
      lib('Fontsource DM Sans', '@fontsource-variable/dm-sans', 'DM Sans variable : lisible, startup, body et UI.', true),
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
      lib('Motion (Framer)', 'framer-motion', 'Ancien nom encore vu partout. Préfère le paquet « motion ».'),
      lib('Motion', 'motion', 'Le paquet actuel : mêmes APIs, layout animations, gestes, spring.'),
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
    id: 'auth', name: 'Authentification',
    description: 'Login, sessions, OAuth, passkeys, SSO et identity providers.',
    items: [
      lib('Better Auth', 'better-auth', 'Auth full-stack 2026 : email, OAuth, 2FA, organisations, plugins.'),
      lib('Better Auth Passkey', '@better-auth/passkey', 'Passkeys branchées sur Better Auth, WebAuthn sans la plomberie.'),
      lib('Better Auth SSO', '@better-auth/sso', 'SSO entreprise SAML/OIDC au-dessus de Better Auth.'),
      lib('Auth.js', 'next-auth', 'Sessions, OAuth, magic links — Next et Auth.js v4 encore partout.'),
      lib('Auth.js Core', '@auth/core', 'Noyau Auth.js v5, runtime-agnostic : Next, SvelteKit, Express.'),
      lib('Auth.js Prisma', '@auth/prisma-adapter', 'Adapter Prisma pour Auth.js : users, accounts, sessions, tokens.'),
      lib('Clerk', '@clerk/nextjs', 'Auth Next clé en main : UI, orgs, passkeys, middleware, B2B.'),
      lib('Clerk React', '@clerk/clerk-react', 'Composants Clerk pour Vite/React, hors Next.'),
      lib('Clerk Vue', '@clerk/vue', 'Clerk pour Vue 3 : SignIn, session, user, composables.'),
      lib('Clerk Nuxt', '@clerk/nuxt', 'Module Nuxt Clerk, middleware et auto-imports.'),
      lib('Auth0 Next', '@auth0/nextjs-auth0', 'SDK Auth0 v4 pour App Router : session, callback, RBAC.'),
      lib('Auth0 React', '@auth0/auth0-react', 'SPA Auth0 : loginWithRedirect, getAccessTokenSilently.'),
      lib('Auth0 Vue', '@auth0/auth0-vue', 'Plugin Vue Auth0, guards de route, tokens.'),
      lib('Supabase SSR', '@supabase/ssr', 'Cookies Auth Supabase pour Next/SvelteKit, plus de helpers dépréciés.'),
      lib('Firebase', 'firebase', 'Auth Google : email, phone, OAuth, anonymous, dans le client.'),
      lib('Firebase Admin', 'firebase-admin', 'Vérifie les ID tokens, custom claims, sessions serveur.'),
      lib('WorkOS AuthKit', '@workos-inc/authkit-nextjs', 'SSO, Directory Sync, Radar — auth B2B pour Next.'),
      lib('Stytch', '@stytch/nextjs', 'Passwordless : OTP, magic links, passkeys, sessions Next.'),
      lib('Kinde', '@kinde-oss/kinde-auth-nextjs', 'Auth + billing + feature flags, SDK Next App Router.'),
      lib('SuperTokens', 'supertokens-node', 'Sessions rotatives self-host, anti-csrf, recipes email/OAuth/passwordless.'),
      lib('SuperTokens React', 'supertokens-auth-react', 'UI SuperTokens : SignIn, reset, third-party, prebuilt ou headless.'),
      lib('Keycloak', 'keycloak-js', 'Adapter JS Keycloak : login, silent SSO, token refresh, rôles.'),
      lib('Ory Kratos', '@ory/kratos-client', 'Identity self-host : registration, recovery, settings, sessions.'),
      lib('Logto', '@logto/next', 'OIDC self-host ou cloud, orgs, RBAC, SDK Next.'),
      lib('Stack Auth', '@stackframe/stack', 'Auth open-source Next : dashboard, teams, comme Clerk en self-host.'),
      lib('Passport', 'passport', 'Le classique Node : stratégies local, JWT, Google, plus de 500 providers.'),
      lib('Passport JWT', 'passport-jwt', 'Bearer JWT pour les API Express, extracteurs header/cookie/query.'),
      lib('Remix Auth', 'remix-auth', 'Authenticator Remix : stratégies form, GitHub, sessions cookie.'),
      lib('Nuxt Auth Utils', 'nuxt-auth-utils', 'Sessions scellées, OAuth, hashed passwords — le kit Nuxt officiel.'),
      lib('sidebase Nuxt Auth', '@sidebase/nuxt-auth', 'Auth.js dans Nuxt : module, middleware, useAuth.'),
      lib('MSAL Browser', '@azure/msal-browser', 'Microsoft Entra ID / Azure AD dans le SPA, PKCE, popup ou redirect.'),
      lib('Okta Auth', '@okta/okta-auth-js', 'Okta OIDC/OAuth, tokens, PKCE, renew, pour SPA et Node.'),
      lib('Amplify Auth', 'aws-amplify', 'Cognito : signUp, MFA, Hosted UI, Identity Pools.'),
      lib('Magic', 'magic-sdk', 'Passwordless magic links et wallets, DID token.'),
      lib('Privy', '@privy-io/react-auth', 'Login email + wallets crypto, embedded wallets, React.'),
      lib('Convex Auth', '@convex-dev/auth', 'Auth native Convex : passwords, OAuth, OTP, tied to the backend.'),
      lib('Lucia', 'lucia', 'Sessions cookies, adapter DB — maintenu en mode freeze, encore vu.'),
      lib('Grant', 'grant', 'OAuth 1/2 pour Express, Fastify, Koa, 200+ providers.')
    ]
  },
  {
    id: '3d', name: '3D, canvas & jeux',
    description: 'Rendu temps réel, canvas 2D et helpers Three de base.',
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
    id: 'game3d', name: 'Jeu vidéo 3D',
    description: 'Moteurs, physique, IA, netcode et assets pour des jeux 3D dans le navigateur.',
    items: [
      lib('Babylon.js', '@babylonjs/core', 'Moteur 3D complet : scènes, PBR, animations, WebGPU, outillage jeu.'),
      lib('Havok', '@babylonjs/havok', 'Physique AAA de Microsoft, branchée sur Babylon : rigidbodies, constraints.'),
      lib('PlayCanvas', 'playcanvas', 'Moteur 3D web : éditeur, glTF, physique, lightmapping, runtime léger.'),
      lib('PlayCanvas React', '@playcanvas/react', 'PlayCanvas en composants React, scènes déclaratives.'),
      lib('Enable3D', 'enable3d', 'Couche jeu sur Three : physique Ammo, 3e personne, kit FPS.'),
      lib('A-Frame', 'aframe', 'VR/AR déclaratif en HTML, Three dessous, prototypes XR rapides.'),
      lib('TresJS', '@tresjs/core', 'Three.js en composants Vue, le R3F du camp Vue.'),
      lib('Threlte', '@threlte/core', 'Three.js en Svelte : scènes, studio, physique, XR.'),
      lib('Rapier 3D', '@dimforge/rapier3d-compat', 'Physique Rust/WASM : collisions, joints, CCD, sans R3F.'),
      lib('Cannon-es', 'cannon-es', 'Physique 3D JS, fork maintenu de cannon.js, véhicules et ragdoll.'),
      lib('Jolt Physics', 'jolt-physics', 'Physique WASM haute perf, traces, character controller.'),
      lib('Ecctrl', 'ecctrl', 'Contrôleur de perso 3e/1re personne pour R3F + Rapier.'),
      lib('Recast Navigation', '@recast-navigation/three', 'Navmesh : bakers, crowd, agents qui se frayent un chemin.'),
      lib('Three Pathfinding', 'three-pathfinding', 'Navigation sur navmesh glTF, léger, Don McCurdy.'),
      lib('Yuka', 'yuka', 'IA de jeu : steering, state machines, navmesh, perception.'),
      lib('Spine Three', '@esotericsoftware/spine-threejs', 'Squelettes 2D/3D Spine dans Three : persos animés runtime.'),
      lib('Quarks', 'three.quarks', 'Système de particules Three : GPU, trails, bursts, VFX de combat.'),
      lib('three-mesh-bvh', 'three-mesh-bvh', 'BVH : raycast et collisions mesh à coût de jeu, pas de démo.'),
      lib('camera-controls', 'camera-controls', 'Caméra orbit / FPS / truck, damping, bornes — le rig de production.'),
      lib('Troika Text', 'troika-three-text', 'Texte SDF dans la scène 3D, HUD, dégâts flottants, UI world-space.'),
      lib('Custom Shader Material', 'three-custom-shader-material', 'PBR Three + tes propres shaders, sans casser les lumières.'),
      lib('React Three XR', '@react-three/xr', 'Quest, WebXR, controllers et hands dans R3F.'),
      lib('React Three uikit', '@react-three/uikit', 'UI Yoga dans le world 3D : menus pause, inventaire, HUD spatial.'),
      lib('Colyseus', 'colyseus.js', 'Netcode rooms : état sync, clients web, multijoueur d’action.'),
      lib('geckos.io', '@geckos.io/client', 'UDP-like via WebRTC, ticks rapides, moins de lag que WebSocket.'),
      lib('bitECS', 'bitecs', 'ECS ultra-rapide, data-oriented, le socle d’un game loop JS.'),
      lib('Koota', 'koota', 'ECS pmndrs, pensé pour R3F : queries, actions, perf.'),
      lib('glTF Transform', '@gltf-transform/core', 'Optimise glTF : Draco, meshopt, textures, avant le runtime.'),
      lib('meshoptimizer', 'meshoptimizer', 'Simplification et compression de meshes, budgets GPU tenables.'),
      lib('TypeGPU', 'typegpu', 'WebGPU typé : compute shaders, particules GPU, rendu custom.'),
      lib('detect-gpu', 'detect-gpu', 'Bench GPU au lancement : quality tiers, ombres on/off.')
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
    description: 'Vidéo, images, PDF et capture. Le son a sa propre catégorie.',
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
    id: 'audio', name: 'Son & audio',
    description: 'Lecture, synthèse, spatialisation, analyse, MIDI et voix dans le navigateur.',
    items: [
      lib('Tone.js', 'tone', 'DAW dans le browser : synthés, effets, transport, timing musical.'),
      lib('use-sound', 'use-sound', 'Hook React pour Howler : SFX UI, sprites, volume, un clic.'),
      lib('WaveSurfer', 'wavesurfer.js', 'Forme d’onde interactive, régions, spectrogramme, podcasts.'),
      lib('Web Audio DAW', 'web-audio-daw', 'WAD : sons, micro, panner 3D, effets, sans graphe à la main.'),
      lib('Tuna', 'tunajs', 'Pédales Web Audio : reverb, delay, overdrive, chorus, cabinet.'),
      lib('Pizzicato', 'pizzicato', 'API simple au-dessus de Web Audio : play, effects, groupes.'),
      lib('standardized-audio-context', 'standardized-audio-context', 'AudioContext aligné, Safari et Chromium se comportent pareil.'),
      lib('unmute-ios-audio', 'unmute-ios-audio', 'Déverrouille l’audio iOS au premier geste, plus de silence fantôme.'),
      lib('Pixi Sound', '@pixi/sound', 'Audio pour PixiJS : sprites, filtres, filters, pool, jeux 2D.'),
      lib('Resonance Audio', 'resonance-audio', 'Audio spatial Google : salles, HRTF, occlusions, scènes 3D.'),
      lib('ZzFX', 'zzfx', 'SFX 8-bit en une fonction, zéro asset, parfait pour un jam game.'),
      lib('jsfxr', 'jsfxr', 'Générateur type sfxr : lasers, explosions, pickups, paramètres.'),
      lib('Meyda', 'meyda', 'Features audio temps réel : RMS, MFCC, centroïde, visus et ML.'),
      lib('Pitchy', 'pitchy', 'Détection de pitch YIN, accordeur, karaoké, jeux musicaux.'),
      lib('audioMotion', 'audiomotion-analyzer', 'Analyseur FFT spectaculaire, barres et octa, ready for HUD.'),
      lib('Tone MIDI', '@tonejs/midi', 'Parse et écris des fichiers MIDI, tracks, PPQ, vélocités.'),
      lib('WebMidi', 'webmidi', 'Claviers et contrôleurs MIDI dans le browser, in/out, clock.'),
      lib('Tonal', 'tonal', 'Théorie musicale JS : notes, gammes, accords, progressions.'),
      lib('Soundfont Player', 'soundfont-player', 'Pianos et orchestres GM via soundfonts, preview MIDI.'),
      lib('VexFlow', 'vexflow', 'Partition gravée en SVG/canvas, notation classique à l’écran.'),
      lib('NexusUI', 'nexusui', 'Widgets musicaux : pads, sliders, sequencers, branchés Web Audio.'),
      lib('RecordRTC', 'recordrtc', 'Capture micro/écran en wav, mp3, opus, stereo, timeslice.'),
      lib('audio-decode', 'audio-decode', 'Décode mp3, ogg, flac, wav en AudioBuffer, sans <audio>.'),
      lib('SoundTouch', 'soundtouchjs', 'Time-stretch et pitch-shift, karaoké et DJ, en temps réel.'),
      lib('Mediabunny', 'mediabunny', 'Mux/demux audio-vidéo moderne, samples, containers, browser.'),
      lib('ElevenLabs', 'elevenlabs', 'TTS et voices cloning, streaming, pour PNJ et assistants.'),
      lib('VAD', '@ricky0123/vad-web', 'Voice activity detection on-device, coupe le silence avant le STT.'),
      lib('Kokoro', 'kokoro-js', 'Synthèse vocale locale, WASM, sans envoyer la voix au cloud.'),
      lib('Hark', 'hark', 'Détecte qui parle sur un MediaStream, mute auto, vocaux live.'),
      lib('React H5 Audio', 'react-h5-audio-player', 'Lecteur audio React complet : playlist, progress, volume.')
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
    id: 'security', name: 'Sécurité',
    description: 'Headers, bots, secrets, XSS, authz et durcissement d’application.',
    items: [
      lib('Helmet', 'helmet', 'En-têtes HTTP : CSP, HSTS, X-Frame, nosniff — la base Node.'),
      lib('next-safe', 'next-safe', 'Headers de sécurité pour Next : CSP, Referrer, Permissions-Policy.'),
      lib('Nuxt Security', 'nuxt-security', 'Module Nuxt : CSP, CORS, rate limit, request size, XSS.'),
      lib('Arcjet', '@arcjet/node', 'Bot, WAF, rate limit et e-mail validation, au plus près du handler.'),
      lib('BotID', 'botid', 'Protection anti-bot Vercel, invisible, pour Next et les Server Actions.'),
      lib('CORS', 'cors', 'Origines autorisées, credentials, preflight — à configurer, pas à oublier.'),
      lib('Upstash Ratelimit', '@upstash/ratelimit', 'Limite de débit Redis, sliding window, multi-région.'),
      lib('Rate Limiter Flexible', 'rate-limiter-flexible', 'Brute-force, login, API : compteurs en mémoire, Redis ou Prisma.'),
      lib('csrf-csrf', 'csrf-csrf', 'Jetons CSRF double-submit, sessions ou cookies, Edge-friendly.'),
      lib('jose', 'jose', 'JWT, JWE, JWK : signatures et chiffrement, Edge et Node.'),
      lib('iron-session', 'iron-session', 'Sessions chiffrées en cookie, sans base, pour Next et Node.'),
      lib('Argon2', 'argon2', 'Hash de mots de passe actuel, gagnant du concours PHC.'),
      lib('otplib', 'otplib', 'TOTP / HOTP : 2FA, Authenticator, secrets et fenêtres.'),
      lib('zxcvbn', '@zxcvbn-ts/core', 'Force du mot de passe au clavier, messages utiles, pas un simple compteur.'),
      lib('sanitize-html', 'sanitize-html', 'HTML autorisé seulement : XSS des champs riches et des CMS.'),
      lib('validator', 'validator', 'E-mails, URL, UUID, échappement : validations de chaînes côté serveur.'),
      lib('T3 Env', '@t3-oss/env-core', 'Variables d’environnement typées, fail-fast au boot si un secret manque.'),
      lib('dotenvx', '@dotenvx/dotenvx', 'Secrets chiffrés dans .env, rotation, pas de secrets en clair dans Git.', true),
      lib('CASL', '@casl/ability', 'Autorisation : qui peut quoi, sur quel sujet, UI et API.'),
      lib('Casbin', 'casbin', 'ACL, RBAC, ABAC : moteur de politiques, modèles et adaptateurs.'),
      lib('server-only', 'server-only', 'Empêche d’importer du code serveur dans le client — secrets, ORM, clés.'),
      lib('Turnstile', '@marsidev/react-turnstile', 'Captcha Cloudflare, discret, sans puzzle pour l’humain.'),
      lib('FingerprintJS', '@fingerprintjs/fingerprintjs', 'Empreinte navigateur, fraude et multi-comptes, open source.'),
      lib('ESLint Security', 'eslint-plugin-security', 'Règles ESLint : eval, regex DoS, enfant process, secrets dans le code.', true),
      lib('audit-ci', 'audit-ci', 'Bloque le CI si npm audit dépasse un seuil, avant la prod.', true),
      lib('SimpleWebAuthn', '@simplewebauthn/server', 'Passkeys / WebAuthn côté serveur : attestation, origin, counters.'),
      lib('SimpleWebAuthn Browser', '@simplewebauthn/browser', 'Passkeys dans le navigateur : create, get, JSON safe, autofill.'),
      lib('oauth4webapi', 'oauth4webapi', 'OAuth 2.1 et OIDC bas niveau : PKCE, DPoP, sans magie Passport.'),
      lib('openid-client', 'openid-client', 'Client OIDC certifié : code flow, discovery, userinfo, refresh.'),
      lib('Arctic', 'arctic', 'OAuth d’Oslo : Google, GitHub, Apple, PKCE, pour Better Auth et Lucia.'),
      lib('libsodium', 'libsodium-wrappers', 'Crypto NaCl : box, secretbox, sign, generichash, WASM.'),
      lib('Noble Hashes', '@noble/hashes', 'SHA, BLAKE, HMAC, HKDF audités, zéro native, Edge-friendly.'),
      lib('Oslo Crypto', '@oslojs/crypto', 'HMAC, SHA, ECDSA, random — la base crypto d’Oslo / Lucia.'),
      lib('secure-json-parse', 'secure-json-parse', 'JSON.parse sans prototype pollution (__proto__, constructor).'),
      lib('HPP', 'hpp', 'HTTP Parameter Pollution : un paramètre, une valeur, Express.'),
      lib('mongo-sanitize', 'express-mongo-sanitize', 'Coupe les $ et les . dans le body, query, params — NoSQL injection.'),
      lib('xss', 'xss', 'Filtre XSS whitelist, pour le HTML qui n’a pas le droit de DOMPurify.'),
      lib('sanitize-filename', 'sanitize-filename', 'Noms de fichiers uploadés : plus de ../ ni de null bytes.'),
      lib('file-type', 'file-type', 'Magic bytes, pas l’extension : un .png qui est un .exe ne passe pas.'),
      lib('request-filtering-agent', 'request-filtering-agent', 'SSRF : bloque les IP privées, localhost, link-local sur fetch/http.'),
      lib('csp-header', 'csp-header', 'Construit une Content-Security-Policy lisible, nonces, hashes.'),
      lib('express-rate-limit', 'express-rate-limit', 'Rate limit Express officiel, stores Redis, IPv6, skip successful.'),
      lib('express-slow-down', 'express-slow-down', 'Ralentit avant de couper : brute-force login sans 429 immédiat.'),
      lib('fast-redact', 'fast-redact', 'Masque PII dans les logs JSON, paths, wildcards, très rapide.'),
      lib('Arcjet Redact', '@arcjet/redact', 'Détecte et masque cartes, e-mails, tél. dans le texte et les prompts.'),
      lib('Arcjet Guard', '@arcjet/guard', 'Sécurise les tools d’agents IA : injection de prompt, PII, rate limit.'),
      lib('Arcjet Next', '@arcjet/next', 'Arcjet branché sur Next : middleware, App Router, Server Actions.'),
      lib('Samlify', 'samlify', 'SAML 2.0 IdP/SP, métadonnées, signatures, SSO entreprise.'),
      lib('OTPAuth', 'otpauth', 'TOTP/HOTP + URI otpauth, QR, RFC 6238, pour brancher Authenticator.'),
      lib('rehype-sanitize', 'rehype-sanitize', 'Sanitize le HTML issu du Markdown, schema hast, XSS des README.'),
      lib('Infisical', '@infisical/sdk', 'Coffre de secrets d’équipe, injection runtime, rotation, self-host.'),
      lib('secretlint', 'secretlint', 'Empêche de commit une clé API, un PEM, un .env — pre-commit et CI.', true),
      lib('lockfile-lint', 'lockfile-lint', 'Lockfile : HTTPS only, pas d’URL git, intégrité, supply chain.', true),
      lib('Socket CLI', '@socketsecurity/cli', 'Scan supply chain : malware npm, typosquats, scripts postinstall.', true),
      lib('better-npm-audit', 'better-npm-audit', 'npm audit actionnable, exemptions, fail le build sur CVSS.', true),
      lib('ESLint no-secrets', 'eslint-plugin-no-secrets', 'Entropie dans le source : tokens collés dans le JS, avant le push.', true),
      lib('Anti-Trojan Source', 'eslint-plugin-anti-trojan-source', 'Bidi / homoglyphes invisibles dans le code, attaque Trojan Source.', true)
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
  },
  database: {
    defaultId: 'none'
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
        database: { ...DEFAULTS.database, ...(parsed.database || {}) },
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
