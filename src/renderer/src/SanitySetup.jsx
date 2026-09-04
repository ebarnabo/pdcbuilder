import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, RefreshCw } from 'lucide-react'
import { Field } from './ui.jsx'
import { api } from './bridge.js'

export default function SanitySetup({
  template,
  onTemplate,
  projectId,
  onProjectId,
  dataset,
  onDataset,
  toast,
  onReadyChange
}) {
  const [prereqs, setPrereqs] = useState(null)
  const [busy, setBusy] = useState('')
  const [checking, setChecking] = useState(false)

  const reload = async () => {
    setChecking(true)
    try {
      const r = await api.sanity.prereqs()
      setPrereqs(r)
      onReadyChange?.(Boolean(r?.ready))
    } catch {
      setPrereqs(null)
      onReadyChange?.(false)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { reload() }, [])

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

  const templates = prereqs?.templateOptions || [
    { id: 'clean', name: 'Clean', blurb: 'Studio vide.' },
    { id: 'blog', name: 'Blog', blurb: 'Articles + auteurs.' },
    { id: 'shop', name: 'Shop', blurb: 'Produits simples.' }
  ]
  const ready = prereqs?.ready !== false
  const missingCount = prereqs?.missing?.length || 0

  return (
    <div className="payload-setup">
      <Field label="Template Sanity" hint="Studio local TypeScript. Le projectId cloud se branche après.">
        <div className="fw-grid" role="radiogroup" aria-label="Template Sanity">
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

      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <Field label="Project ID" hint="Optionnel. Laisse vide pour le renseigner dans .env plus tard.">
          <input
            className="input mono"
            placeholder="abc123xy"
            value={projectId}
            onChange={(e) => onProjectId(e.target.value)}
          />
        </Field>
        <Field label="Dataset" hint="Souvent production.">
          <input
            className="input mono"
            placeholder="production"
            value={dataset}
            onChange={(e) => onDataset(e.target.value)}
          />
        </Field>
      </div>

      <div className={`payload-prereqs${ready ? ' ok' : ' warn'}`}>
        <div className="payload-prereqs-head">
          <div>
            <h5>Prérequis machine</h5>
            <p>
              {checking && 'Vérification…'}
              {!checking && ready && 'Prêt pour créer le studio Sanity.'}
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
              {item.id === 'sanity' && !item.installed && item.canInstall && item.ok && (
                <button type="button" className="btn sm ghost" disabled={!!busy} onClick={() => installOne('sanity')}>
                  <Download size={13} /> CLI
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
