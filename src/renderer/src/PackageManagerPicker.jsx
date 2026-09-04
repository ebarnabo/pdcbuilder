import { useEffect, useState } from 'react'
import { ArrowUpCircle, Check, Download, RefreshCw } from 'lucide-react'
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
  const [outdatedCount, setOutdatedCount] = useState(0)
  const [busy, setBusy] = useState('')
  const [checking, setChecking] = useState(false)

  const reload = async () => {
    setChecking(true)
    try {
      const r = await api.pm.status()
      setRows(r?.managers || [])
      setOutdatedCount(r?.outdatedCount || 0)
    } catch {
      setRows([])
      setOutdatedCount(0)
    } finally {
      setChecking(false)
    }
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
      await reload()
    }
  }

  const update = async (m) => {
    if (!m.canUpdate && !m.updateGlobal) return
    setBusy(m.id)
    try {
      const r = await api.pm.update(m.id)
      if (r?.error || r?.ok === false) toast?.(r.error || r.stderr || 'Mise à jour échouée', true)
      else toast?.(`${m.name} à jour${m.latest ? ` · ${m.latest}` : ''}`)
    } finally {
      setBusy('')
      await reload()
    }
  }

  const updateAll = async () => {
    setBusy('all')
    try {
      const r = await api.pm.updateAll()
      if (r?.error || r?.ok === false) toast?.(r.error || 'Mise à jour interrompue', true)
      else if (r?.skipped) toast?.('Tout est déjà à jour')
      else toast?.(`${r.updated} gestionnaire${r.updated > 1 ? 's' : ''} mis à jour`)
    } finally {
      setBusy('')
      await reload()
    }
  }

  return (
    <Field
      label="Gestionnaire de paquets"
      hint={hint || 'Utilisé à la création de projet, pour les librairies et les bases. Le lockfile du dépôt cloné prime toujours.'}
    >
      <div className="pm-toolbar">
        <button type="button" className="btn sm ghost" disabled={!!busy || checking} onClick={reload}>
          <RefreshCw size={13} className={checking ? 'spin' : ''} /> Vérifier les versions
        </button>
        {outdatedCount > 0 && (
          <button type="button" className="btn sm primary" disabled={!!busy} onClick={updateAll}>
            {busy === 'all' ? <RefreshCw size={13} className="spin" /> : <ArrowUpCircle size={13} />}
            Tout mettre à jour ({outdatedCount})
          </button>
        )}
      </div>
      <div className="pm-grid">
        {rows.map((m) => {
          const on = value === m.id
          const working = busy === m.id || busy === 'all'
          return (
            <div key={m.id} className={`pm-card${on ? ' on' : ''}${m.outdated ? ' outdated' : ''}`}>
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
                  {m.installed && m.outdated && (
                    <span className="chip accent">MAJ {m.latest}</span>
                  )}
                  {m.installed && m.version && !m.outdated && (
                    <span className="chip ok">{m.version}</span>
                  )}
                  {m.installed && m.version && m.outdated && (
                    <span className="chip">{m.version}</span>
                  )}
                </div>
                <span className="pm-tag">{m.tag}</span>
                <p className="pm-blurb">{m.blurb}</p>
                <MetricBars metrics={m.metrics} />
              </button>
              <div className="pm-card-actions">
                {!m.installed && m.installGlobal && (
                  <button
                    type="button"
                    className="btn sm ghost pm-install"
                    disabled={!!busy}
                    onClick={() => install(m)}
                  >
                    {working ? <RefreshCw size={13} className="spin" /> : <Download size={13} />}
                    Installer
                  </button>
                )}
                {m.installed && m.updateGlobal && (
                  <button
                    type="button"
                    className={`btn sm ${m.outdated ? 'primary' : 'ghost'} pm-install`}
                    disabled={!!busy}
                    onClick={() => update(m)}
                    title={m.latest ? `Dernière version : ${m.latest}` : 'Mettre à jour vers la dernière version'}
                  >
                    {working ? <RefreshCw size={13} className="spin" /> : <ArrowUpCircle size={13} />}
                    {m.outdated ? 'Mettre à jour' : 'Actualiser'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Field>
  )
}
