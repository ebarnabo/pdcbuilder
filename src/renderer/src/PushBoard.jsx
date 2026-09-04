import { useCallback, useEffect, useState } from 'react'
import {
  CloudUpload, CloudDownload, Github, RefreshCw, GitBranch, GitCommitHorizontal,
  CircleDot, ArrowUp, ArrowDown, FileWarning, ExternalLink, ChevronDown
} from 'lucide-react'
import { ago } from './ui.jsx'
import { api } from './bridge.js'

const STATE = {
  draft: { label: 'Brouillon local', hint: 'Des changements attendent un commit / push', tone: 'warn' },
  ahead: { label: 'À pousser', hint: 'Commits locaux pas encore sur le remote', tone: 'accent' },
  diverged: { label: 'Divergence', hint: 'Avance et retard — à réconcilier', tone: 'err' },
  behind: { label: 'À récupérer', hint: 'Le remote a des commits que tu n’as pas', tone: 'warn' },
  synced: { label: 'À jour', hint: 'Local et remote alignés', tone: 'ok' },
  noremote: { label: 'Sans remote', hint: 'Pas encore lié à GitHub', tone: 'muted' },
  remote: { label: 'Distant seulement', hint: 'Pas encore cloné dans l’atelier', tone: 'muted' },
  missing: { label: 'Dossier manquant', hint: 'Le chemin local n’existe plus', tone: 'err' },
  nogit: { label: 'Pas de Git', hint: 'Initialise ou lie un dépôt', tone: 'muted' }
}

function stateMeta(id) {
  return STATE[id] || STATE.synced
}

export default function PushBoard({ projects, toast, act, focusProject, onPush, refreshKey }) {
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [board, setBoard] = useState(null)

  const load = useCallback(async () => {
    if (!projects?.length) {
      setBoard({ ok: true, summary: { total: 0, draft: 0, ahead: 0, behind: 0, synced: 0, remote: 0 }, rows: [], log: [] })
      return
    }
    setLoading(true)
    try {
      const r = await api.git.board()
      setBoard(r)
    } catch (e) {
      toast?.(e?.message || 'Impossible de lire les dépôts', true)
    } finally {
      setLoading(false)
    }
  }, [projects?.length, toast])

  useEffect(() => { load() }, [load, refreshKey])

  if (!projects?.length) return null

  const summary = board?.summary
  const rows = board?.rows || []
  const log = board?.log || []
  const work = rows.filter((r) => ['draft', 'ahead', 'diverged', 'behind'].includes(r.state))

  return (
    <section className={`push-board${open ? ' open' : ''}`} aria-label="Carte des push">
      <button type="button" className="push-board-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="push-board-title">
          <CloudUpload size={18} strokeWidth={1.8} />
          <div>
            <strong>Carte des push</strong>
            <span>Suivi des travaux sur tes dépôts</span>
          </div>
        </div>
        <div className="push-board-stats">
          {summary && (
            <>
              {(summary.draft + summary.ahead) > 0 && (
                <span className="chip accent">{summary.draft + summary.ahead} en cours</span>
              )}
              {summary.behind > 0 && <span className="chip">{summary.behind} à tirer</span>}
              <span className="chip ok">{summary.synced} à jour</span>
            </>
          )}
          <ChevronDown size={16} className={`push-chevron${open ? ' up' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="push-board-body">
          <div className="push-board-toolbar">
            <p className="form-section-lead" style={{ margin: 0 }}>
              {work.length
                ? `${work.length} dépôt${work.length > 1 ? 's' : ''} demande${work.length > 1 ? 'nt' : ''} une action.`
                : 'Tous les dépôts locaux scannés sont alignés — ou sans remote.'}
            </p>
            <button type="button" className="btn sm ghost" disabled={loading} onClick={load} title="Rescanner les dépôts">
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualiser
            </button>
          </div>

          {loading && !rows.length ? (
            <p className="push-board-empty">Lecture des commits…</p>
          ) : (
            <div className="push-track">
              {rows.map((row) => (
                <PushCard
                  key={row.projectId}
                  row={row}
                  act={act}
                  focusProject={focusProject}
                  onPush={onPush}
                  toast={toast}
                  onDone={load}
                />
              ))}
            </div>
          )}

          {log.length > 0 && (
            <div className="push-feed">
              <h5>Derniers push depuis l’atelier</h5>
              <ul>
                {log.slice(0, 12).map((e) => (
                  <li key={e.id}>
                    <GitCommitHorizontal size={14} />
                    <div>
                      <strong>{e.name}</strong>
                      <span>{e.message}</span>
                    </div>
                    <time dateTime={new Date(e.at).toISOString()}>{ago(e.at)}</time>
                    {e.url && (
                      <button type="button" className="btn icon sm ghost" aria-label="Ouvrir le dépôt" onClick={() => api.fs.openUrl(e.url)}>
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function PushCard({ row, act, focusProject, onPush, toast, onDone }) {
  const meta = stateMeta(row.state)
  const project = { id: row.projectId, name: row.name, path: row.path, repo: row.repo, remoteOnly: row.remoteOnly }
  const busy = false

  const push = async () => {
    if (row.state === 'noremote' || !row.remote) {
      onPush?.(project)
      return
    }
    focusProject?.(row.projectId)
    await act(() => api.git.push(row.projectId), 'Push envoyé')
    onDone?.()
  }

  const pull = async () => {
    focusProject?.(row.projectId)
    await act(() => api.git.pull(row.projectId), 'Dépôt à jour')
    onDone?.()
  }

  return (
    <article className={`push-card tone-${meta.tone}`}>
      <header className="push-card-head">
        <div>
          <h4>{row.name}</h4>
          <p className="push-card-repo">
            {row.repo?.fullName || row.repo?.name || shortRepo(row.path) || 'Sans dépôt'}
          </p>
        </div>
        <span className={`push-badge ${meta.tone}`}>{meta.label}</span>
      </header>

      <p className="push-card-hint">{meta.hint}</p>

      <div className="push-card-meta">
        {row.branch && (
          <span className="chip"><GitBranch size={11} /> {row.branch}</span>
        )}
        {row.ahead > 0 && <span className="chip accent"><ArrowUp size={11} /> {row.ahead}</span>}
        {row.behind > 0 && <span className="chip"><ArrowDown size={11} /> {row.behind}</span>}
        {row.dirtyCount > 0 && (
          <span className="chip"><FileWarning size={11} /> {row.dirtyCount} fichier{row.dirtyCount > 1 ? 's' : ''}</span>
        )}
        {row.lastPushAt && <span className="chip">Push {ago(row.lastPushAt)}</span>}
      </div>

      {row.commits?.length > 0 && (
        <ul className="push-commits">
          {row.commits.slice(0, 3).map((c) => (
            <li key={c.fullHash || c.hash}>
              <CircleDot size={10} />
              <code>{c.hash}</code>
              <span className="push-commit-msg" title={c.message}>{c.message}</span>
              <time>{ago(c.at)}</time>
            </li>
          ))}
        </ul>
      )}

      {!row.commits?.length && row.head?.message && (
        <p className="push-card-hint" style={{ marginTop: 8 }}>{row.head.message}</p>
      )}

      <div className="push-card-actions">
        {row.state === 'remote' && (
          <span className="chip"><Github size={11} /> Clone depuis la carte projet</span>
        )}
        {(row.state === 'ahead' || row.state === 'draft' || row.state === 'diverged' || row.state === 'noremote') && !row.remoteOnly && (
          <button type="button" className="btn sm primary" disabled={busy} onClick={push}>
            <CloudUpload size={13} /> {row.state === 'noremote' ? 'Lier / Push' : 'Pousser'}
          </button>
        )}
        {(row.state === 'behind' || row.state === 'diverged') && !row.remoteOnly && (
          <button type="button" className="btn sm" disabled={busy} onClick={pull}>
            <CloudDownload size={13} /> Récupérer
          </button>
        )}
        {row.repo?.url && (
          <button type="button" className="btn sm ghost" onClick={() => api.fs.openUrl(row.repo.url)}>
            <Github size={13} /> Voir
          </button>
        )}
        {row.state === 'synced' && !row.remoteOnly && (
          <button
            type="button"
            className="btn sm ghost"
            onClick={async () => {
              focusProject?.(row.projectId)
              const r = await act(() => api.git.push(row.projectId), 'Rien à pousser — déjà à jour')
              if (r?.ok) toast?.('Dépôt synchronisé')
              onDone?.()
            }}
          >
            <CloudUpload size={13} /> Sync
          </button>
        )}
      </div>
    </article>
  )
}

function shortRepo(path) {
  if (!path) return ''
  const parts = String(path).replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}
