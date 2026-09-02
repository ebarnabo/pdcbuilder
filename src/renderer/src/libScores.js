/** Notations par défaut pour les librairies du catalogue (affichage dans le picker). */

const BASE = {
  perf: { n: 4, note: 'Léger et courant dans l’écosystème.' },
  free: { n: 5, note: 'OSS, zéro licence.' },
  paid: { n: 2, note: 'Tu paies surtout l’hébergeur ou l’API.' },
  exit: { n: 2, note: 'Tu peux partir sans tout casser.' }
}

const HEAVY = {
  perf: { n: 2, note: 'Kit complet : bundle plus lourd.' },
  free: { n: 5, note: 'OSS.' },
  paid: { n: 3, note: 'Extensions pro ou cloud selon le fournisseur.' },
  exit: { n: 3, note: 'Migration possible mais coûteuse.' }
}

const SAAS = {
  perf: { n: 4, note: 'Le SDK est léger, le service est distant.' },
  free: { n: 3, note: 'Palier gratuit souvent limité.' },
  paid: { n: 4, note: 'Facturation au volume ou aux sièges.' },
  exit: { n: 4, note: 'Tu quittes tôt le gratuit si ça scale.' }
}

const DEV = {
  perf: { n: 5, note: 'Hors bundle prod.' },
  free: { n: 5, note: 'Outil de build, pas de runtime.' },
  paid: { n: 1, note: 'Rien à payer côté lib.' },
  exit: { n: 1, note: 'Tu retires la dépendance dev.' }
}

const OVERRIDES = {
  tailwindcss: DEV,
  shadcn: DEV,
  zod: { ...BASE, perf: { n: 5, note: 'Schémas légers, zéro runtime.' } },
  zustand: { ...BASE, perf: { n: 5, note: 'Store minuscule, peu de re-rendus.' } },
  '@tanstack/react-query': { ...BASE, perf: { n: 5, note: 'Cache réseau sans boilerplate.' } },
  motion: { ...BASE, perf: { n: 4, note: 'Animations GPU-friendly.' } },
  gsap: { ...BASE, perf: { n: 4, note: 'Timeline pro, bundle modéré.' } },
  three: { ...BASE, perf: { n: 3, note: 'WebGL : puissant, pas gratuit en perf.' } },
  '@mui/material': HEAVY,
  antd: HEAVY,
  '@mantine/core': HEAVY,
  primereact: HEAVY,
  '@fluentui/react-components': HEAVY,
  '@clerk/nextjs': SAAS,
  '@clerk/clerk-react': SAAS,
  '@auth0/nextjs-auth0': SAAS,
  '@auth0/auth0-react': SAAS,
  stripe: SAAS,
  firebase: SAAS,
  '@supabase/supabase-js': { ...BASE, free: { n: 4, note: 'Palier gratuit généreux.' }, paid: { n: 3, note: 'Tu paies Postgres et bande passante.' } },
  prisma: { ...BASE, perf: { n: 3, note: 'ORM complet, génération et migrations.' } },
  'better-auth': { ...BASE, free: { n: 5, note: 'Self-host, pas de taxe auth.' } },
  lenis: { ...BASE, perf: { n: 5, note: 'Scroll lissé, impact faible.' } }
}

const HEAVY_RE = /^@mui\/|antd$|primereact|@fluentui|@blueprintjs|@arco-design|tdesign-|@douyinfe|quasar$|vuetify|element-plus/
const SAAS_RE = /^@clerk\/|@auth0\/|@stytch\/|@kinde-oss\/|@workos-inc\/|^stripe$|^firebase$|^firebase-admin$|@privy-io\//
const DEV_RE = /-cli$|tailwindcss|postcss|eslint|prettier|drizzle-kit|^prisma$/

export function libScores(item) {
  if (item?.scores) return item.scores
  const pkg = item?.pkg || ''
  if (OVERRIDES[pkg]) return OVERRIDES[pkg]
  if (item?.dev || DEV_RE.test(pkg)) return DEV
  if (SAAS_RE.test(pkg)) return SAAS
  if (HEAVY_RE.test(pkg)) return HEAVY
  return BASE
}
