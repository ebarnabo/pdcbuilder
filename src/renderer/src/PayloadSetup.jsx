import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, RefreshCw } from 'lucide-react'
import { Field } from './ui.jsx'
import { api } from './bridge.js'

/**
 * Configuration Payload CMS à la création :
 * template, base native, prérequis machine + install.
 */
export default function PayloadSetup({
  template,
  onTemplate,
  db,
  onDb,
  toast,
  onReadyChange
}) {
  const [prereqs, setPrereqs] = useState(null)
  const [busy, setBusy] = useState('')
  const [checking, setChecking] = useState(false)

  const reload = async () => {
    setChecking(true)
    try {
      const r = await api.payload.prereqs({ db })
      setPrereqs(r)
      onReadyChange?.(Boolean(r?.ready))
    } catch {
      setPrereqs(null)
      onReadyChange?.(false)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { reload() }, [db])

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
    for (const item of missing) {
      await installOne(item.installAs || item.toolId)
    }
  }

  const templates = prereqs?.templateOptions || [
    { id: 'blank', name: 'Blank', blurb: 'Next + Payload, collections vides.' },
    { id: 'website', name: 'Website', blurb: 'Site éditorial prêt.' },
    { id: 'ecommerce', name: 'E-commerce', blurb: 'Catalogue et checkout.' }
  ]
  const databases = prereqs?.databaseOptions || [
    { id: 'sqlite', name: 'SQLite', blurb: 'Fichier local, zéro serveur.' },
    { id: 'mongodb', name: 'MongoDB', blurb: 'Documents, serveur local.' },
    { id: 'postgres', name: 'PostgreSQL', blurb: 'SQL relationnel.' }
  ]

  const ready = prereqs?.ready !== false
  const missingCount = prereqs?.missing?.length || 0

  return (
    <div className="payload-setup">
      <Field label="Template Payload" hint="Scaffold officiel create-payload-app, sans invite interactive.">
        <div className="fw-grid payload-tpl-grid" role="radiogroup" aria-label="Template Payload">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={template === t.id}
              className={`fw-pick${template === t.id ? ' on' : ''}`}
              onClick={() => onTemplate(t.id)}
            >
              <strong>{t.name}</strong>
              <span>{t.blurb}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Base Payload" hint="Adaptateur natif Payload — pas un client BaaS générique.">
        <div className="fw-grid payload-db-grid" role="radiogroup" aria-label="Base Payload">
          {databases.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={db === d.id}
              className={`fw-pick${db === d.id ? ' on' : ''}`}
              onClick={() => onDb(d.id)}
            >
              <strong>{d.name}</strong>
              <span>{d.blurb}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className={`payload-prereqs${ready ? ' ok' : ' warn'}`}>
        <div className="payload-prereqs-head">
          <div>
            <h5>Prérequis machine</h5>
            <p>
              {checking && 'Vérification…'}
              {!checking && ready && 'Tout est prêt pour créer le projet.'}
              {!checking && !ready && `${missingCount} élément${missingCount > 1 ? 's' : ''} à installer sur ce PC.`}
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
                <button
                  type="button"
                  className="btn sm primary"
                  disabled={!!busy}
                  onClick={() => installOne(item.installAs || item.toolId)}
                >
                  {busy === (item.installAs || item.toolId)
                    ? <RefreshCw size={13} className="spin" />
                    : <Download size={13} />}
                  Télécharger
                </button>
              )}
              {!item.ok && !item.canInstall && (
                <span className="chip err">Manuel</span>
              )}
            </li>
          ))}
          {!prereqs && !checking && (
            <li className="off">
              <span className="payload-prereq-ico"><AlertCircle size={16} /></span>
              <div className="payload-prereq-body">
                <strong>Impossible de lire les prérequis</strong>
                <span>Réessaie ou ouvre l’onglet Outils.</span>
              </div>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

export function payloadReady(prereqs) {
  return !prereqs || prereqs.ready !== false
}
