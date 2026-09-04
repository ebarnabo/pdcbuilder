import logo from './assets/logo-pdc.jpg'

/** Marque PDC — casquette / blueprint. */
export function BrandMark({ size = 'md', className = '' }) {
  return (
    <div className={`mark mark-logo mark-${size}${className ? ` ${className}` : ''}`} aria-hidden>
      <img src={logo} alt="" draggable={false} />
    </div>
  )
}

export function BrandLockup({ tagline = 'Atelier web' }) {
  return (
    <div className="brand">
      <BrandMark size="md" />
      <div className="brand-copy">
        <h1>PDC BUILDER</h1>
        {tagline ? <span>{tagline}</span> : null}
      </div>
    </div>
  )
}

export const UI_THEMES = [
  {
    id: 'cap',
    label: 'Cap',
    hint: 'Navy → cyan, identité logo',
    swatches: ['#060b16', '#002366', '#009EDB']
  },
  {
    id: 'atelier',
    label: 'Atelier',
    hint: 'Chaud ambré, l’ancien look',
    swatches: ['#16130f', '#f0a35e', '#e06b35']
  }
]

export function applyUiTheme(id) {
  const theme = UI_THEMES.some((t) => t.id === id) ? id : 'cap'
  document.documentElement.dataset.ui = theme
  try { localStorage.setItem('pdc-ui-theme', theme) } catch { /* ignore */ }
  return theme
}

export function readStoredUiTheme() {
  try {
    const v = localStorage.getItem('pdc-ui-theme')
    if (UI_THEMES.some((t) => t.id === v)) return v
  } catch { /* ignore */ }
  return 'cap'
}
