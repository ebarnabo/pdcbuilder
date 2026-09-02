import { useEffect, useState } from 'react'
import { Check, Download, RefreshCw } from 'lucide-react'
import { Field } from './ui.jsx'
import { api } from './bridge.js'

const METRICS = [
  { key: 'vitesse', label: 'Vitesse' },
  { key: 'disque', label: 'Disque' },
  { key: 'monorepo', label: 'Monorepo' },
  { key: 'simplicite', label: 'Simplicité' }
]

function MetricBars({ metrics }) {
  if (!metrics) return null
  return (
    <div className="pm-metrics">
      {METRICS.map(({ key, label }) => (
        <div className="pm-metric" key={key}>
          <span className="pm-metric-label">{label}</span>
          <div className="pm-bar" role="img" aria-label={`${label} ${metrics[key]} sur 5`}>
            <i style={{ width: `${(metrics[key] / 5) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PackageManagerPicker({ value, onChange, toast, hint }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState('')

  const reload = () => {
    api.pm.status().then((r) => setRows(r?.managers || [])).catch(() => {})
  }

  useEffect(() => { reload() }, [value])

  const install = async (m) => {
    if (!m.installGlobal) return
    setBusy(m.id)
    try {
      const r = await api.pm.install(m.id)
      if (r?.error || r?.ok === false) toast?.(r.error || r.stderr || 'Installation échouée', true)
      else {
        toast?.(`${m.name} installé`)
        onChange(m.id)
      }
    } finally {
      setBusy('')
      reload()
    }
  }

  return (
    <Field
      label="Gestionnaire de paquets"
      hint={hint || 'Utilisé à la création de projet, pour les librairies et les bases. Le lockfile du dépôt cloné prime toujours.'}
    >
      <div className="pm-grid">
        {rows.map((m) => {
          const on = value === m.id
          const installing = busy === m.id
          return (
            <div key={m.id} className={`pm-card${on ? ' on' : ''}`}>
              <button
                type="button"
                className="pm-card-main"
                onClick={() => onChange(m.id)}
                aria-pressed={on}
              >
                <div className="pm-card-head">
                  <strong>{m.name}</strong>
                  {on && <span className="chip accent"><Check size={11} /> Par défaut</span>}
                  {!m.installed && m.id !== 'npm' && <span className="chip err">Absent</span>}
                  {m.installed && m.version && <span className="chip">{m.version}</span>}
                </div>
                <span className="pm-tag">{m.tag}</span>
                <p className="pm-blurb">{m.blurb}</p>
                <MetricBars metrics={m.metrics} />
              </button>
              {!m.installed && m.installGlobal && (
                <button
                  type="button"
                  className="btn sm ghost pm-install"
                  disabled={!!busy}
                  onClick={() => install(m)}
                >
                  {installing ? <RefreshCw size={13} className="spin" /> : <Download size={13} />}
                  Installer
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Field>
  )
}
