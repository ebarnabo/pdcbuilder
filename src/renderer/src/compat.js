/** Famille d’un framework : react | vue | svelte | vanilla | astro */
const FAMILY_BY_ID = {
  'vite-react': 'react',
  next: 'react',
  'electron-react': 'react',
  'vite-vue': 'vue',
  nuxt: 'vue',
  'vite-svelte': 'svelte',
  sveltekit: 'svelte',
  'vite-vanilla': 'vanilla',
  astro: 'astro'
}

/** Catégories surtout React : on exige une preuve de compatibilité, pas « any » par défaut. */
const REACT_LEANING_CATS = new Set(['landing', 'design', 'motion', 'ui'])

export function familyOf(fw) {
  if (!fw) return 'vanilla'
  if (fw.family) return fw.family
  const tag = String(fw.tag || '').toLowerCase()
  if (tag.includes('react')) return 'react'
  if (tag.includes('vue')) return 'vue'
  if (tag.includes('svelte')) return 'svelte'
  if (tag.includes('astro') || tag.includes('contenu')) return 'astro'
  return FAMILY_BY_ID[fw.id] || 'vanilla'
}

function isNextOnly(pkg) {
  const p = String(pkg || '').toLowerCase()
  return /^(next-seo|next-sitemap|next-intl|next-safe|next-auth|next-view-transitions)$/.test(p)
    || /nextjs|\/next$|\/next-|authkit-nextjs|kinde-auth-nextjs|@stytch\/nextjs|@logto\/next|fumadocs|@arcjet\/next|^botid$|@stackframe\/stack/.test(p)
    || /@clerk\/nextjs|@auth0\/nextjs|@workos-inc\/authkit-nextjs|@kinde-oss\/kinde-auth-nextjs/.test(p)
}

function isNuxtOnly(pkg) {
  return /nuxt|@nuxt\/|@sidebase\/nuxt|@clerk\/nuxt/.test(pkg)
}

function isReactPkg(pkg) {
  const p = String(pkg || '').toLowerCase()
  if (/(^|[-/@])react($|[-/])|react-dom/.test(p)) return true
  return /@radix-ui|@base-ui\/|@dnd-kit|@heroui|@mui\/|@mantine|^antd$|primereact|@ark-ui\/react|@ariakit|flowbite-react|@fluentui|@shopify\/polaris|@blueprintjs|tdesign-react|@arco-design\/web-react|^rsuite$|@douyinfe|tamagui|@ionic\/react|park-ui|@gluestack|evergreen-ui|magicui|aceternity|shadcnblocks|motion-primitives|framer-motion|(^|\/)motion$|@emotion|styled-components|@chakra-ui|@paper-design|@assistant-ui|@mux\/mux-player-react|@unpic\/react|iconoir-react|@remixicon\/react|@hugeicons|@phosphor-icons\/react|@tabler\/icons-react|@iconify\/react|@number-flow\/react|@lottiefiles\/dotlottie-react|@splinetool\/react-spline|@rive-app\/react-canvas|@react-spring|@gsap\/react|@use-gesture\/react|@tsparticles\/react|@tanstack\/react|@reduxjs|@xstate\/react|@hookform|@uploadthing\/react|@testing-library\/react|@sentry\/react|@ai-sdk\/react|@monaco-editor\/react|@mdx-js\/react|@tiptap\/react|@marsidev\/react-turnstile|@floating-ui\/react|@react-three|@clerk\/clerk-react|@auth0\/auth0-react|supertokens-auth-react|@privy-io\/react-auth|@playcanvas\/react|^vaul$|^sonner$|^cmdk$|^shadcn$|^input-otp$|^geist$|embla-carousel-react|echarts-for-react|@tremor\/react|react-fast-marquee|react-wrap-balancer|react-tweet|react-day-picker|react-error-boundary|react-resizable-panels|react-dropzone|react-hook-form|react-countup|react-intersection-observer|react-awesome-reveal|react-scroll-parallax|react-transition-group|react-flip-toolkit|next-themes/.test(p)
}

function isVuePkg(pkg) {
  const p = String(pkg || '').toLowerCase()
  if (/(^|[-/@])vue($|[-/])/.test(p)) return true
  return /reka-ui|shadcn-vue|naive-ui|element-plus|vuetify|primevue|ant-design-vue|quasar|flowbite-vue|tdesign-vue|@arco-design\/web-vue|^vant$|@varlet|vuestic|vaul-vue|@tresjs|@clerk\/vue|@auth0\/auth0-vue|@iconify\/vue|@headlessui\/vue|floating-vue|vue-sonner|lucide-vue/.test(p)
}

function isSveltePkg(pkg) {
  return /svelte|@threlte|@sveltejs/.test(pkg)
}

/** Paquets utilisables partout (vanilla, astro, tous frameworks). */
function isUniversalPkg(pkg) {
  const p = String(pkg || '').toLowerCase()
  return /^(zod|valibot|axios|ky|gsap|lenis|animejs|matter-js|swiper|typed\.js|split-type|popmotion|bezier-easing|chroma-js|three|postcss|autoprefixer|dotenv|date-fns|dayjs|lodash|uuid|nanoid|clsx|zustand|jotai|idb-keyval|graphql-request|stripe|resend|hono|@trpc\/|drizzle-orm|@supabase\/supabase-js|firebase-admin|passport|better-auth|@better-auth\/|prisma|drizzle-kit)$/.test(p)
    || /^@fontsource|tailwind-|tw-animate|simple-icons$/.test(p)
    || /^@tanstack\/(query|virtual|form)$/.test(p)
}

/** Catégories réservées à une famille de frameworks. */
const CAT_SCOPE = {
  react: new Set(['react', 'next', 'electron-react']),
  vue: new Set(['vue', 'nuxt']),
  svelte: new Set(['svelte', 'sveltekit'])
}

const COMPAT_LABELS = {
  any: 'Universel',
  react: 'React',
  vue: 'Vue',
  svelte: 'Svelte',
  next: 'Next.js',
  nuxt: 'Nuxt',
  vanilla: 'Vanilla',
  astro: 'Astro'
}

function categoryVisible(catId, fw) {
  if (!CAT_SCOPE[catId]) return true
  if (!fw) return false
  const family = familyOf(fw)
  if (CAT_SCOPE[catId].has(fw.id)) return true
  if (catId === 'react' && family === 'react') return true
  if (catId === 'vue' && family === 'vue') return true
  if (catId === 'svelte' && family === 'svelte') return true
  return false
}

export function compatibilityTags(item) {
  return item.for?.length ? item.for : inferFor(item.pkg, item.categoryId)
}

export function compatibilityBadge(item, fw) {
  const tags = compatibilityTags(item)
  const family = familyOf(fw)
  if (tags.includes('any') || tags.includes('*')) {
    return { text: COMPAT_LABELS.any, tone: 'universal' }
  }
  if (fw?.id === 'next' && tags.includes('next')) {
    return { text: COMPAT_LABELS.next, tone: 'match' }
  }
  if (fw?.id === 'nuxt' && tags.includes('nuxt')) {
    return { text: COMPAT_LABELS.nuxt, tone: 'match' }
  }
  if (family && tags.includes(family)) {
    return { text: COMPAT_LABELS[family] || family, tone: 'match' }
  }
  const label = tags.map((t) => COMPAT_LABELS[t] || t).join(' · ')
  return { text: label, tone: 'other' }
}

export function countCatalogLibraries(libraries) {
  const seen = new Set()
  let n = 0
  for (const cat of libraries || []) {
    for (const item of cat.items || []) {
      if (seen.has(item.pkg)) continue
      seen.add(item.pkg)
      n += 1
    }
  }
  return n
}

export function inferFor(pkg, categoryId) {
  const p = String(pkg || '').toLowerCase()
  if (categoryId === 'react') return ['react']
  if (categoryId === 'vue') return ['vue']
  if (categoryId === 'svelte') return ['svelte']
  if (categoryId === 'ui') {
    if (isVuePkg(p)) return ['vue']
    if (isReactPkg(p) || /class-variance|cva|cmdk|vaul|sonner|embla-carousel|floating-ui\/react|input-otp|next-themes|react-day-picker|react-error-boundary|react-resizable|@dnd-kit|shadcn/.test(p)) {
      return ['react']
    }
    if (isUniversalPkg(p)) return ['any']
    return ['react']
  }
  if (isUniversalPkg(p)) return ['any']
  if (isNuxtOnly(p)) return ['nuxt']
  if (isNextOnly(p)) return ['next']
  if (isSveltePkg(p)) return ['svelte']
  if (isVuePkg(p)) return ['vue']
  if (isReactPkg(p)) return ['react']
  if (REACT_LEANING_CATS.has(categoryId)) return ['react']
  return ['any']
}

export function libFits(item, fw) {
  if (!fw) return false
  const tags = compatibilityTags(item)
  if (tags.includes('any') || tags.includes('*')) return true
  if (tags.includes(fw.id)) return true
  const family = familyOf(fw)
  if (tags.includes(family)) return true
  if (tags.includes('next') && fw.id === 'next') return true
  if (tags.includes('nuxt') && fw.id === 'nuxt') return true
  return false
}

function dedupeCategories(categories) {
  const seen = new Set()
  return categories.map((cat) => ({
    ...cat,
    items: (cat.items || []).filter((item) => {
      if (seen.has(item.pkg)) return false
      seen.add(item.pkg)
      return true
    })
  })).filter((cat) => cat.items.length)
}

export function librariesFor(libraries, fw) {
  if (!fw) return []
  const cats = (libraries || [])
    .filter((cat) => categoryVisible(cat.id, fw))
    .map((cat) => ({
      ...cat,
      items: (cat.items || [])
        .map((item) => ({
          ...item,
          categoryId: cat.id,
          for: item.for?.length ? item.for : inferFor(item.pkg, cat.id)
        }))
        .filter((item) => libFits(item, fw))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    }))
    .filter((cat) => cat.items.length)

  return dedupeCategories(cats)
}

export function keepCompatible(pkgs, libraries, fw) {
  const items = (libraries || []).flatMap((c) => (c.items || []).map((i) => ({ ...i, categoryId: c.id })))
  const byPkg = Object.fromEntries(items.map((i) => [i.pkg, i]))
  return (pkgs || []).filter((pkg) => {
    const item = byPkg[pkg]
    if (!item) return false
    return libFits({ ...item, for: item.for || inferFor(item.pkg, item.categoryId) }, fw)
  })
}

export function filterLibraryItems(categories, query) {
  const q = query.trim().toLowerCase()
  if (!q) return categories
  return categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((i) =>
        i.name.toLowerCase().includes(q)
        || i.pkg.toLowerCase().includes(q)
        || (i.description || '').toLowerCase().includes(q)
      )
    }))
    .filter((cat) => cat.items.length)
}
