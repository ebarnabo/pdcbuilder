import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, RefreshCw } from 'lucide-react'
import { Field } from './ui.jsx'
import { api } from './bridge.js'

export default function WordpressSetup({
  locale,
  onLocale,
  mode,
  onMode,
  dbName,
  onDbName,
  dbUser,
  onDbUser,
  dbPass,
  onDbPass,
  dbHost,
  onDbHost,
  adminUser,
  onAdminUser,
  adminPassword,
  onAdminPassword,
  adminEmail,
  onAdminEmail,
  url,
  onUrl,
  toast,
  onReadyChange
}) {
  const [prereqs, setPrereqs] = useState(null)
  const [busy, setBusy] = useState('')
  const [checking, setChecking] = useState(false)

  const reload = async () => {
    setChecking(true)
    try {
      const r = await api.wordpress.prereqs({ mode })
      setPrereqs(r)
      onReadyChange?.(Boolean(r?.ready))
    } catch {
      setPrereqs(null)
      onReadyChange?.(false)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { reload() }, [mode])

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

  const locales = prereqs?.localeOptions || [
    { id: 'fr_FR', name: 'Français' },
    { id: 'en_US', name: 'English' }
  ]
  const modes = prereqs?.modeOptions || [
    { id: 'download', name: 'Fichiers seuls', blurb: 'Core + config.' },
    { id: 'full', name: 'Install complète', blurb: 'Tables + admin.' }
  ]
  const ready = prereqs?.ready !== false
  const missingCount = prereqs?.missing?.length || 0
  const full = mode === 'full'

  return (
    <div className="payload-setup">
      <Field label="Mode" hint="L’install complète exige MySQL en marche sur cette machine.">
        <div className="fw-grid" role="radiogroup" aria-label="Mode WordPress">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              className={`fw-pick${mode === m.id ? ' on' : ''}`}
              onClick={() => onMode(m.id)}
            >
              <strong>{m.name}</strong>
              <span>{m.blurb}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Langue" hint="Locale du core WordPress.">
        <div className="fw-grid" role="radiogroup" aria-label="Locale WordPress">
          {locales.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={locale === l.id}
              className={`fw-pick${locale === l.id ? ' on' : ''}`}
              onClick={() => onLocale(l.id)}
            >
              <strong>{l.name}</strong>
              <span>{l.id}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Field label="Base MySQL">
          <input className="input mono" value={dbName} onChange={(e) => onDbName(e.target.value)} />
        </Field>
        <Field label="User">
          <input className="input mono" value={dbUser} onChange={(e) => onDbUser(e.target.value)} />
        </Field>
        <Field label="Mot de passe">
          <input className="input mono" type="password" value={dbPass} onChange={(e) => onDbPass(e.target.value)} placeholder="(vide ok en local)" />
        </Field>
        <Field label="Hôte">
          <input className="input mono" value={dbHost} onChange={(e) => onDbHost(e.target.value)} />
        </Field>
      </div>

      {full && (
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Field label="URL locale">
            <input className="input mono" value={url} onChange={(e) => onUrl(e.target.value)} />
          </Field>
          <Field label="Admin">
            <input className="input" value={adminUser} onChange={(e) => onAdminUser(e.target.value)} />
          </Field>
          <Field label="Mot de passe admin">
            <input className="input" type="password" value={adminPassword} onChange={(e) => onAdminPassword(e.target.value)} placeholder="généré si vide" />
          </Field>
          <Field label="Email admin">
            <input className="input" value={adminEmail} onChange={(e) => onAdminEmail(e.target.value)} />
          </Field>
        </div>
      )}

      <div className={`payload-prereqs${ready ? ' ok' : ' warn'}`}>
        <div className="payload-prereqs-head">
          <div>
            <h5>Prérequis machine</h5>
            <p>
              {checking && 'Vérification…'}
              {!checking && ready && 'Prêt pour télécharger / configurer WordPress.'}
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
