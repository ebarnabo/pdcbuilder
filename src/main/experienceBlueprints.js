/**
 * Blueprints orientés expérience — intention produit, pas seulement stack.
 * Chaque base embarque : brief, tokens, structure de pages, libs alignées.
 */

const file = (path, content) => ({ path, content: content.trimStart() })

const TOKENS_LANDING = file('src/styles/tokens.css', `
/* Tokens — Landing luxe (PDC Builder) */
:root {
  --xp-bg: #0f0e0c;
  --xp-surface: #1a1814;
  --xp-ink: #f5efe6;
  --xp-muted: #a89f91;
  --xp-accent: #c4a574;
  --xp-accent-2: #e8d5b5;
  --xp-line: rgba(245, 239, 230, 0.12);
  --xp-radius: 4px;
  --xp-font-display: "Fraunces", "Iowan Old Style", Georgia, serif;
  --xp-font-body: "Söhne", "Helvetica Neue", system-ui, sans-serif;
  --xp-space: 8px;
  --xp-hero-min: 100svh;
}
`)

const TOKENS_DASH = file('src/styles/tokens.css', `
/* Tokens — Dashboard dense */
:root {
  --xp-bg: #111214;
  --xp-surface: #181a1f;
  --xp-ink: #eef0f4;
  --xp-muted: #8b929e;
  --xp-accent: #5b8def;
  --xp-ok: #3dba8a;
  --xp-warn: #e6a23c;
  --xp-line: rgba(238, 240, 244, 0.1);
  --xp-radius: 10px;
  --xp-font: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --xp-mono: "IBM Plex Mono", ui-monospace, monospace;
  --xp-sidebar: 240px;
  --xp-row: 36px;
}
`)

const TOKENS_SAAS = file('src/styles/tokens.css', `
/* Tokens — SaaS marketing */
:root {
  --xp-bg: #faf9f7;
  --xp-ink: #1a1917;
  --xp-muted: #6b6560;
  --xp-accent: #1f6feb;
  --xp-surface: #ffffff;
  --xp-line: rgba(26, 25, 23, 0.1);
  --xp-radius: 14px;
  --xp-font: "Inter Tight", "Segoe UI", system-ui, sans-serif;
  --xp-max: 1120px;
}
`)

const TOKENS_PORTFOLIO = file('src/styles/tokens.css', `
/* Tokens — Portfolio éditorial */
:root {
  --xp-bg: #f3efe8;
  --xp-ink: #161412;
  --xp-muted: #6e675e;
  --xp-accent: #8c3b2a;
  --xp-line: rgba(22, 20, 18, 0.12);
  --xp-radius: 0;
  --xp-font-display: "Newsreader", Georgia, serif;
  --xp-font-body: "Source Sans 3", system-ui, sans-serif;
  --xp-measure: 68ch;
}
`)

const TOKENS_INTERNAL = file('src/styles/tokens.css', `
/* Tokens — Outil interne */
:root {
  --xp-bg: #f4f5f7;
  --xp-ink: #1c1f26;
  --xp-muted: #5c6573;
  --xp-accent: #2563eb;
  --xp-surface: #ffffff;
  --xp-line: #dde1e8;
  --xp-radius: 8px;
  --xp-font: "Segoe UI", system-ui, sans-serif;
  --xp-density: compact;
}
`)

const TOKENS_SHOP = file('src/styles/tokens.css', `
/* Tokens — E-commerce vitrine */
:root {
  --xp-bg: #ffffff;
  --xp-ink: #121212;
  --xp-muted: #6a6a6a;
  --xp-accent: #111111;
  --xp-soft: #f6f4f1;
  --xp-line: #e8e4de;
  --xp-radius: 12px;
  --xp-font: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --xp-product: 1 / 1.25;
}
`)

const TOKENS_ONBOARD = file('src/styles/tokens.css', `
/* Tokens — Onboarding produit */
:root {
  --xp-bg: #0c0d10;
  --xp-surface: #16181e;
  --xp-ink: #f2f3f7;
  --xp-muted: #9aa0ad;
  --xp-accent: #7c6cf0;
  --xp-ok: #34d399;
  --xp-line: rgba(242, 243, 247, 0.1);
  --xp-radius: 16px;
  --xp-font: "Geist", "Segoe UI", system-ui, sans-serif;
  --xp-step: 3;
}
`)

const TOKENS_BLOG = file('src/styles/tokens.css', `
/* Tokens — Blog / lecture */
:root {
  --xp-bg: #fcfbf8;
  --xp-ink: #1c1917;
  --xp-muted: #78716c;
  --xp-accent: #0f766e;
  --xp-line: #e7e5e4;
  --xp-radius: 6px;
  --xp-font-display: "Literata", Georgia, serif;
  --xp-font-body: "Source Serif 4", Georgia, serif;
  --xp-measure: 65ch;
  --xp-leading: 1.7;
}
`)

function briefMd({ title, intent, audience, promise, vibe, sections }) {
  return file('EXPERIENCE.md', `
# ${title}

> Brief généré par PDC Builder — à lire avant de coder l’UI.

## Intention
${intent}

## Public
${audience}

## Promesse
${promise}

## Ambiance
${vibe}

## Structure proposée
${sections.map((s, i) => `${i + 1}. **${s.name}** — ${s.why}`).join('\n')}

## Garde-fous design
- Un focus évident par écran ; le reste en soutien.
- Pas de cards décoratives sans interaction.
- Contraste et focus clavier dès le premier jet.
- Tokens dans \`src/styles/tokens.css\` — étendre, ne pas remplacer au hasard.

## Pour les agents IA
Respecte ce brief. Propose des fichiers avec \`path=\`. Préfère les composants listés dans la structure.
`)
}

function appShell(importsExtra, body) {
  return file('src/App.tsx', `
import './styles/tokens.css'
${importsExtra}

export default function App() {
  return (
${body}
  )
}
`)
}

export const EXPERIENCE_CATEGORIES = [
  { id: 'marketing', label: 'Marketing', hint: 'Conversion, récit, première impression' },
  { id: 'product', label: 'Produit', hint: 'Usage quotidien, rétention, clarté' },
  { id: 'content', label: 'Contenu', hint: 'Lecture, éditorial, portfolio' },
  { id: 'commerce', label: 'Commerce', hint: 'Catalogue, confiance, achat' },
  { id: 'ops', label: 'Opérations', hint: 'Outils internes, densité, efficacité' }
]

/**
 * @type {Array<object>}
 */
export const DEFAULT_EXPERIENCE_BLUEPRINTS = [
  {
    id: 'xp-landing-luxe',
    builtin: true,
    kind: 'experience',
    category: 'marketing',
    name: 'Landing luxe',
    tagline: 'Première impression cinématographique',
    description: 'Hero plein écran, typo expressive, une promesse, un CTA. Pour marques premium et lancements soignés.',
    intent: 'Convaincre en 5 secondes que le produit mérite l’attention — sans dashboard ni stats dans le fold.',
    audience: 'Prospects froids / presse / investisseurs qui jugent d’abord l’esthétique.',
    promise: 'Une page qui sent le soin : rythme généreux, image dominante, zéro clutter.',
    vibe: 'Sombre chaud, serif de display, accent champagne, motion sobre.',
    frameworkId: 'vite-react',
    databaseId: 'none',
    themes: ['landing', 'vitrine'],
    libs: ['tailwindcss', 'motion', 'lucide-react', 'lenis'],
    commands: [],
    files: [
      briefMd({
        title: 'Landing luxe',
        intent: 'Convaincre en 5 secondes que le produit mérite l’attention.',
        audience: 'Prospects froids, presse, investisseurs.',
        promise: 'Une page qui sent le soin : rythme généreux, image dominante.',
        vibe: 'Sombre chaud, serif, accent champagne.',
        sections: [
          { name: 'Hero plein écran', why: 'marque + une phrase + CTA unique' },
          { name: 'Preuve', why: 'une image produit ou atmosphère, pas un collage' },
          { name: 'Récit', why: '3 moments max, une idée chacun' },
          { name: 'CTA final', why: 'même action que le hero' }
        ]
      }),
      TOKENS_LANDING,
      appShell('', `    <div style={{ minHeight: 'var(--xp-hero-min)', background: 'var(--xp-bg)', color: 'var(--xp-ink)', fontFamily: 'var(--xp-font-body)' }}>
      <header style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontFamily: 'var(--xp-font-display)', fontSize: 22, letterSpacing: '-0.02em' }}>Marque</strong>
        <a href="#cta" style={{ color: 'var(--xp-accent)', textDecoration: 'none', fontWeight: 600 }}>Demander l’accès</a>
      </header>
      <main style={{ padding: '12vh 32px 64px', maxWidth: 920 }}>
        <p style={{ color: 'var(--xp-muted)', fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Lancement</p>
        <h1 style={{ fontFamily: 'var(--xp-font-display)', fontSize: 'clamp(40px, 8vw, 72px)', lineHeight: 1.05, fontWeight: 500, margin: '0 0 20px', letterSpacing: '-0.03em' }}>
          Une présence qui se sent avant de se lire.
        </h1>
        <p style={{ color: 'var(--xp-muted)', fontSize: 18, maxWidth: '36ch', lineHeight: 1.5, margin: '0 0 32px' }}>
          Remplace ce texte par ta promesse. Un seul CTA. Pas de pastilles ni de stats ici.
        </p>
        <a id="cta" href="#" style={{ display: 'inline-block', background: 'var(--xp-accent)', color: '#2a1f12', padding: '14px 22px', borderRadius: 'var(--xp-radius)', fontWeight: 650, textDecoration: 'none' }}>
          Commencer
        </a>
      </main>
    </div>`)
    ]
  },
  {
    id: 'xp-saas-marketing',
    builtin: true,
    kind: 'experience',
    category: 'marketing',
    name: 'SaaS marketing',
    tagline: 'Clarté produit + conversion',
    description: 'Page marketing pour un outil B2B : problème, solution, pricing soft, preuve sociale discrète.',
    intent: 'Faire comprendre la valeur en une visite et pousser vers l’essai.',
    audience: 'Décideurs et ops qui comparent 3 outils le même après-midi.',
    promise: 'Structure lisible, sections nettes, CTA répété sans bruit.',
    vibe: 'Clair, moderne, accent bleu franc, beaucoup d’air.',
    frameworkId: 'vite-react',
    databaseId: 'none',
    themes: ['saas', 'landing'],
    libs: ['tailwindcss', 'lucide-react', 'clsx'],
    commands: [],
    files: [
      briefMd({
        title: 'SaaS marketing',
        intent: 'Faire comprendre la valeur et pousser vers l’essai.',
        audience: 'Décideurs et ops en mode comparaison.',
        promise: 'Structure lisible, CTA clair, zéro clutter.',
        vibe: 'Clair, moderne, accent bleu.',
        sections: [
          { name: 'Hero', why: 'problème + promesse + CTA essai' },
          { name: 'Comment ça marche', why: '3 étapes max' },
          { name: 'Fonctionnalités', why: 'bénéfices, pas feature dump' },
          { name: 'Pricing soft', why: 'une offre mise en avant' },
          { name: 'FAQ courte', why: 'objections freinantes' }
        ]
      }),
      TOKENS_SAAS,
      appShell('', `    <div style={{ minHeight: '100vh', background: 'var(--xp-bg)', color: 'var(--xp-ink)', fontFamily: 'var(--xp-font)' }}>
      <div style={{ maxWidth: 'var(--xp-max)', margin: '0 auto', padding: '28px 24px 80px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 72 }}>
          <strong>Produit</strong>
          <a href="#essai" style={{ background: 'var(--xp-accent)', color: '#fff', padding: '10px 16px', borderRadius: 999, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Essai gratuit</a>
        </header>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 56px)', letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: '16ch', margin: '0 0 16px' }}>
          Moins de friction. Plus de décisions.
        </h1>
        <p style={{ color: 'var(--xp-muted)', fontSize: 18, maxWidth: '42ch', margin: '0 0 28px' }}>
          Décris le résultat pour ton client — pas la stack.
        </p>
        <a id="essai" href="#" style={{ color: 'var(--xp-accent)', fontWeight: 650 }}>Créer un compte →</a>
        <section style={{ marginTop: 96, display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {['Comprendre', 'Configurer', 'Mesurer'].map((t) => (
            <div key={t} style={{ padding: 20, background: 'var(--xp-surface)', borderRadius: 'var(--xp-radius)', boxShadow: 'inset 0 0 0 1px var(--xp-line)' }}>
              <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>{t}</h2>
              <p style={{ margin: 0, color: 'var(--xp-muted)', fontSize: 14, lineHeight: 1.45 }}>Une idée par bloc. Remplace ce texte.</p>
            </div>
          ))}
        </section>
      </div>
    </div>`)
    ]
  },
  {
    id: 'xp-dashboard-dense',
    builtin: true,
    kind: 'experience',
    category: 'product',
    name: 'Dashboard dense',
    tagline: 'Données lisibles, actions proches',
    description: 'Shell application : sidebar, en-tête, tableau / métriques. Pensé pour les pros qui vivent dans l’outil.',
    intent: 'Permettre de scanner l’état et d’agir sans quitter la page.',
    audience: 'Utilisateurs quotidiens (ops, finance, support).',
    promise: 'Densité utile, hiérarchie nette, pas de cartes vides.',
    vibe: 'Sombre utilitaire, accent bleu, mono pour les chiffres.',
    frameworkId: 'vite-react',
    databaseId: 'none',
    themes: ['dashboard', 'application', 'saas'],
    libs: ['tailwindcss', '@tanstack/react-table', 'recharts', 'lucide-react', 'zustand'],
    commands: [],
    files: [
      briefMd({
        title: 'Dashboard dense',
        intent: 'Scanner l’état et agir sans changer de page.',
        audience: 'Utilisateurs quotidiens ops / finance / support.',
        promise: 'Densité utile, actions à portée de main.',
        vibe: 'Sombre utilitaire, chiffres en mono.',
        sections: [
          { name: 'Sidebar', why: 'navigation stable, 5–7 entrées max' },
          { name: 'Top bar', why: 'contexte + recherche + compte' },
          { name: 'KPIs', why: '3–4 max, pas une bande de vanity metrics' },
          { name: 'Table principale', why: 'job #1 de l’écran' }
        ]
      }),
      TOKENS_DASH,
      appShell('', `    <div style={{ display: 'grid', gridTemplateColumns: 'var(--xp-sidebar) 1fr', minHeight: '100vh', background: 'var(--xp-bg)', color: 'var(--xp-ink)', fontFamily: 'var(--xp-font)' }}>
      <aside style={{ borderRight: '1px solid var(--xp-line)', padding: 20 }}>
        <strong style={{ display: 'block', marginBottom: 28 }}>Atelier</strong>
        {['Vue d’ensemble', 'Opérations', 'Rapports', 'Réglages'].map((l) => (
          <div key={l} style={{ padding: '10px 8px', color: l === 'Vue d’ensemble' ? 'var(--xp-ink)' : 'var(--xp-muted)', fontSize: 14, fontWeight: l === 'Vue d’ensemble' ? 600 : 400 }}>{l}</div>
        ))}
      </aside>
      <div>
        <header style={{ height: 56, borderBottom: '1px solid var(--xp-line)', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>Vue d’ensemble</span>
          <span style={{ color: 'var(--xp-muted)', fontSize: 13 }}>Aujourd’hui</span>
        </header>
        <main style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[['Actifs', '128'], ['En attente', '14'], ['Taux', '98 %']].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--xp-surface)', borderRadius: 'var(--xp-radius)', padding: 16, boxShadow: 'inset 0 0 0 1px var(--xp-line)' }}>
                <div style={{ color: 'var(--xp-muted)', fontSize: 12 }}>{k}</div>
                <div style={{ fontFamily: 'var(--xp-mono)', fontSize: 28, marginTop: 6 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--xp-surface)', borderRadius: 'var(--xp-radius)', boxShadow: 'inset 0 0 0 1px var(--xp-line)', padding: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, padding: '10px 12px', color: 'var(--xp-muted)', fontSize: 12 }}>
              <span>Nom</span><span>Statut</span><span>Mis à jour</span>
            </div>
            {['Alpha', 'Beta', 'Gamma'].map((n) => (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, padding: '12px', borderTop: '1px solid var(--xp-line)', fontSize: 14 }}>
                <span>{n}</span><span style={{ color: 'var(--xp-ok)' }}>OK</span><span style={{ fontFamily: 'var(--xp-mono)', color: 'var(--xp-muted)' }}>—</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>`)
    ]
  },
  {
    id: 'xp-onboarding',
    builtin: true,
    kind: 'experience',
    category: 'product',
    name: 'Onboarding produit',
    tagline: 'Premiers pas sans friction',
    description: 'Parcours en 3 étapes pour activer un compte : bienvenue, choix, confirmation.',
    intent: 'Amener l’utilisateur au premier succès en moins de 2 minutes.',
    audience: 'Nouveaux inscrits, encore incertains.',
    promise: 'Une question à la fois, progression visible, skip possible.',
    vibe: 'Sombre soft, accent violet discret, large radius.',
    frameworkId: 'vite-react',
    databaseId: 'none',
    themes: ['application', 'saas'],
    libs: ['tailwindcss', 'motion', 'lucide-react', 'zod'],
    commands: [],
    files: [
      briefMd({
        title: 'Onboarding produit',
        intent: 'Premier succès en moins de 2 minutes.',
        audience: 'Nouveaux inscrits.',
        promise: 'Une question à la fois, progression claire.',
        vibe: 'Sombre soft, large radius.',
        sections: [
          { name: 'Bienvenue', why: 'marque + bénéfice en une phrase' },
          { name: 'Choix', why: '1 décision utile (rôle, taille, objectif)' },
          { name: 'Prêt', why: 'CTA vers le produit, pas vers plus de formulaires' }
        ]
      }),
      TOKENS_ONBOARD,
      file('src/App.tsx', `
import { useState } from 'react'
import './styles/tokens.css'

const steps = ['Bienvenue', 'Ton contexte', 'C’est prêt']

export default function App() {
  const [step, setStep] = useState(0)
  return (
    <div style={{ minHeight: '100vh', background: 'var(--xp-bg)', color: 'var(--xp-ink)', fontFamily: 'var(--xp-font)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 'min(440px, 100%)', background: 'var(--xp-surface)', borderRadius: 'var(--xp-radius)', padding: 28, boxShadow: 'inset 0 0 0 1px var(--xp-line)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {steps.map((_, i) => (
            <i key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= step ? 'var(--xp-accent)' : 'var(--xp-line)' }} />
          ))}
        </div>
        <p style={{ color: 'var(--xp-muted)', fontSize: 13, margin: '0 0 8px' }}>Étape {step + 1} / {steps.length}</p>
        <h1 style={{ fontSize: 26, letterSpacing: '-0.02em', margin: '0 0 12px' }}>{steps[step]}</h1>
        <p style={{ color: 'var(--xp-muted)', lineHeight: 1.5, margin: '0 0 28px' }}>
          Remplace ce texte par une seule question claire. Pas de multi-champs ici.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} style={{ background: 'transparent', color: 'var(--xp-muted)', border: 0, cursor: 'pointer' }}>Retour</button>
          <button type="button" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} style={{ background: 'var(--xp-accent)', color: '#fff', border: 0, borderRadius: 999, padding: '10px 18px', fontWeight: 650, cursor: 'pointer' }}>
            {step === steps.length - 1 ? 'Entrer dans l’app' : 'Continuer'}
          </button>
        </div>
      </div>
    </div>
  )
}
`)
    ]
  },
  {
    id: 'xp-portfolio',
    builtin: true,
    kind: 'experience',
    category: 'content',
    name: 'Portfolio éditorial',
    tagline: 'Travail montré, pas listé',
    description: 'Mise en page éditoriale pour designer / studio : projets en une colonne, typo soignée.',
    intent: 'Laisser le travail parler ; le site comme revue, pas comme CV.',
    audience: 'Clients potentiels, pairs, recruteurs culturels.',
    promise: 'Hiérarchie typographique forte, peu de chrome UI.',
    vibe: 'Papier chaud, serif, accent terre, zéro radius.',
    frameworkId: 'vite-react',
    databaseId: 'none',
    themes: ['portfolio', 'vitrine'],
    libs: ['tailwindcss', 'lenis', 'lucide-react'],
    commands: [],
    files: [
      briefMd({
        title: 'Portfolio éditorial',
        intent: 'Laisser le travail parler.',
        audience: 'Clients et pairs.',
        promise: 'Typo forte, peu de chrome.',
        vibe: 'Papier chaud, serif, accent terre.',
        sections: [
          { name: 'Intro', why: 'nom + une ligne de posture' },
          { name: 'Sélection', why: '3–6 projets, image dominante' },
          { name: 'À propos', why: 'court, humain' },
          { name: 'Contact', why: 'un seul canal' }
        ]
      }),
      TOKENS_PORTFOLIO,
      appShell('', `    <div style={{ background: 'var(--xp-bg)', color: 'var(--xp-ink)', fontFamily: 'var(--xp-font-body)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 96px' }}>
        <p style={{ margin: '0 0 8px', color: 'var(--xp-muted)', fontSize: 14 }}>Studio</p>
        <h1 style={{ fontFamily: 'var(--xp-font-display)', fontSize: 'clamp(40px, 7vw, 64px)', fontWeight: 500, letterSpacing: '-0.03em', margin: '0 0 20px', lineHeight: 1.05 }}>
          Sélection 2026
        </h1>
        <p style={{ maxWidth: 'var(--xp-measure)', color: 'var(--xp-muted)', fontSize: 18, lineHeight: 1.55, margin: '0 0 56px' }}>
          Une phrase sur ta pratique. Ensuite, les projets — pas une grille de logos.
        </p>
        {['Projet A — identité', 'Projet B — produit', 'Projet C — édition'].map((t) => (
          <article key={t} style={{ padding: '28px 0', borderTop: '1px solid var(--xp-line)' }}>
            <h2 style={{ fontFamily: 'var(--xp-font-display)', fontSize: 28, fontWeight: 500, margin: '0 0 8px' }}>{t}</h2>
            <p style={{ margin: 0, color: 'var(--xp-muted)', lineHeight: 1.5 }}>Remplace par le contexte et le résultat. Une image pleine largeur juste en dessous.</p>
          </article>
        ))}
        <p style={{ marginTop: 48, borderTop: '1px solid var(--xp-line)', paddingTop: 28 }}>
          <a href="mailto:hello@example.com" style={{ color: 'var(--xp-accent)', fontWeight: 600 }}>hello@example.com</a>
        </p>
      </div>
    </div>`)
    ]
  },
  {
    id: 'xp-blog',
    builtin: true,
    kind: 'experience',
    category: 'content',
    name: 'Blog lecture',
    tagline: 'Confort de lecture d’abord',
    description: 'Gabarit article : mesure de ligne, leading généreux, distraction minimale.',
    intent: 'Faire lire jusqu’au bout.',
    audience: 'Lecteurs curieux, communauté, SEO de fond.',
    promise: 'Typo de lecture, chrome minimal, focus sur le texte.',
    vibe: 'Papier clair, serif, accent teal.',
    frameworkId: 'astro',
    databaseId: 'none',
    themes: ['blog', 'vitrine'],
    libs: [],
    commands: [],
    files: [
      briefMd({
        title: 'Blog lecture',
        intent: 'Faire lire jusqu’au bout.',
        audience: 'Lecteurs et communauté.',
        promise: 'Mesure de ligne confortable, chrome minimal.',
        vibe: 'Papier clair, serif, accent teal.',
        sections: [
          { name: 'Index', why: 'titres + dates, pas de cards lourdes' },
          { name: 'Article', why: 'titre, chapô, corps, fin claire' }
        ]
      }),
      file('src/styles/tokens.css', TOKENS_BLOG.content),
      file('src/pages/index.astro', `
---
import '../styles/tokens.css'
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Journal</title>
  </head>
  <body style="margin:0;background:var(--xp-bg);color:var(--xp-ink);font-family:var(--xp-font-body);">
    <main style="max-width:var(--xp-measure);margin:0 auto;padding:64px 24px;">
      <p style="color:var(--xp-muted);font-size:14px;">Journal</p>
      <h1 style="font-family:var(--xp-font-display);font-size:clamp(36px,6vw,52px);letter-spacing:-0.02em;">Dernières notes</h1>
      <article style="padding:28px 0;border-top:1px solid var(--xp-line);">
        <time style="color:var(--xp-muted);font-size:13px;">4 sept. 2026</time>
        <h2 style="font-family:var(--xp-font-display);font-size:28px;margin:8px 0;">Titre de l’article</h2>
        <p style="color:var(--xp-muted);line-height:var(--xp-leading);margin:0;">Chapô en deux phrases. Lien vers la page article ensuite.</p>
      </article>
    </main>
  </body>
</html>
`)
    ]
  },
  {
    id: 'xp-ecommerce',
    builtin: true,
    kind: 'experience',
    category: 'commerce',
    name: 'E-commerce vitrine',
    tagline: 'Produit au centre',
    description: 'Grille catalogue + fiche produit simple. Confiance et clarté avant les gadgets.',
    intent: 'Montrer le produit et réduire l’hésitation à l’achat.',
    audience: 'Acheteurs en discovery (mobile-first).',
    promise: 'Photos dominantes, infos utiles, CTA panier évident.',
    vibe: 'Blanc / soft, noir accent, radius doux.',
    frameworkId: 'vite-react',
    databaseId: 'none',
    themes: ['ecommerce', 'vitrine'],
    libs: ['tailwindcss', 'embla-carousel-react', 'lucide-react', 'zustand'],
    commands: [],
    files: [
      briefMd({
        title: 'E-commerce vitrine',
        intent: 'Montrer le produit et réduire l’hésitation.',
        audience: 'Acheteurs mobile-first.',
        promise: 'Photos dominantes, CTA clair.',
        vibe: 'Blanc / soft, accent noir.',
        sections: [
          { name: 'Catalogue', why: 'grille produit, filtre léger' },
          { name: 'Fiche', why: 'galerie + prix + CTA' },
          { name: 'Panier', why: 'résumé, pas un tunnel encore' }
        ]
      }),
      TOKENS_SHOP,
      appShell('', `    <div style={{ minHeight: '100vh', background: 'var(--xp-bg)', color: 'var(--xp-ink)', fontFamily: 'var(--xp-font)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--xp-line)' }}>
        <strong>Boutique</strong>
        <span style={{ color: 'var(--xp-muted)' }}>Panier (0)</span>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 32, letterSpacing: '-0.02em', margin: '0 0 28px' }}>Nouveautés</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
          {['Objet 01', 'Objet 02', 'Objet 03', 'Objet 04'].map((name) => (
            <article key={name}>
              <div style={{ aspectRatio: 'var(--xp-product)', background: 'var(--xp-soft)', borderRadius: 'var(--xp-radius)', marginBottom: 12 }} />
              <h2 style={{ fontSize: 16, margin: '0 0 4px', fontWeight: 600 }}>{name}</h2>
              <p style={{ margin: 0, color: 'var(--xp-muted)', fontSize: 14 }}>120 €</p>
            </article>
          ))}
        </div>
      </main>
    </div>`)
    ]
  },
  {
    id: 'xp-outil-interne',
    builtin: true,
    kind: 'experience',
    category: 'ops',
    name: 'Outil interne',
    tagline: 'Efficacité avant esthétique flashy',
    description: 'Interface dense pour équipes : formulaires, listes, états. Moins de décor, plus de débit.',
    intent: 'Faire une tâche métier en un minimum de clics.',
    audience: 'Collaborateurs formés, usage quotidien.',
    promise: 'Densité, labels clairs, feedback immédiat.',
    vibe: 'Gris clair, accent bleu admin, radius modéré.',
    frameworkId: 'vite-react',
    databaseId: 'none',
    themes: ['interne', 'application', 'dashboard'],
    libs: ['tailwindcss', 'react-hook-form', 'zod', '@tanstack/react-query', 'lucide-react'],
    commands: [],
    files: [
      briefMd({
        title: 'Outil interne',
        intent: 'Tâche métier en un minimum de clics.',
        audience: 'Collaborateurs au quotidien.',
        promise: 'Densité et feedback clair.',
        vibe: 'Gris clair, accent admin.',
        sections: [
          { name: 'Liste filtrable', why: 'point d’entrée' },
          { name: 'Fiche / formulaire', why: 'édition rapide' },
          { name: 'États vides / erreur', why: 'messages actionnables' }
        ]
      }),
      TOKENS_INTERNAL,
      appShell('', `    <div style={{ minHeight: '100vh', background: 'var(--xp-bg)', color: 'var(--xp-ink)', fontFamily: 'var(--xp-font)' }}>
      <header style={{ background: 'var(--xp-surface)', borderBottom: '1px solid var(--xp-line)', padding: '12px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <strong>Ops</strong>
        <input placeholder="Filtrer…" style={{ flex: 1, maxWidth: 320, height: 36, borderRadius: 'var(--xp-radius)', border: '1px solid var(--xp-line)', padding: '0 12px' }} />
        <button type="button" style={{ height: 36, padding: '0 14px', borderRadius: 'var(--xp-radius)', border: 0, background: 'var(--xp-accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Nouveau</button>
      </header>
      <main style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div style={{ background: 'var(--xp-surface)', border: '1px solid var(--xp-line)', borderRadius: 'var(--xp-radius)' }}>
          {['Dossier #1042', 'Dossier #1041', 'Dossier #1040'].map((row) => (
            <div key={row} style={{ padding: '12px 14px', borderBottom: '1px solid var(--xp-line)', display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>{row}</span>
              <span style={{ color: 'var(--xp-muted)' }}>En cours</span>
            </div>
          ))}
        </div>
        <aside style={{ background: 'var(--xp-surface)', border: '1px solid var(--xp-line)', borderRadius: 'var(--xp-radius)', padding: 16 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Détail</h2>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--xp-muted)', marginBottom: 4 }}>Titre</label>
          <input style={{ width: '100%', height: 36, marginBottom: 12, borderRadius: 'var(--xp-radius)', border: '1px solid var(--xp-line)', padding: '0 10px', boxSizing: 'border-box' }} />
          <label style={{ display: 'block', fontSize: 12, color: 'var(--xp-muted)', marginBottom: 4 }}>Notes</label>
          <textarea style={{ width: '100%', minHeight: 100, borderRadius: 'var(--xp-radius)', border: '1px solid var(--xp-line)', padding: 10, boxSizing: 'border-box', resize: 'vertical' }} />
        </aside>
      </main>
    </div>`)
    ]
  },
  {
    id: 'xp-payload-cms',
    builtin: true,
    kind: 'experience',
    category: 'content',
    name: 'CMS Payload',
    tagline: 'Admin headless, contenu sous contrôle',
    description: 'Scaffold Payload (Next + admin) : collections, médias, preview. SQLite pour démarrer sans serveur DB.',
    intent: 'Éditer le contenu hors du code, avec un admin TypeScript natif.',
    audience: 'Éditeurs, marketing, freelances qui livrent un site + back-office.',
    promise: 'create-payload-app non interactif, prérequis vérifiés, .env prêt.',
    vibe: 'Atelier pro : admin clair, front Next, zéro magie opaque.',
    frameworkId: 'payload',
    payloadTemplate: 'website',
    payloadDb: 'sqlite',
    databaseId: 'none',
    themes: ['blog', 'vitrine', 'application'],
    libs: [],
    commands: [],
    files: [
      briefMd({
        title: 'CMS Payload',
        intent: 'Contenu éditable dans /admin, front Next synchronisé.',
        audience: 'Éditeurs et développeurs du même dépôt.',
        promise: 'Collections typées, médias, rôles — sans CMS SaaS imposé.',
        vibe: 'Interface admin sobre, front au service du contenu.',
        sections: [
          { name: 'Admin /admin', why: 'premier utilisateur à la 1re visite' },
          { name: 'Collections', why: 'pages, posts, médias' },
          { name: 'Front', why: 'routes Next branchées sur Payload Local API' },
          { name: '.env', why: 'PAYLOAD_SECRET + DATABASE_URI déjà posés par PDC' }
        ]
      })
    ]
  }
]

export function mergeBlueprints(saved, defaults) {
  const list = Array.isArray(saved) ? saved : []
  const byId = new Map(list.map((b) => [b.id, b]))
  const next = []
  const seen = new Set()

  for (const d of defaults) {
    const cur = byId.get(d.id)
    if (!cur) {
      next.push(structuredClone(d))
    } else if (cur.builtin === false) {
      // utilisateur a forcé une copie custom sous le même id — rare
      next.push({ ...d, ...cur, builtin: true, kind: 'experience' })
    } else {
      // resynchronise le contenu seed (fichiers, libs, brief) tout en gardant createdAt
      next.push({
        ...d,
        createdAt: cur.createdAt || d.createdAt || Date.now()
      })
    }
    seen.add(d.id)
  }

  for (const b of list) {
    if (seen.has(b.id)) continue
    next.push(b)
  }
  return next
}
