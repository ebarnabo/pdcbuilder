import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, RefreshCw } from 'lucide-react'
import { Field } from './ui.jsx'
import { api } from './bridge.js'

export default function MedusaSetup({
  starter,
  onStarter,
  dbMode,
  onDbMode,
  dbUrl,
  onDbUrl,
  toast,
  onReadyChange
}) {
  const [prereqs, setPrereqs] = useState(null)
  const [busy, setBusy] = useState('')
  const [checking, setChecking] = useState(false)

  const reload = async () => {
    setChecking(true)
    try {
      const r = await api.medusa.prereqs({ dbMode })
      setPrereqs(r)
      onReadyChange?.(Boolean(r?.ready))
    } catch {
      setPrereqs(null)
      onReadyChange?.(false)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { reload() }, [dbMode])

  const installOne = async (toolId) => {
    setBusy(toolId)
    try {
      const r = await api.toolchain.install(toolId)
      if (!r?.ok) toast?.(r?.error || 'Installation échouée', true)
      else toast?.('Installation lancée — vérifie la console système')
      await reload()
    } catch (e) {
      toast?.(e.message || 'Installation impossible', true)
    } finally {
      setBusy('')
    }
  }

  const installMissing = async () => {
    const missing = (prereqs?.items || []).filter((i) => i.required && !i.ok && i.canInstall)
    for (const item of missing) await installOne(item.installAs || item.toolId)
  }

  const starters = prereqs?.starterOptions || [
    { id: 'backend', name: 'Backend seul', blurb: 'API + admin.' },
    { id: 'storefront', name: 'Backend + Storefront', blurb: 'Monorepo Next.js.' }
  ]
  const dbModes = prereqs?.dbModeOptions || [
    { id: 'skip', name: 'Plus tard', blurb: 'Sans créer la base.' },
    { id: 'local', name: 'Postgres local', blurb: 'URL 127.0.0.1.' },
    { id: 'url', name: 'URL fournie', blurb: 'Chaîne Postgres.' }
  ]
  const ready = prereqs?.ready !== false
  const missingCount = prereqs?.missing?.length || 0

  return (
    <div className="payload-setup">
      <Field label="Starter Medusa" hint="create-medusa-app non interactif (CI, --skip-db / --db-url).">
        <div className="fw-grid" role="radiogroup" aria-label="Starter Medusa">
          {starters.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={starter === s.id}
              className={`fw-pick${starter === s.id ? ' on' : ''}`}
              onClick={() => onStarter(s.id)}
            >
              <strong>{s.name}</strong>
              <span>{s.blurb}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Base PostgreSQL" hint="Medusa exige Postgres pour tourner. Le scaffold peut attendre.">
        <div className="fw-grid" role="radiogroup" aria-label="Mode base Medusa">
          {dbModes.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={dbMode === d.id}
              className={`fw-pick${dbMode === d.id ? ' on' : ''}`}
              onClick={() => onDbMode(d.id)}
            >
              <strong>{d.name}</strong>
              <span>{d.blurb}</span>
            </button>
          ))}
        </div>
      </Field>

      {dbMode === 'url' && (
        <Field label="DATABASE_URL" hint="postgres://user:pass@host:5432/dbname">
          <input
            className="input mono"
            placeholder="postgres://postgres@127.0.0.1:5432/medusa"
            value={dbUrl}
            onChange={(e) => onDbUrl(e.target.value)}
          />
        </Field>
      )}

      <div className={`payload-prereqs${ready ? ' ok' : ' warn'}`}>
        <div className="payload-prereqs-head">
          <div>
            <h5>Prérequis machine</h5>
            <p>
              {checking && 'Vérification…'}
              {!checking && ready && 'Prêt pour créer le projet Medusa.'}
              {!checking && !ready && `${missingCount} élément${missingCount > 1 ? 's' : ''} à installer.`}
            </p>
          </div>
          <div className="payload-prereqs-actions">
            <button type="button" className="btn sm ghost" disabled={checking || !!busy} onClick={reload}>
              <RefreshCw size={13} className={checking ? 'spin' : ''} /> Rafraîchir
            </button>
            {!ready && (
              <button
                type="button"
                className="btn sm primary"
                disabled={checking || !!busy || !(prereqs?.items || []).some((i) => !i.ok && i.canInstall)}
                onClick={installMissing}
              >
                {busy ? <RefreshCw size={13} className="spin" /> : <Download size={13} />}
                Installer les manquants
              </button>
            )}
          </div>
        </div>
        <ul className="payload-prereq-list">
          {(prereqs?.items || []).map((item) => (
            <li key={item.id} className={item.ok ? 'on' : 'off'}>
              <span className="payload-prereq-ico" aria-hidden>
                {item.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              </span>
              <div className="payload-prereq-body">
                <strong>{item.name}</strong>
                <span>{item.detail}</span>
                {item.hint && <em>{item.hint}</em>}
              </div>
              {!item.ok && item.canInstall && (
                <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => installOne(item.installAs || item.toolId)}>
                  {busy === (item.installAs || item.toolId) ? <RefreshCw size={13} className="spin" /> : <Download size={13} />}
                  Télécharger
                </button>
              )}
              {!item.ok && !item.canInstall && <span className="chip err">Manuel</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
