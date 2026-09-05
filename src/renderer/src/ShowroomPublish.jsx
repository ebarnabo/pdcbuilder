import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, FolderOpen, Link2, RefreshCw } from 'lucide-react'
import { Modal, Field, Segmented } from './ui.jsx'
import { api } from './bridge.js'

function todayInput() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function nextFolder(propositions = []) {
  const used = new Set((propositions || []).map((p) => p.folder))
  let n = (propositions || []).length + 1
  while (used.has(`v${n}`)) n += 1
  return `v${n}`
}

/**
 * Publie un projet PDC Builder sur pdc-design-showroom
 * (nouveau projet ou proposition ajoutée à un projet existant).
 */
export default function ShowroomPublishModal({ project, state, onClose, toast, refresh }) {
  const siteUrl = state.showroom?.siteUrl || ''
  const [mode, setMode] = useState('new')
  const [clientName, setClientName] = useState(project?.name || '')
  const [projectSlug, setProjectSlug] = useState(slugify(project?.name || ''))
  const [date, setDate] = useState(todayInput())
  const [existingId, setExistingId] = useState('')
  const [label, setLabel] = useState('Proposition 1')
  const [folder, setFolder] = useState('v1')
  const [sourceDir, setSourceDir] = useState('')
  const [copyFiles, setCopyFiles] = useState(true)
  const [remote, setRemote] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(null)

  const selected = useMemo(
    () => remote.find((p) => p.id === existingId) || null,
    [remote, existingId]
  )

  const previewSlug = mode === 'existing' ? (selected?.projectSlug || '') : projectSlug
  const previewUrl = siteUrl && previewSlug
    ? `${String(siteUrl).replace(/\/+$/, '')}/projet/${previewSlug}`
    : ''

  const load = async () => {
    setLoadingList(true)
    try {
      const st = await api.showroom.status()
      setStatus(st)
      const r = await api.showroom.list()
      if (r?.error) setError(r.error)
      else setError('')
      setRemote(r?.projects || [])
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      const sug = await api.showroom.suggest(project.id)
      if (!alive) return
      if (sug?.ok) {
        setClientName(sug.clientName || project.name)
        setProjectSlug(sug.projectSlug || slugify(project.name))
        setLabel(sug.label || 'Proposition 1')
        setFolder(sug.folder || 'v1')
        setSourceDir(sug.sourceDir || '')
      }
      await load()
    })()
    return () => { alive = false }
  }, [project.id])

  useEffect(() => {
    if (mode !== 'existing' || !selected) return
    const n = (selected.propositions || []).length + 1
    setLabel(`Proposition ${n}`)
    setFolder(nextFolder(selected.propositions))
  }, [mode, selected?.id])

  const publish = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await api.showroom.publish({
        mode,
        existingId: mode === 'existing' ? existingId : undefined,
        clientName: mode === 'existing' ? (selected?.clientName || clientName) : clientName,
        projectSlug: mode === 'existing' ? (selected?.projectSlug || projectSlug) : projectSlug,
        date,
        label,
        folder,
        sourceDir: sourceDir || undefined,
        copyFiles: copyFiles && Boolean(status?.hasRepo),
        projectId: project.id
      })
      if (r?.error || r?.ok === false) {
        setError(r.error || 'Publication impossible')
        return
      }
      toast(r.copied
        ? `Publié sur le showroom · maquette copiée`
        : `Publié sur le showroom`)
      if (r.url) {
        try { await navigator.clipboard.writeText(r.url) } catch { /* ignore */ }
      }
      refresh?.()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = mode === 'new'
    ? Boolean(clientName.trim() && projectSlug.trim())
    : Boolean(existingId && label.trim() && folder.trim())

  return (
    <Modal
      title="Publier sur le showroom"
      subtitle="Crée un projet client ou ajoute une proposition — l’URL publique est générée comme sur pdc-design-showroom."
      width={560}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn ghost" disabled={busy} onClick={onClose}>Annuler</button>
          <button
            type="button"
            className="btn primary"
            disabled={busy || !canSubmit || !status?.configured || !status?.connected}
            onClick={publish}
          >
            {busy ? 'Publication…' : 'Valider et publier'}
          </button>
        </>
      }
    >
      {!status?.configured && (
        <p className="card-desc" style={{ color: 'var(--err, #c44)' }}>
          Configure l’URL et Firebase dans Réglages → Showroom avant de publier.
        </p>
      )}

      {status?.configured && !status?.connected && (
        <div className="row" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <p className="card-desc" style={{ flex: 1, margin: 0 }}>
            Connecte le compte Google admin du showroom pour écrire dans Firestore.
          </p>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={async () => {
              const r = await api.showroom.login()
              if (r?.error || r?.ok === false) toast(r.error || 'Connexion échouée', true)
              else {
                toast(`Connecté${r.email ? ` · ${r.email}` : ''}`)
                load()
              }
            }}
          >
            Se connecter
          </button>
        </div>
      )}

      <Field label="Destination">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'new', label: 'Nouveau projet' },
            { value: 'existing', label: 'Proposition existante' }
          ]}
        />
      </Field>

      {mode === 'new' ? (
        <>
          <Field label="Nom du client">
            <input
              className="input"
              value={clientName}
              maxLength={100}
              onChange={(e) => {
                setClientName(e.target.value)
                if (!project?.showroom?.slug) setProjectSlug(slugify(e.target.value))
              }}
              placeholder="Ex. Dupont SARL"
            />
          </Field>
          <Field
            label="Slug / dossier (= lien public)"
            hint={previewUrl || 'URL générée après configuration du site'}
          >
            <input
              className="input mono"
              value={projectSlug}
              maxLength={80}
              onChange={(e) => setProjectSlug(slugify(e.target.value))}
              placeholder="site-vitrine-dupont"
            />
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </>
      ) : (
        <Field
          label="Projet showroom"
          hint={loadingList ? 'Chargement…' : `${remote.length} projet${remote.length > 1 ? 's' : ''}`}
        >
          <div className="row" style={{ gap: 8 }}>
            <select
              className="input"
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">Choisir un projet…</option>
              {remote.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.clientName} · {p.projectSlug} ({(p.propositions || []).length} prop.)
                </option>
              ))}
            </select>
            <button type="button" className="btn icon" aria-label="Actualiser" disabled={loadingList} onClick={load}>
              <RefreshCw size={15} />
            </button>
          </div>
        </Field>
      )}

      <div className="row" style={{ gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Libellé de la proposition">
            <input
              className="input"
              value={label}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Version épurée"
            />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Dossier">
            <input
              className="input mono"
              value={folder}
              maxLength={60}
              onChange={(e) => setFolder(slugify(e.target.value))}
              placeholder="v1"
            />
          </Field>
        </div>
      </div>

      <Field
        label="Maquette (index.html)"
        hint={status?.hasRepo
          ? 'Copiée vers public/maquettes/{slug}/{dossier}/ dans le dépôt showroom'
          : 'Indique le chemin du dépôt showroom dans Réglages pour copier les fichiers'}
      >
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input mono"
            value={sourceDir}
            onChange={(e) => setSourceDir(e.target.value)}
            placeholder="Dossier contenant index.html"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const d = await api.fs.pickDir()
              if (d) setSourceDir(d)
            }}
          >
            <FolderOpen size={14} /> Choisir
          </button>
        </div>
        {status?.hasRepo && (
          <label className="row" style={{ marginTop: 8, gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={copyFiles}
              onChange={(e) => setCopyFiles(e.target.checked)}
            />
            <span className="card-desc" style={{ margin: 0 }}>Copier les fichiers dans le dépôt showroom</span>
          </label>
        )}
      </Field>

      {previewUrl && (
        <div className="chip-row" style={{ marginTop: 4 }}>
          <span className="chip accent"><Link2 size={11} /> URL générée</span>
          <button
            type="button"
            className="chip link"
            onClick={() => api.fs.openUrl(previewUrl)}
            title={previewUrl}
          >
            {previewUrl.replace(/^https?:\/\//, '')} <ExternalLink size={11} />
          </button>
        </div>
      )}

      {error && (
        <p className="card-desc" style={{ color: 'var(--err, #c44)', marginTop: 12 }}>{error}</p>
      )}
    </Modal>
  )
}
