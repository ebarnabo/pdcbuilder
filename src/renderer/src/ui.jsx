import { useEffect, useRef, useState, useLayoutEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Search, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { libScores } from './libScores.js'
import { compatibilityBadge } from './compat.js'

/* ── modale : portail body, Échap, voile, focus piégé, un seul scroll ── */
export function Modal({ title, subtitle, onClose, children, footer, width }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    document.documentElement.classList.add('lock-scroll')
    const root = ref.current
    const first = root?.querySelector('input, textarea, select, button:not([aria-label="Fermer"])') || root?.querySelector('button')
    first?.focus()
    return () => document.documentElement.classList.remove('lock-scroll')
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        const overlays = document.querySelectorAll('.overlay')
        const mine = ref.current?.closest('.overlay')
        if (overlays[overlays.length - 1] !== mine) return
        return onClose()
      }
      if (e.key !== 'Tab') return
      const f = ref.current?.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')
      if (!f?.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="modal" ref={ref} style={width ? { width } : undefined} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id={titleId}>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="btn icon ghost" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

/* ── confirmation : Annuler d’abord, action destructive ensuite ── */
export function Confirm({ title, subtitle, confirm = 'Supprimer', danger = true, busy = false, onClose, onConfirm, children }) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn ghost" disabled={busy} onClick={onClose}>Annuler</button>
          <button
            className={danger ? 'btn danger' : 'btn primary'}
            disabled={busy}
            onClick={() => onConfirm()}
          >
            {confirm}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

/* ── menu contextuel ancré, positionné dans le viewport ── */
export function Menu({ anchor, onClose, children }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const a = anchor.getBoundingClientRect()
    const m = ref.current.getBoundingClientRect()
    const left = Math.min(Math.max(12, a.right - m.width), window.innerWidth - m.width - 12)
    const below = a.bottom + 6
    const top = below + m.height > window.innerHeight - 12 ? a.top - m.height - 6 : below
    setPos({ top, left })
  }, [anchor])

  useEffect(() => {
    const away = (e) => { if (!ref.current?.contains(e.target) && !anchor?.contains(e.target)) onClose() }
    const esc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', away)
    window.addEventListener('keydown', esc)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  return createPortal(<div className="menu" ref={ref} style={pos} role="menu">{children}</div>, document.body)
}

/* ── contrôle segmenté avec pouce glissant ── */
export function Segmented({ options, value, onChange }) {
  const ref = useRef(null)
  const [thumb, setThumb] = useState({ width: 0, x: 0 })

  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-v="${value}"]`)
    if (el) setThumb({ width: el.offsetWidth, x: el.offsetLeft - 3 })
  }, [value, options.length])

  return (
    <div className="seg" ref={ref} role="tablist">
      <span className="seg-thumb" style={{ width: thumb.width, transform: `translateX(${thumb.x}px)` }} />
      {options.map((o) => (
        <button
          key={o.value}
          data-v={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const SCORE_ROWS = [
  { key: 'perf', label: 'Perf' },
  { key: 'free', label: 'Gratuit' },
  { key: 'paid', label: 'Payant' },
  { key: 'exit', label: 'Sortie free' }
]
const EXIT_WORD = [null, 'très tard', 'tard', 'moyen', 'assez tôt', 'tôt']

function Dots({ n, label, word }) {
  const hint = word ? `${label} ${n} sur 5, ${word}` : `${label} ${n} sur 5`
  return (
    <span className="score-dots" role="img" aria-label={hint}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`score-dot${i <= n ? ' on' : ''}`} />
      ))}
      {word && <em>{word}</em>}
    </span>
  )
}

export function ScoreStrip({ scores }) {
  if (!scores) return null
  return (
    <div className="score-strip">
      {SCORE_ROWS.map(({ key, label }) => {
        const row = scores[key]
        if (!row) return null
        return (
          <span key={key} className="score-mini">
            <abbr title={label}>{key === 'exit' ? 'Sortie' : label}</abbr>
            <Dots n={row.n} label={label} word={key === 'exit' ? EXIT_WORD[row.n] : null} />
          </span>
        )
      })}
    </div>
  )
}

export function ScoreNotes({ scores }) {
  if (!scores) return null
  return (
    <dl className="score-notes">
      {SCORE_ROWS.map(({ key, label }) => {
        const row = scores[key]
        if (!row) return null
        return (
          <div key={key} className="score-row">
            <dt>
              {label}
              <Dots n={row.n} label={label} word={key === 'exit' ? EXIT_WORD[row.n] : null} />
            </dt>
            <dd>{row.note}</dd>
          </div>
        )
      })}
    </dl>
  )
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="search">
      <Search size={15} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  )
}

export function LibraryPicker({
  categories,
  selected,
  onToggle,
  openIds,
  onToggleGroup,
  onOpenAll,
  onCloseAll,
  query = '',
  onQueryChange,
  showScores = false,
  empty,
  layout = 'accordion',
  framework = null,
  catalogCount = null
}) {
  const [activeCat, setActiveCat] = useState(null)
  const catKey = categories.map((c) => c.id).join(',')

  useEffect(() => { setActiveCat(null) }, [catKey])

  if (!categories?.length) {
    return empty || (
      <p className="card-desc" style={{ margin: 0 }}>
        {framework ? `Aucune librairie compatible avec ${framework.name}.` : 'Aucune librairie compatible.'}
      </p>
    )
  }

  const total = categories.reduce((n, c) => n + c.items.length, 0)
  const itemByPkg = new Map(
    categories.flatMap((cat) => cat.items.map((item) => [item.pkg, { ...item, category: cat.name }]))
  )

  const renderItem = (item) => {
    const on = selected.includes(item.pkg)
    const scores = showScores ? libScores(item) : null
    const compat = framework ? compatibilityBadge(item, framework) : null
    return (
      <button
        key={item.pkg}
        type="button"
        className={`lib${on ? ' on' : ''}`}
        onClick={() => onToggle(item.pkg)}
        aria-pressed={on}
      >
        <span className="tick">{on && <Check size={12} strokeWidth={3.2} />}</span>
        <span className="lib-main">
          <span className="lib-title-row">
            <strong>
              {item.name}
              {item.dev && <span className="chip" style={{ marginLeft: 6, height: 17, fontSize: 10 }}>dev</span>}
            </strong>
            {compat && <span className={`lib-compat ${compat.tone}`}>{compat.text}</span>}
          </span>
          <small className="mono">{item.pkg}</small>
          <small>{item.description}</small>
          {scores && <ScoreStrip scores={scores} />}
        </span>
      </button>
    )
  }

  if (layout === 'explore') {
    const active = activeCat ? categories.find((c) => c.id === activeCat) : null
    const visibleCats = active ? [active] : categories

    return (
      <div className="lib-picker lib-picker--explore">
        <div className="lib-picker-toolbar">
          {onQueryChange && (
            <SearchBox value={query} onChange={onQueryChange} placeholder="Chercher un paquet, une catégorie…" />
          )}
          <span className="chip accent">{total} compatible{total > 1 ? 's' : ''}</span>
          {catalogCount != null && catalogCount > total && (
            <span className="chip">sur {catalogCount} au catalogue</span>
          )}
        </div>

        {selected.length > 0 && (
          <div className="lib-selected-bar" aria-label="Librairies sélectionnées">
            {selected.map((pkg) => {
              const item = itemByPkg.get(pkg)
              if (!item) return null
              return (
                <button
                  key={pkg}
                  type="button"
                  className="lib-selected-chip"
                  onClick={() => onToggle(pkg)}
                  title={`Retirer ${item.name}`}
                >
                  <span>{item.name}</span>
                  <X size={12} aria-hidden />
                </button>
              )
            })}
          </div>
        )}

        <div className="lib-cat-tabs" role="tablist" aria-label="Catégories">
          <button
            type="button"
            role="tab"
            aria-selected={!active}
            className={`lib-cat-tab${!active ? ' on' : ''}`}
            onClick={() => setActiveCat(null)}
          >
            Toutes
            <span className="lib-cat-count">{total}</span>
          </button>
          {categories.map((cat) => {
            const count = cat.items.filter((i) => selected.includes(i.pkg)).length
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeCat === cat.id && Boolean(active)}
                className={`lib-cat-tab${activeCat === cat.id && active ? ' on' : ''}`}
                onClick={() => setActiveCat(cat.id)}
              >
                {cat.name}
                <span className="lib-cat-count">{cat.items.length}</span>
                {count > 0 && <span className="lib-cat-picked">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="lib-explore-scroll">
          {visibleCats.map((cat) => (
            <section className="lib-explore-section" key={cat.id}>
              {!active && (
                <header className="lib-explore-section-head">
                  <h5>{cat.name}</h5>
                  <p>{cat.description}</p>
                </header>
              )}
              {active && cat.description && (
                <p className="lib-explore-cat-desc">{cat.description}</p>
              )}
              <div className="lib-explore-grid">
                {cat.items.map((item) => renderItem(item))}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="lib-picker">
      {(onQueryChange || onOpenAll || onCloseAll) && (
        <div className="lib-picker-toolbar">
          {onQueryChange && (
            <SearchBox value={query} onChange={onQueryChange} placeholder="Chercher un paquet ou une catégorie" />
          )}
          <div className="lib-picker-actions">
            {onOpenAll && (
              <button type="button" className="btn sm ghost" onClick={onOpenAll}>
                <ChevronsUpDown size={13} /> Tout ouvrir
              </button>
            )}
            {onCloseAll && (
              <button type="button" className="btn sm ghost" onClick={onCloseAll}>
                <ChevronsDownUp size={13} /> Tout fermer
              </button>
            )}
            <span className="chip accent">{total} compatible{total > 1 ? 's' : ''}</span>
          {catalogCount != null && catalogCount > total && (
            <span className="chip">sur {catalogCount} au catalogue</span>
          )}
          </div>
        </div>
      )}
      <div className="lib-picker-list">
        {categories.map((cat) => {
          const open = openIds.includes(cat.id)
          const count = cat.items.filter((i) => selected.includes(i.pkg)).length
          return (
            <div className="lib-group" key={cat.id}>
              <button type="button" className="lib-head" onClick={() => onToggleGroup(cat.id)} aria-expanded={open}>
                <div style={{ flex: 1 }}>
                  <h4>{cat.name}</h4>
                  <p>{cat.description}</p>
                </div>
                {count > 0 && <span className="chip accent">{count}</span>}
                <span className="chip">{cat.items.length}</span>
                <Chevron open={open} />
              </button>
              {open && (
                <div className="lib-body">
                  {cat.items.map((item) => renderItem(item))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Chevron({ open, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden
      style={{
        color: 'var(--text-3)', flex: 'none',
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform .34s var(--ease)'
      }}>
      <path d="M4 6.5l4 4 4-4" />
    </svg>
  )
}

export function Empty({ icon, title, text, action }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export const bytes = (n) => {
  if (!n) return '—'
  const u = ['o', 'Ko', 'Mo', 'Go']
  let i = 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`
}

export const ago = (ts) => {
  if (!ts) return null
  const d = Math.round((Date.now() - ts) / 1000)
  if (d < 60) return "à l'instant"
  if (d < 3600) return `il y a ${Math.round(d / 60)} min`
  if (d < 86400) return `il y a ${Math.round(d / 3600)} h`
  return `il y a ${Math.round(d / 86400)} j`
}

/** raccourcit un chemin long en gardant le début et la fin */
export const shortPath = (p, keep = 42) => {
  if (!p || p.length <= keep) return p
  const parts = p.replace(/\\/g, '/').split('/')
  return `${parts[0]}/…/${parts.slice(-2).join('/')}`
}
