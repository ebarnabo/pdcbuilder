import { useEffect, useRef, useState, useLayoutEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Search } from 'lucide-react'

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
      if (e.key === 'Escape') return onClose()
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

export function LibraryPicker({ categories, selected, onToggle, openIds, onToggleGroup }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {categories.map((cat) => {
        const open = openIds.includes(cat.id)
        const count = cat.items.filter((i) => selected.includes(i.pkg)).length
        return (
          <div className="lib-group" key={cat.id}>
            <button className="lib-head" onClick={() => onToggleGroup(cat.id)} aria-expanded={open}>
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
                {cat.items.map((item) => {
                  const on = selected.includes(item.pkg)
                  return (
                    <button key={item.pkg} className={`lib${on ? ' on' : ''}`} onClick={() => onToggle(item.pkg)} aria-pressed={on}>
                      <span className="tick">{on && <Check size={12} strokeWidth={3.2} />}</span>
                      <span>
                        <strong>
                          {item.name}
                          {item.dev && <span className="chip" style={{ marginLeft: 6, height: 17, fontSize: 10 }}>dev</span>}
                        </strong>
                        <small>{item.description}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
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
