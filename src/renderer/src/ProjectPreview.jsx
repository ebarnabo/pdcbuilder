import { useMemo } from 'react'
import { themeLabel } from './themes.jsx'

const CATEGORY_THEME = {
  marketing: 'landing',
  product: 'saas',
  content: 'portfolio',
  commerce: 'ecommerce',
  ops: 'dashboard'
}

export function resolvePreviewTheme({ themes = [], blueprint } = {}) {
  if (themes?.length) return themes[0]
  if (blueprint?.themes?.length) return blueprint.themes[0]
  if (blueprint?.category && CATEGORY_THEME[blueprint.category]) {
    return CATEGORY_THEME[blueprint.category]
  }
  return 'landing'
}

function BrowserChrome({ title, children, variant }) {
  return (
    <div className={`app-preview-frame app-preview-${variant}`} data-variant={variant}>
      <div className="app-preview-chrome" aria-hidden>
        <span /><span /><span />
        <em>{title}</em>
      </div>
      <div className="app-preview-stage">{children}</div>
    </div>
  )
}

function PreviewLanding({ label }) {
  return (
    <BrowserChrome title={label} variant="landing">
      <div className="ap-landing">
        <div className="ap-landing-orb" aria-hidden />
        <nav className="ap-landing-nav">
          <i /><i /><i />
          <b />
        </nav>
        <div className="ap-landing-hero">
          <span className="ap-kicker">Nouveau</span>
          <strong>Une vitrine qui convertit</strong>
          <p>Hero plein cadre, CTA clair, motion utile.</p>
          <div className="ap-landing-cta">
            <b /><i />
          </div>
        </div>
        <div className="ap-landing-cards">
          <article /><article /><article />
        </div>
      </div>
    </BrowserChrome>
  )
}

function PreviewSaas({ label }) {
  return (
    <BrowserChrome title={label} variant="saas">
      <div className="ap-saas">
        <aside className="ap-saas-rail">
          <i /><i /><i /><i />
        </aside>
        <div className="ap-saas-main">
          <header><span /><b /></header>
          <div className="ap-saas-kpis">
            <div className="ap-kpi"><em /><i style={{ '--w': '72%' }} /></div>
            <div className="ap-kpi"><em /><i style={{ '--w': '48%' }} /></div>
            <div className="ap-kpi"><em /><i style={{ '--w': '86%' }} /></div>
          </div>
          <div className="ap-saas-panel">
            <div className="ap-saas-row" /><div className="ap-saas-row" /><div className="ap-saas-row" />
          </div>
        </div>
      </div>
    </BrowserChrome>
  )
}

function PreviewDashboard({ label }) {
  return (
    <BrowserChrome title={label} variant="dashboard">
      <div className="ap-dash">
        <div className="ap-dash-head">
          <strong>Vue live</strong>
          <span className="ap-live"><i /> en ligne</span>
        </div>
        <div className="ap-dash-chart">
          {[42, 68, 35, 82, 55, 90, 48, 74].map((h, i) => (
            <i key={i} style={{ '--h': `${h}%`, '--d': `${i * 0.06}s` }} />
          ))}
        </div>
        <div className="ap-dash-grid">
          <div /><div /><div /><div />
        </div>
      </div>
    </BrowserChrome>
  )
}

function PreviewEcommerce({ label }) {
  return (
    <BrowserChrome title={label} variant="ecommerce">
      <div className="ap-shop">
        <header>
          <span /><b className="ap-cart"><i>2</i></b>
        </header>
        <div className="ap-shop-grid">
          {[1, 2, 3, 4].map((n) => (
            <article key={n} className="ap-product" style={{ '--d': `${n * 0.07}s` }}>
              <div className="ap-product-img" />
              <em /><i />
            </article>
          ))}
        </div>
      </div>
    </BrowserChrome>
  )
}

function PreviewPortfolio({ label }) {
  return (
    <BrowserChrome title={label} variant="portfolio">
      <div className="ap-folio">
        <header>
          <strong>Studio</strong>
          <nav><i /><i /><i /></nav>
        </header>
        <div className="ap-folio-grid">
          <div className="ap-folio-big" />
          <div className="ap-folio-stack">
            <div /><div />
          </div>
        </div>
      </div>
    </BrowserChrome>
  )
}

function PreviewBlog({ label }) {
  return (
    <BrowserChrome title={label} variant="blog">
      <div className="ap-blog">
        {[1, 2, 3].map((n) => (
          <article key={n} style={{ '--d': `${n * 0.08}s` }}>
            <div className="ap-blog-thumb" />
            <div>
              <em /><i /><b />
            </div>
          </article>
        ))}
      </div>
    </BrowserChrome>
  )
}

function PreviewMobile({ label }) {
  return (
    <div className="app-preview-phone app-preview-mobile" data-variant="mobile">
      <div className="ap-phone-notch" aria-hidden />
      <div className="ap-phone-screen">
        <header><em /><span className="ap-live"><i /></span></header>
        <div className="ap-phone-cards">
          <div /><div /><div />
        </div>
        <nav className="ap-phone-tab">
          <i className="on" /><i /><i /><i />
        </nav>
      </div>
      <span className="ap-phone-label">{label}</span>
    </div>
  )
}

function PreviewApi({ label }) {
  return (
    <BrowserChrome title={label} variant="api">
      <div className="ap-api">
        <div className="ap-api-bar"><span>GET</span><em>/v1/projects</em></div>
        <pre className="ap-api-code" aria-hidden>
          <code>
            <span className="ap-line" style={{ '--d': '0s' }}>{'{'}'ok': true,{'}'}</span>
            <span className="ap-line" style={{ '--d': '0.12s' }}>{'  "items": ['}</span>
            <span className="ap-line" style={{ '--d': '0.24s' }}>{'    { "id": "p1" },'}</span>
            <span className="ap-line" style={{ '--d': '0.36s' }}>{'    { "id": "p2" }'}</span>
            <span className="ap-line" style={{ '--d': '0.48s' }}>{'  ]'}</span>
            <span className="ap-line" style={{ '--d': '0.6s' }}>{'}'}</span>
          </code>
        </pre>
        <div className="ap-api-pulse"><i /> 200 · 12 ms</div>
      </div>
    </BrowserChrome>
  )
}

function PreviewVitrine({ label }) {
  return (
    <BrowserChrome title={label} variant="vitrine">
      <div className="ap-vitrine">
        <div className="ap-vitrine-copy">
          <em /><strong /><p /><b />
        </div>
        <div className="ap-vitrine-visual" aria-hidden />
      </div>
    </BrowserChrome>
  )
}

function PreviewApp({ label }) {
  return (
    <BrowserChrome title={label} variant="application">
      <div className="ap-app">
        <aside><i /><i /><i /></aside>
        <main>
          <header><em /><span /></header>
          <div className="ap-app-canvas">
            <div className="ap-app-float" /><div className="ap-app-float" />
          </div>
        </main>
      </div>
    </BrowserChrome>
  )
}

function PreviewInterne({ label }) {
  return (
    <BrowserChrome title={label} variant="interne">
      <div className="ap-ops">
        <header><em /><b /></header>
        <div className="ap-ops-table">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="ap-ops-row" style={{ '--d': `${n * 0.05}s` }}>
              <i /><i /><i /><span />
            </div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  )
}

const PREVIEWS = {
  landing: PreviewLanding,
  saas: PreviewSaas,
  dashboard: PreviewDashboard,
  ecommerce: PreviewEcommerce,
  portfolio: PreviewPortfolio,
  blog: PreviewBlog,
  mobile: PreviewMobile,
  api: PreviewApi,
  vitrine: PreviewVitrine,
  application: PreviewApp,
  interne: PreviewInterne
}

/**
 * Mini aperçu d’app animé — réagit au thème / blueprint choisi à la création.
 */
export default function ProjectPreview({ themes = [], blueprint = null, name = '' }) {
  const themeId = useMemo(
    () => resolvePreviewTheme({ themes, blueprint }),
    [themes, blueprint]
  )
  const Comp = PREVIEWS[themeId] || PreviewLanding
  const title = (name || '').trim() || themeLabel(themeId)
  const caption = blueprint?.name
    ? `Exemple · ${blueprint.name}`
    : `Exemple · ${themeLabel(themeId)}`

  return (
    <div className="project-preview" aria-hidden>
      <div className="project-preview-label">
        <span>Aperçu</span>
        <em>{caption}</em>
      </div>
      <div className="project-preview-viewport" key={themeId}>
        <Comp label={title.slice(0, 28)} />
      </div>
      <p className="project-preview-hint">
        Une esquisse du type d’app — pas le rendu final. Change le thème ou le blueprint pour voir d’autres ambiances.
      </p>
    </div>
  )
}
