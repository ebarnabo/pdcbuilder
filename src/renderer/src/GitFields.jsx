import { useEffect, useMemo, useState } from 'react'
import { Github, Cloud, FolderOpen } from 'lucide-react'
import { Field, Segmented, Modal, SearchBox } from './ui.jsx'
import { api } from './bridge.js'

export function GitFields({ value, onChange, status, showAuto = false }) {
  const originOff = status ? !status.originSupported : window.pdc?.platform === 'win32'
  const provider = originOff && value.provider === 'origin' ? 'github' : value.provider
  const set = (patch) => onChange({ ...value, ...patch })

  return (
    <>
      {showAuto && (
        <Field label="Nouveau projet" hint="Enregistré une fois. Chaque création reprend ces choix, sauf si tu les changes dans la modale.">
          <Segmented
            value={value.autoCreate ? 'yes' : 'no'}
            onChange={(v) => set({ autoCreate: v === 'yes' })}
            options={[
              { value: 'yes', label: 'Créer un dépôt' },
              { value: 'no', label: 'Ne pas créer' }
            ]}
          />
        </Field>
      )}

      <Field
        label="Hébergeur"
        hint={originOff
          ? 'Cursor Origin (origin.cursor.com) n’est pas encore disponible sur Windows. GitHub reste le choix par défaut.'
          : 'GitHub via la CLI gh, ou Cursor Origin pour un dépôt hébergé chez Cursor.'}
      >
        <Segmented
          value={provider}
          onChange={(v) => { if (v === 'origin' && originOff) return; set({ provider: v }) }}
          options={[
            { value: 'github', label: 'GitHub' },
            ...(originOff ? [] : [{ value: 'origin', label: 'Cursor Origin' }])
          ]}
        />
      </Field>

      {showAuto && (
        <Field label="Branche par défaut">
          <input
            className="input mono"
            value={value.branch || 'main'}
            onChange={(e) => set({ branch: e.target.value })}
          />
        </Field>
      )}

      {provider === 'github' && (
        <>
          <Field label="Visibilité">
            <Segmented
              value={value.visibility || 'private'}
              onChange={(v) => set({ visibility: v })}
              options={[
                { value: 'private', label: 'Privé' },
                { value: 'public', label: 'Public' }
              ]}
            />
          </Field>
          <Field label="Organisation GitHub" hint="Vide = compte personnel connecté à gh.">
            <input
              className="input mono"
              placeholder="mon-org"
              value={value.org || ''}
              onChange={(e) => set({ org: e.target.value })}
            />
          </Field>
        </>
      )}
    </>
  )
}

export function GitStatus({ status, onRefresh }) {
  if (!status) return null
  const rows = [
    { ok: status.git?.ok, label: 'Git', detail: status.git?.ok ? status.git.version : 'introuvable' },
    {
      ok: status.github?.ok,
      label: 'GitHub',
      detail: status.github?.ok ? `connecté · ${status.github.user}` : status.github?.error
    },
    {
      ok: status.origin?.ok,
      label: 'Cursor Origin',
      detail: status.origin?.ok ? status.origin.user : status.origin?.error
    }
  ]
  return (
    <div className="git-status">
      {rows.map((r) => (
        <div className="git-status-row" key={r.label}>
          <span className={`pulse ${r.ok ? 'running' : ''}`} />
          <strong>{r.label}</strong>
          <span>{r.detail}</span>
        </div>
      ))}
      {onRefresh && (
        <button className="btn sm ghost" onClick={onRefresh} type="button">Vérifier la connexion</button>
      )}
    </div>
  )
}

export function RepoChip({ repo, onOpen }) {
  if (!repo?.url) return null
  const Icon = repo.provider === 'origin' ? Cloud : Github
  const label = repo.provider === 'origin' ? 'Origin' : 'GitHub'
  return (
    <button
      type="button"
      className="chip link"
      title={repo.url}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(repo.url) }}
    >
      <Icon size={11} /> {label}
    </button>
  )
}

export function CloneModal({ state, onClose, onDone }) {
  const saved = state.git || {}
  const [status, setStatus] = useState(null)
  const originOff = status ? !status.originSupported : window.pdc?.platform === 'win32'
  const [provider, setProvider] = useState('github')
  const [repos, setRepos] = useState([])
  const [listError, setListError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState('')
  const [selected, setSelected] = useState(null)
  const [folder, setFolder] = useState('')
  const [workspace, setWorkspace] = useState(state.workspace)

  useEffect(() => { api.git.status().then(setStatus) }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setListError(null)
    setRepos([])
    api.git.list({ provider, org: provider === 'github' ? (saved.org || '') : '' })
      .then((r) => {
        if (!alive) return
        setRepos(r?.repos || [])
        setListError(r?.ok ? null : (r?.error || 'Liste indisponible.'))
      })
      .catch((e) => { if (alive) setListError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [provider, saved.org])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return repos
    return repos.filter((r) =>
      (r.fullName || '').toLowerCase().includes(q)
      || (r.name || '').toLowerCase().includes(q)
      || (r.description || '').toLowerCase().includes(q)
    )
  }, [repos, query])

  const pick = (repo) => {
    setSelected(repo.fullName)
    setUrl(repo.url || '')
    setFolder(repo.name || '')
    setQuery('')
  }

  const typedRepo = /^[\w.-]+\/[\w.-]+$/.test(query.trim()) ? query.trim() : ''
  const canClone = Boolean(url.trim() || selected || typedRepo)

  return (
    <Modal
      title="Récupérer un dépôt"
      subtitle="Clone dans l’atelier. Ensuite tu lances, tu build, et tu pousses depuis le menu du projet."
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" type="button" onClick={onClose}>Annuler</button>
          <button
            className="btn primary"
            type="button"
            disabled={!canClone}
            onClick={async () => {
              const payload = {
                provider,
                workspace,
                folder: folder.trim() || undefined,
                name: folder.trim() || undefined,
                url: url.trim() || undefined,
                repo: selected || typedRepo || undefined
              }
              onClose()
              const r = await api.git.clone(payload)
              onDone(r)
            }}
          >
            Cloner dans l’atelier
          </button>
        </>
      }
    >
      <Field
        label="Hébergeur"
        hint={provider === 'origin' && originOff
          ? 'La CLI Origin ne tourne pas encore sur Windows. Colle l’URL HTTPS du dépôt Cursor.'
          : 'GitHub liste tes dépôts via gh. Origin liste via la CLI, ou tu colles l’URL.'}
      >
        <Segmented
          value={provider}
          onChange={(v) => { setProvider(v); setSelected(null); setUrl(''); setFolder(''); setQuery('') }}
          options={[
            { value: 'github', label: 'GitHub' },
            { value: 'origin', label: 'Cursor Origin' }
          ]}
        />
      </Field>

      <Field label="Dépôts" hint={listError || (loading ? 'Chargement…' : `${filtered.length} visible${filtered.length > 1 ? 's' : ''}`)}>
        <SearchBox value={query} onChange={setQuery} placeholder={provider === 'github' ? 'Filtrer ou owner/nom' : 'Filtrer ou org/nom'} />
        <div className="repo-list" role="listbox" aria-label="Dépôts distants">
          {loading && <p className="card-desc" style={{ padding: '10px 8px' }}>Chargement de la liste…</p>}
          {!loading && filtered.length === 0 && (
            <p className="card-desc" style={{ padding: '10px 8px' }}>
              {listError
                ? 'Pas de liste — colle une URL plus bas.'
                : query
                  ? 'Aucun dépôt ne correspond. Tu peux coller une URL, ou taper owner/nom.'
                  : 'Aucun dépôt listé.'}
            </p>
          )}
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={selected === r.fullName}
              className={`repo-item${selected === r.fullName ? ' on' : ''}`}
              onClick={() => pick(r)}
            >
              <strong>{r.fullName}</strong>
              <small>{r.private ? 'Privé' : 'Public'}{r.description ? ` · ${r.description}` : ''}</small>
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="URL"
        hint="Facultatif si tu as choisi un dépôt au-dessus. https://github.com/org/repo.git ou l’URL Origin."
      >
        <input
          className="input mono"
          placeholder={provider === 'origin' ? 'https://origin.cursor.com/org/repo.git' : 'https://github.com/org/repo.git'}
          value={url}
          onChange={(e) => { setUrl(e.target.value); setSelected(null) }}
        />
      </Field>

      <Field label="Dossier dans l’atelier" hint={`Le clone arrive dans ${workspace}.`}>
        <div className="row">
          <input
            className="input mono"
            placeholder="nom-du-dossier"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          />
          <button
            type="button"
            className="btn none"
            onClick={async () => {
              const d = await api.fs.pickDir()
              if (d) setWorkspace(d)
            }}
          >
            <FolderOpen size={16} /> Atelier
          </button>
        </div>
      </Field>
    </Modal>
  )
}
