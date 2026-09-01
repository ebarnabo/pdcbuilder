import { Github, Cloud } from 'lucide-react'
import { Field, Segmented } from './ui.jsx'

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
