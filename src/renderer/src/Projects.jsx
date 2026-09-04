import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Play, Square, Hammer, FolderOpen, Copy, Trash2, Globe, Plus, Package,
  Code2, Layers, MoreHorizontal, FolderInput, Bookmark, Boxes, ExternalLink,
  Github, CheckSquare, CloudUpload, CloudDownload, Link2, Database, Tag, Search, RefreshCw
} from 'lucide-react'
import { Modal, Menu, Field, SearchBox, LibraryPicker, Empty, bytes, ago, shortPath, Segmented, ScoreNotes, Confirm } from './ui.jsx'
import { GitFields, RepoChip, CloneModal } from './GitFields.jsx'
import { DatabasePicker } from './DatabaseFields.jsx'
import { ProvisionToggle } from './DatabaseCloud.jsx'
import { librariesFor, keepCompatible, filterLibraryItems, countCatalogLibraries } from './compat.js'
import { THEMES, ThemePicker, themeLabel, toggleTheme } from './themes.jsx'
import { categoryLabel, isExperience } from './experienceMeta.js'
import PushBoard from './PushBoard.jsx'
import { ChecklistSnippet, ChecklistModal, checklistStats } from './ProjectChecklist.jsx'
import ProjectDetail from './ProjectDetail.jsx'
import { api } from './bridge.js'

export default function Projects({ state, refresh, toast, focusProject }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const [creating, setCreating] = useState(false)
  const [dup, setDup] = useState(null)
  const [del, setDel] = useState(null)
  const [addLibs, setAddLibs] = useState(null)
  const [builds, setBuilds] = useState({})
  const [menu, setMenu] = useState(null)
  const [repo, setRepo] = useState(null)
  const [db, setDb] = useState(null)
  const [cloning, setCloning] = useState(false)
  const [themeFilter, setThemeFilter] = useState([])
  const [themesFor, setThemesFor] = useState(null)
  const [ideasFor, setIdeasFor] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [busySync, setBusySync] = useState(false)
  const [busyScan, setBusyScan] = useState(false)

  const fwById = useMemo(() => Object.fromEntries(state.frameworks.map((f) => [f.id, f])), [state.frameworks])

  const isLocal = (p) => !p.remoteOnly && p.exists !== false
  const isGithub = (p) => p.remoteOnly || p.repo?.provider === 'github' || /github\.com/i.test(p.repo?.url || '')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.projects.filter((p) => {
      if (scope === 'local' && !isLocal(p)) return false
      if (scope === 'github' && !isGithub(p)) return false
      if (themeFilter.length && !(p.themes || []).some((t) => themeFilter.includes(t))) return false
      if (!q) return true
      if (p.name.toLowerCase().includes(q)) return true
      if ((fwById[p.frameworkId]?.name || '').toLowerCase().includes(q)) return true
      if ((p.repo?.fullName || '').toLowerCase().includes(q)) return true
      return (p.themes || []).some((id) => id.includes(q) || themeLabel(id).toLowerCase().includes(q))
    })
  }, [state.projects, query, fwById, themeFilter, scope])

  const counts = useMemo(() => ({
    all: state.projects.length,
    local: state.projects.filter(isLocal).length,
    github: state.projects.filter(isGithub).length
  }), [state.projects])

  useEffect(() => {
    if (detailId && !state.projects.some((p) => p.id === detailId)) setDetailId(null)
  }, [detailId, state.projects])

  const buildKey = state.projects.map((p) => `${p.id}:${p.lastBuild}`).join()
  useEffect(() => {
    let alive = true
    Promise.all(state.projects.filter((p) => !p.remoteOnly).map((p) => api.run.buildInfo(p.id).then((i) => [p.id, i])))
      .then((rows) => alive && setBuilds(Object.fromEntries(rows)))
    return () => { alive = false }
  }, [buildKey])

  const act = async (fn, okMsg) => {
    const r = await fn()
    if (r?.error) toast(r.error, true)
    else if (okMsg) toast(okMsg)
    refresh()
    return r
  }

  const syncGithub = async () => {
    setBusySync(true)
    try {
      const r = await api.project.syncGithub({ org: state.git?.org || '' })
      if (r?.error) toast(r.error, true)
      else if (r.added === 0) toast(`${r.total || 0} dépôt${(r.total || 0) > 1 ? 's' : ''} GitHub — déjà tous dans la liste`)
      else toast(`${r.added} dépôt${r.added > 1 ? 's' : ''} GitHub ajouté${r.added > 1 ? 's' : ''}`)
      refresh()
    } finally {
      setBusySync(false)
    }
  }

  const scanDisk = async () => {
    setBusyScan(true)
    try {
      const extra = await api.fs.pickDir()
      const roots = [state.workspace]
      if (extra) roots.push(extra)
      const r = await api.project.scan({ roots, maxDepth: 3 })
      if (r?.error) toast(r.error, true)
      else if (!r.added) toast(`${r.found || 0} projet${(r.found || 0) > 1 ? 's' : ''} trouvé${(r.found || 0) > 1 ? 's' : ''} — aucun nouveau`)
      else toast(`${r.added} projet${r.added > 1 ? 's' : ''} ajouté${r.added > 1 ? 's' : ''} depuis le disque`)
      refresh()
    } finally {
      setBusyScan(false)
    }
  }

  const detail = detailId ? state.projects.find((p) => p.id === detailId) : null

  if (detail) {
    return (
      <>
        <ProjectDetail
          project={detail}
          state={state}
          build={builds[detail.id]}
          onBack={() => setDetailId(null)}
          act={act}
          focusProject={focusProject}
          toast={toast}
          onPush={() => setRepo(detail)}
          onIdeas={() => setIdeasFor(detail)}
          onThemes={() => setThemesFor(detail)}
          onDatabase={() => setDb(detail)}
          onRepo={() => setRepo(detail)}
          refresh={refresh}
        />

        {ideasFor && (
          <ChecklistModal
            project={state.projects.find((p) => p.id === ideasFor.id) || ideasFor}
            onClose={() => setIdeasFor(null)}
            act={act}
          />
        )}

        {themesFor && (
          <ThemesModal
            project={state.projects.find((p) => p.id === themesFor.id) || themesFor}
            onClose={() => setThemesFor(null)}
            act={act}
          />
        )}

        {db && (
          <DatabaseModal
            project={state.projects.find((p) => p.id === db.id) || db}
            onClose={() => setDb(null)}
            act={act}
          />
        )}

        {repo && (
          <RepoModal
            project={state.projects.find((p) => p.id === repo.id) || repo}
            state={state}
            onClose={() => setRepo(null)}
            act={act}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="section-head">
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3>Projets</h3>
          <p>{counts.all || 'Aucun'} projet{counts.all > 1 ? 's' : ''} · {shortPath(state.workspace)}</p>
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="Filtrer" />
        <button className="btn" disabled={busySync} onClick={syncGithub} title="Importer les dépôts du compte GitHub connecté (gh)">
          {busySync ? <RefreshCw size={15} className="spin" /> : <Github size={15} />}
          GitHub
        </button>
        <button className="btn" disabled={busyScan} onClick={scanDisk} title="Chercher des projets (package.json) sur le disque">
          {busyScan ? <RefreshCw size={15} className="spin" /> : <Search size={15} />}
          Scanner
        </button>
        <button className="btn" onClick={() => setCloning(true)}>
          <CloudDownload size={15} /> Récupérer
        </button>
        <button className="btn" onClick={async () => {
          const path = await api.fs.pickDir()
          if (path) {
            const r = await api.project.import({ path })
            if (r?.error) toast(r.error, true)
            else toast(r?.repo?.url ? 'Projet ajouté · dépôt détecté' : 'Projet ajouté')
            refresh()
          }
        }}>
          <FolderInput size={15} /> Importer
        </button>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> Nouveau projet
        </button>
        <div className="chip-row" style={{ flexBasis: '100%' }}>
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: `Tous (${counts.all})` },
              { value: 'local', label: `Locaux (${counts.local})` },
              { value: 'github', label: `GitHub (${counts.github})` }
            ]}
          />
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip link${themeFilter.includes(t.id) ? ' accent' : ''}`}
              onClick={() => setThemeFilter((cur) => toggleTheme(cur, t.id))}
              aria-pressed={themeFilter.includes(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <PushBoard
        projects={state.projects}
        toast={toast}
        refreshKey={buildKey + counts.github + (state.pushLog?.length || 0)}
      />

      {list.length === 0 ? (
        <Empty
          icon={<Boxes size={38} color="var(--accent)" strokeWidth={1.4} />}
          title={query || themeFilter.length || scope !== 'all' ? 'Aucun projet ne correspond' : 'Rien à construire pour l’instant'}
          text={query || themeFilter.length || scope !== 'all'
            ? 'Change le filtre ou les thèmes pour retrouver un projet.'
            : 'Crée un projet, synchronise GitHub, ou scanne ton disque.'}
          action={!(query || themeFilter.length) && scope === 'all' && (
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={() => setCreating(true)}><Plus size={15} /> Créer un projet</button>
              <button className="btn" onClick={syncGithub}><Github size={15} /> Sync GitHub</button>
              <button className="btn" onClick={() => setCloning(true)}><CloudDownload size={15} /> Récupérer un dépôt</button>
            </div>
          )}
        />
      ) : (
        <div className="grid">
          {list.map((p, i) => (
            <ProjectCard
              key={p.id}
              index={i}
              project={p}
              framework={fwById[p.frameworkId]}
              build={builds[p.id]}
              onOpen={() => setDetailId(p.id)}
              onMenu={(el) => setMenu(menu?.id === p.id ? null : { id: p.id, el })}
              onTheme={(id) => setThemeFilter((cur) => toggleTheme(cur, id))}
              onPush={() => setRepo(p)}
              onIdeas={() => setIdeasFor(p)}
              act={act}
              focusProject={focusProject}
              toast={toast}
            />
          ))}
        </div>
      )}

      {menu && (
        <ProjectMenu
          project={state.projects.find((p) => p.id === menu.id)}
          anchor={menu.el}
          editor={state.editor}
          onClose={() => setMenu(null)}
          onDuplicate={(p) => setDup({ project: p, name: `${p.name} copie` })}
          onDelete={setDel}
          onAddLibs={setAddLibs}
          onRepo={setRepo}
          onDatabase={setDb}
          onThemes={setThemesFor}
          onIdeas={setIdeasFor}
          onOpen={(p) => setDetailId(p.id)}
          act={act}
        />
      )}

      {ideasFor && (
        <ChecklistModal
          project={state.projects.find((p) => p.id === ideasFor.id) || ideasFor}
          onClose={() => setIdeasFor(null)}
          act={act}
        />
      )}

      {creating && (
        <NewProject
          state={state}
          onClose={() => setCreating(false)}
          onDone={async (payload) => {
            setCreating(false)
            focusProject(null)
            const r = await api.project.create(payload)
            if (!r.ok) toast(r.error || 'Création interrompue', true)
            else if (r.gitError) toast(`${payload.name} est prêt, mais le dépôt a échoué : ${r.gitError}`, true)
            else toast(r.repo?.url ? `${payload.name} est prêt · dépôt créé` : `${payload.name} est prêt`)
            refresh()
          }}
        />
      )}

      {cloning && (
        <CloneModal
          state={state}
          onClose={() => setCloning(false)}
          onDone={(r) => {
            setCloning(false)
            if (!r?.ok) toast(r?.error || 'Clonage impossible', true)
            else {
              focusProject(r.id)
              if (r.installError) toast(`${r.repo?.name || 'Dépôt'} cloné, mais les dépendances ont échoué.`, true)
              else toast(`${r.repo?.name || 'Dépôt'} est dans l’atelier`)
            }
            refresh()
          }}
        />
      )}

      {dup && (
        <Modal
          title="Dupliquer le projet"
          subtitle={`Copie de ${dup.project.name}, sans node_modules ni build. Les dépendances sont réinstallées ensuite.`}
          onClose={() => setDup(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setDup(null)}>Annuler</button>
              <button className="btn primary" disabled={!dup.name.trim()} onClick={async () => {
                const t = dup
                setDup(null)
                focusProject(null)
                await act(() => api.project.duplicate({ id: t.project.id, name: t.name.trim() }), 'Projet dupliqué')
              }}><Copy size={15} /> Dupliquer</button>
            </>
          }
        >
          <Field label="Nom du nouveau projet">
            <input className="input" autoFocus value={dup.name} onChange={(e) => setDup({ ...dup, name: e.target.value })} />
          </Field>
        </Modal>
      )}

      {addLibs && (
        <AddLibs
          project={addLibs}
          state={state}
          onClose={() => setAddLibs(null)}
          onDone={async (libs) => {
            const p = addLibs
            setAddLibs(null)
            focusProject(p.id)
            await act(() => api.project.addLibs({ id: p.id, libs }), 'Librairies installées')
          }}
        />
      )}

      {repo && (
        <RepoModal
          project={repo}
          state={state}
          onClose={() => setRepo(null)}
          act={act}
        />
      )}

      {db && (
        <DatabaseModal
          project={db}
          onClose={() => setDb(null)}
          act={act}
        />
      )}

      {themesFor && (
        <ThemesModal
          project={themesFor}
          onClose={() => setThemesFor(null)}
          act={act}
        />
      )}

      {del && (
        <Modal
          title={`Supprimer ${del.name} ?`}
          subtitle="Le projet quitte la liste. Tu choisis si les fichiers partent aussi à la corbeille."
          onClose={() => setDel(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setDel(null)}>Annuler</button>
              <button className="btn" onClick={async () => {
                const t = del; setDel(null)
                await act(() => api.project.remove({ id: t.id, deleteFiles: false }), 'Retiré de la liste')
              }}>Retirer de la liste</button>
              <button className="btn danger" onClick={async () => {
                const t = del; setDel(null)
                await act(() => api.project.remove({ id: t.id, deleteFiles: true }), 'Envoyé à la corbeille')
              }}><Trash2 size={15} /> Supprimer les fichiers</button>
            </>
          }
        >
          <div className="card-path" style={{ direction: 'rtl', textAlign: 'left' }}>{del.path}</div>
        </Modal>
      )}
    </>
  )
}

/* ─────────────────────────  carte projet  ───────────────────────── */

function ProjectCard({ project: p, framework: fw, build, index, onOpen, onMenu, onTheme, onPush, onIdeas, act, focusProject, toast }) {
  const btnRef = useRef(null)
  const remote = Boolean(p.remoteOnly)
  const busy = p.status === 'scaffolding' || p.status === 'cloning'
  const live = !remote && (p.status === 'running' || p.status === 'starting')
  const needsPush = !remote && !p.repo?.url
  const ideas = checklistStats(p.checklist)

  const statusLabel = remote ? 'Sur GitHub · pas encore local'
    : p.status === 'cloning' ? 'Clonage du dépôt'
    : busy ? 'Installation en cours'
    : p.status === 'running' ? 'Serveur actif'
    : p.status === 'starting' ? 'Démarrage'
    : p.status === 'error' ? 'Dernière opération en échec'
    : p.lastBuild ? `Build ${ago(p.lastBuild)}`
    : 'Prêt'

  const fetchRemote = async () => {
    focusProject(p.id)
    const r = await act(() => api.project.fetchRemote(p.id))
    if (r?.ok && !r.error) toast(r.alreadyLocal ? 'Déjà présent en local' : 'Dépôt cloné dans l’atelier')
  }

  const stop = (e) => e.stopPropagation()

  return (
    <article
      className={`card interactive proj-card${live ? ' live' : ''}${remote ? ' remote' : ''}`}
      style={{ '--i': Math.min(index, 8) }}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.() } }}
      role="button"
      tabIndex={0}
      aria-label={`Ouvrir ${p.name}`}
    >
      <div className="card-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 className="card-title">{p.name}</h4>
          <div className="card-path" title={p.path}>
            {remote ? (p.repo?.fullName || p.repo?.url || 'GitHub') : shortPath(p.path, 40)}
          </div>
        </div>
        <button
          ref={btnRef}
          className="btn icon sm ghost"
          aria-label="Plus d'actions"
          aria-haspopup="menu"
          onClick={(e) => { stop(e); onMenu(btnRef.current) }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="chip-row" onClick={stop}>
        {remote
          ? <span className="chip"><Github size={11} /> Distant</span>
          : <span className="chip accent">{fw?.name || 'Framework retiré'}</span>}
        {!remote && (p.themes || []).map((id) => (
          <button type="button" className="chip link" key={id} onClick={() => onTheme(id)}>{themeLabel(id)}</button>
        ))}
        {!remote && p.libs?.length > 0 && <span className="chip"><Package size={11} /> {p.libs.length}</span>}
        {!remote && p.databaseId && p.databaseId !== 'none' && (
          <span className="chip"><Database size={11} /> {p.databaseId}</span>
        )}
        {build?.exists && <span className="chip ok">build {bytes(build.size)}</span>}
        <RepoChip repo={p.repo} onOpen={(url) => api.fs.openUrl(url)} />
        {!remote && p.exists === false && <span className="chip err">dossier introuvable</span>}
        {needsPush && <span className="chip">Sans remote</span>}
        {ideas.total > 0 && (
          <button type="button" className={`chip link${ideas.open ? ' accent' : ''}`} onClick={onIdeas}>
            <CheckSquare size={11} /> {ideas.done}/{ideas.total} idées
          </button>
        )}
      </div>

      <div className="status" onClick={stop}>
        <span className={`pulse ${busy ? 'starting' : remote ? 'remote' : p.status === 'error' ? 'error' : p.status || ''}`} />
        <span>{statusLabel}</span>
        {p.status === 'running' && p.url && (
          <a href="#" onClick={(e) => { e.preventDefault(); api.fs.openUrl(p.url) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
            {p.url.replace(/^https?:\/\//, '')} <ExternalLink size={11} />
          </a>
        )}
      </div>

      {!remote && (
        <div onClick={stop}>
          <ChecklistSnippet project={p} onOpen={onIdeas} act={act} />
        </div>
      )}

      {busy && <div className="progress"><i /></div>}

      <div className="card-actions" onClick={stop}>
        {remote ? (
          <>
            <button className="btn sm primary" disabled={busy} onClick={fetchRemote}>
              <CloudDownload size={13} /> Cloner
            </button>
            {p.repo?.url && (
              <button className="btn sm ghost" onClick={() => api.fs.openUrl(p.repo.url)}>
                <Github size={13} /> Voir
              </button>
            )}
          </>
        ) : live ? (
          <>
            <button className="btn sm" onClick={() => act(() => api.run.stop(p.id))}><Square size={13} /> Arrêter</button>
            {p.url && <button className="btn sm" onClick={() => api.fs.openUrl(p.url)}><Globe size={13} /> Ouvrir</button>}
          </>
        ) : (
          <button className="btn sm primary" disabled={busy}
            onClick={() => { focusProject(p.id); act(() => api.run.dev(p.id)) }}>
            <Play size={13} /> Lancer
          </button>
        )}
        {!remote && (
          <>
            <button className="btn sm" disabled={busy}
              onClick={() => { focusProject(p.id); act(() => api.run.build(p.id), 'Build terminé') }}>
              <Hammer size={13} /> Build
            </button>
            {p.repo?.url && !needsPush && (
              <button
                className="btn sm"
                disabled={busy}
                onClick={() => { focusProject(p.id); act(() => api.git.pull(p.id), 'Code récupéré depuis GitHub') }}
                title="git pull — récupérer les derniers changements"
              >
                <CloudDownload size={13} /> Pull
              </button>
            )}
            {needsPush && (
              <button className="btn sm" onClick={onPush}>
                <CloudUpload size={13} /> Push GitHub
              </button>
            )}
            {!needsPush && p.repo?.url && (
              <button
                className="btn sm ghost"
                disabled={busy || live}
                onClick={() => { focusProject(p.id); act(() => api.git.push(p.id), 'Push envoyé') }}
                title="Pousser les commits locaux"
              >
                <CloudUpload size={13} /> Push
              </button>
            )}
            <button className="btn sm ghost" onClick={() => act(() => api.run.openBuild(p.id))}>
              <FolderOpen size={13} /> Sortie
            </button>
            {build?.exists && (
              <button className="btn sm ghost" onClick={() => act(() => api.run.openBuildFile(p.id))}>Aperçu</button>
            )}
          </>
        )}
      </div>
    </article>
  )
}

function ProjectMenu({ project: p, anchor, editor, onClose, onDuplicate, onDelete, onAddLibs, onRepo, onDatabase, onThemes, onIdeas, onOpen, act }) {
  if (!p) return null
  const run = (fn) => { onClose(); fn() }
  const remote = Boolean(p.remoteOnly)

  if (remote) {
    return (
      <Menu anchor={anchor} onClose={onClose}>
        <button onClick={() => run(() => onOpen?.(p))}><Boxes size={15} /> Voir le détail</button>
        {p.repo?.url && (
          <button onClick={() => run(() => api.fs.openUrl(p.repo.url))}><Github size={15} /> Ouvrir sur GitHub</button>
        )}
        <button onClick={() => run(() => act(() => api.project.fetchRemote(p.id), 'Dépôt cloné'))}>
          <CloudDownload size={15} /> Cloner dans l’atelier
        </button>
        <hr />
        <button className="danger" onClick={() => run(() => onDelete(p))}><Trash2 size={15} /> Retirer de la liste</button>
      </Menu>
    )
  }

  return (
    <Menu anchor={anchor} onClose={onClose}>
      <button onClick={() => run(() => onOpen?.(p))}><Boxes size={15} /> Voir le détail</button>
      <button onClick={() => run(() => api.editor.open({ path: p.path, editor }))}><Code2 size={15} /> Ouvrir dans l’éditeur</button>
      <button onClick={() => run(() => api.fs.reveal(p.path))}><FolderOpen size={15} /> Révéler le dossier</button>
      <hr />
      {p.repo?.url ? (
        <>
          <button onClick={() => run(() => api.fs.openUrl(p.repo.url))}><Github size={15} /> Ouvrir le dépôt</button>
          <button onClick={() => run(() => act(() => api.git.pull(p.id), 'Dépôt à jour'))}><CloudDownload size={15} /> Récupérer les changements</button>
          <button onClick={() => run(() => act(() => api.git.push(p.id), 'Push envoyé'))}><CloudUpload size={15} /> Pousser les changements</button>
        </>
      ) : (
        <button onClick={() => run(() => onRepo(p))}><CloudUpload size={15} /> Pousser sur GitHub</button>
      )}
      <hr />
      <button onClick={() => run(() => onOpen?.(p))}><Package size={15} /> Librairies du projet</button>
      <button onClick={() => run(() => onAddLibs(p))}><Package size={15} /> Ajouter des librairies</button>
      {(p.status === 'error' || p.status === 'scaffolding') && (
        <button onClick={() => run(() => act(() => api.project.repair(p.id), 'Projet régénéré'))}>
          <Hammer size={15} /> Régénérer le scaffold
        </button>
      )}
      <button onClick={() => run(() => onDatabase(p))}><Database size={15} /> Configurer la base</button>
      <button onClick={() => run(() => onThemes(p))}><Tag size={15} /> Thèmes</button>
      <button onClick={() => run(() => onIdeas(p))}><CheckSquare size={15} /> Idées</button>
      <button onClick={() => run(() => onDuplicate(p))}><Copy size={15} /> Dupliquer</button>
      <button onClick={() => run(() => act(() => api.blueprint.fromProject({ id: p.id, name: `Base ${p.name}` }), 'Blueprint créé'))}>
        <Bookmark size={15} /> En faire un blueprint
      </button>
      <hr />
      <button className="danger" onClick={() => run(() => onDelete(p))}><Trash2 size={15} /> Supprimer</button>
    </Menu>
  )
}

/* ─────────────────────  création de projet  ───────────────────── */

function NewProject({ state, onClose, onDone }) {
  const saved = state.git || {}
  const [name, setName] = useState('')
  const [frameworkId, setFrameworkId] = useState(state.frameworks[0]?.id || '')
  const [blueprintId, setBlueprintId] = useState('')
  const [libs, setLibs] = useState([])
  const [libQuery, setLibQuery] = useState('')
  const [databaseId, setDatabaseId] = useState(state.database?.defaultId || 'none')
  const [provision, setProvision] = useState(state.database?.autoCreate !== false)
  const [cloudReady, setCloudReady] = useState(false)
  const [workspace, setWorkspace] = useState(state.workspace)
  const [gitStatus, setGitStatus] = useState(null)
  const [themes, setThemes] = useState([])
  const [git, setGit] = useState({
    create: saved.autoCreate !== false,
    provider: saved.provider || 'github',
    visibility: saved.visibility || 'private',
    org: saved.org || '',
    name: ''
  })

  useEffect(() => { api.git.status().then(setGitStatus) }, [])
  useEffect(() => {
    api.database.list().then((r) => {
      setCloudReady(Boolean(r?.cloud?.find((c) => c.id === databaseId)?.ready))
    }).catch(() => {})
  }, [databaseId])

  const fw = state.frameworks.find((f) => f.id === frameworkId)
  const compatible = useMemo(() => librariesFor(state.libraries, fw), [state.libraries, fw])
  const visibleLibs = useMemo(() => filterLibraryItems(compatible, libQuery), [compatible, libQuery])
  const catalogCount = useMemo(() => countCatalogLibraries(state.libraries), [state.libraries])
  const compatibleCount = useMemo(
    () => visibleLibs.reduce((n, c) => n + c.items.length, 0),
    [visibleLibs]
  )
  const slug = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  useEffect(() => {
    setLibs((l) => keepCompatible(l, state.libraries, fw))
  }, [frameworkId, state.libraries])

  const applyBlueprint = (id) => {
    setBlueprintId(id)
    if (!id) return
    const bp = state.blueprints.find((b) => b.id === id)
    if (!bp) return
    const nextFw = state.frameworks.find((f) => f.id === bp.frameworkId)
    setFrameworkId(bp.frameworkId)
    setLibs(keepCompatible(bp.libs || [], state.libraries, nextFw))
    if (bp.databaseId) setDatabaseId(bp.databaseId)
    setThemes(bp.themes || [])
  }

  const selectedBp = state.blueprints.find((b) => b.id === blueprintId)

  return (
    <Modal
      title="Nouveau projet"
      subtitle="Choisis une expérience, puis affine la stack. Les fichiers et le brief suivent."
      onClose={onClose}
      width="min(1080px, 100%)"
      footer={
        <>
          <div className="new-project-foot">
            {selectedBp && <span className="chip accent">{selectedBp.name}</span>}
            {themes.map((id) => <span className="chip" key={id}>{themeLabel(id)}</span>)}
            {fw && <span className="chip">{fw.name}</span>}
            {libs.length > 0 && <span className="chip"><Package size={11} /> {libs.length}</span>}
          </div>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!slug || !frameworkId}
            onClick={() => onDone({
              name: name.trim(),
              frameworkId,
              libs,
              databaseId,
              provision,
              blueprintId: blueprintId || null,
              workspace,
              themes,
              notes: selectedBp?.intent || '',
              git: { ...git, name: git.name.trim() || slug }
            })}>
            <Layers size={15} /> Créer le projet
          </button>
        </>
      }
    >
      <section className="form-section">
        <h4>Identité</h4>
        <Field label="Nom du projet" hint={slug ? `Dossier : ${slug}` : 'Le dossier reprend ce nom, en minuscules.'}>
          <input className="input" autoFocus placeholder="Portfolio 2026" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <ThemePicker value={themes} onChange={setThemes} />
      </section>

      <section className="form-section">
        <h4>Expérience de départ</h4>
        <p className="form-section-lead">Un blueprint préremplit framework, libs, tokens et un brief EXPERIENCE.md.</p>
        <div className="bp-pick-grid" role="radiogroup" aria-label="Blueprint">
          <button
            type="button"
            role="radio"
            aria-checked={!blueprintId}
            className={`bp-pick${!blueprintId ? ' on' : ''}`}
            onClick={() => { setBlueprintId(''); }}
          >
            <strong>Partir de zéro</strong>
            <span>Tu choisis tout à la main.</span>
          </button>
          {state.blueprints.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={blueprintId === b.id}
              className={`bp-pick${blueprintId === b.id ? ' on' : ''}${isExperience(b) ? ' xp' : ''}`}
              onClick={() => applyBlueprint(b.id)}
            >
              <div className="bp-pick-top">
                {isExperience(b) && <span className="chip accent" style={{ height: 18, fontSize: 10 }}>XP</span>}
                {b.category && <span className="chip" style={{ height: 18, fontSize: 10 }}>{categoryLabel(b.category)}</span>}
              </div>
              <strong>{b.name}</strong>
              <span>{b.tagline || b.description || 'Base réutilisable'}</span>
            </button>
          ))}
        </div>
        {selectedBp?.intent && (
          <div className="bp-selected-brief">
            <p><strong>Intention</strong> — {selectedBp.intent}</p>
            {selectedBp.audience && <p><strong>Public</strong> — {selectedBp.audience}</p>}
            {selectedBp.vibe && <p><strong>Ambiance</strong> — {selectedBp.vibe}</p>}
          </div>
        )}
      </section>

      <section className="form-section">
        <h4>Stack</h4>
        <Field label="Framework" hint={fw?.description}>
          <div className="fw-grid" role="radiogroup" aria-label="Framework">
            {state.frameworks.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={frameworkId === f.id}
                className={`fw-pick${frameworkId === f.id ? ' on' : ''}`}
                onClick={() => setFrameworkId(f.id)}
              >
                <strong>{f.name}</strong>
                <span>{f.tag}</span>
              </button>
            ))}
          </div>
          <ScoreNotes scores={fw?.scores} />
        </Field>
        <DatabasePicker value={databaseId} onChange={setDatabaseId} />
        <ProvisionToggle databaseId={databaseId} ready={cloudReady} value={provision} onChange={setProvision} />
      </section>

      <section className="form-section form-section-libraries">
        <div className="form-section-top">
          <div>
            <h4>Librairies</h4>
            <p className="form-section-lead">
              {fw
                ? `${compatibleCount} compatible${compatibleCount > 1 ? 's' : ''} sur ${catalogCount} pour ${fw.name}.`
                : 'Choisis d’abord un framework.'}
            </p>
          </div>
          {libs.length > 0 && (
            <span className="chip accent"><Package size={11} /> {libs.length} sélectionnée{libs.length > 1 ? 's' : ''}</span>
          )}
        </div>
        <LibraryPicker
          layout="explore"
          categories={visibleLibs}
          selected={libs}
          query={libQuery}
          onQueryChange={setLibQuery}
          showScores
          framework={fw}
          catalogCount={catalogCount}
          onToggle={(pkg) => setLibs((l) => (l.includes(pkg) ? l.filter((x) => x !== pkg) : [...l, pkg]))}
          empty={<p className="card-desc" style={{ margin: 0 }}>Aucun paquet compatible ne correspond à ta recherche.</p>}
        />
      </section>

      <details className="form-advanced">
        <summary>Emplacement & dépôt distant</summary>
        <div className="form-advanced-body">
          <Field label="Dossier parent">
            <div className="row">
              <input className="input mono" value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
              <button type="button" className="btn none" onClick={async () => { const d = await api.fs.pickDir(); if (d) setWorkspace(d) }}>Choisir</button>
            </div>
          </Field>
          <Field label="Dépôt distant" hint="Prérempli depuis Réglages. Change-le seulement pour ce projet.">
            <Segmented
              value={git.create ? 'yes' : 'no'}
              onChange={(v) => setGit({ ...git, create: v === 'yes' })}
              options={[
                { value: 'yes', label: 'Créer un dépôt' },
                { value: 'no', label: 'Pas maintenant' }
              ]}
            />
          </Field>
          {git.create && (
            <>
              <GitFields value={git} onChange={setGit} status={gitStatus} />
              <Field label="Nom du dépôt" hint={slug ? `Par défaut : ${slug}` : 'Reprend le nom du dossier.'}>
                <input className="input mono" placeholder={slug || 'mon-projet'} value={git.name} onChange={(e) => setGit({ ...git, name: e.target.value })} />
              </Field>
            </>
          )}
        </div>
      </details>
    </Modal>
  )
}

function AddLibs({ project, state, onClose, onDone }) {
  const [libs, setLibs] = useState([])
  const [libQuery, setLibQuery] = useState('')
  const fw = state.frameworks.find((f) => f.id === project.frameworkId)
  const cats = useMemo(() => filterLibraryItems(
    librariesFor(state.libraries, fw)
      .map((c) => ({ ...c, items: c.items.filter((i) => !project.libs?.includes(i.pkg)) }))
      .filter((c) => c.items.length),
    libQuery
  ), [state.libraries, fw, project.libs, libQuery])

  return (
    <Modal
      title={`Ajouter des librairies à ${project.name}`}
      subtitle={fw ? `Paquets compatibles avec ${fw.name}, absents de ce projet.` : 'Installation via npm dans le projet existant.'}
      onClose={onClose}
      width="min(1080px, 100%)"
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!libs.length} onClick={() => onDone(libs)}>
            <Package size={15} /> Installer {libs.length || ''}
          </button>
        </>
      }
    >
      <LibraryPicker
        layout="explore"
        categories={cats}
        selected={libs}
        query={libQuery}
        onQueryChange={setLibQuery}
        showScores
        framework={fw}
        catalogCount={countCatalogLibraries(state.libraries)}
        onToggle={(pkg) => setLibs((l) => (l.includes(pkg) ? l.filter((x) => x !== pkg) : [...l, pkg]))}
      />
    </Modal>
  )
}

function RepoModal({ project, state, onClose, act }) {
  const saved = state.git || {}
  const [mode, setMode] = useState(project.repo?.remote ? 'link' : 'create')
  const [url, setUrl] = useState(project.repo?.remote || '')
  const [detecting, setDetecting] = useState(false)
  const [gitStatus, setGitStatus] = useState(null)
  const [description, setDescription] = useState(`Projet ${project.name} — PDC Builder`)
  const [git, setGit] = useState({
    provider: saved.provider || 'github',
    visibility: saved.visibility || 'private',
    org: saved.org || '',
    name: project.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  })

  useEffect(() => { api.git.status().then(setGitStatus) }, [])

  useEffect(() => {
    if (project.repo?.remote) return
    let alive = true
    setDetecting(true)
    api.git.detect(project.id).then((r) => {
      if (!alive) return
      if (r?.ok && r.repo?.remote) {
        setUrl(r.repo.remote)
        setMode('link')
      }
    }).finally(() => { if (alive) setDetecting(false) })
    return () => { alive = false }
  }, [project.id, project.repo?.remote])

  const publish = async () => {
    onClose()
    await act(
      () => api.git.publish({
        id: project.id,
        options: { ...git, create: true, description: description.trim() || undefined }
      }),
      'Dépôt créé et poussé sur GitHub'
    )
  }

  return (
    <Modal
      title={project.repo?.url ? `Dépôt · ${project.name}` : `Pousser sur GitHub · ${project.name}`}
      subtitle={project.repo?.url
        ? 'Dépôt déjà lié — tu peux le modifier ou en créer un nouveau.'
        : detecting
          ? 'Recherche d’un remote origin dans le dossier…'
          : 'Renseigne le nom, la visibilité et l’organisation, puis valide pour créer le dépôt et pousser.'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          {mode === 'link' ? (
            <button className="btn primary" disabled={!url.trim()} onClick={async () => {
              onClose()
              await act(() => api.git.link({ id: project.id, url: url.trim() }), 'Dépôt lié')
            }}><Link2 size={15} /> Lier</button>
          ) : (
            <button className="btn primary" disabled={!git.name.trim()} onClick={publish}>
              <CloudUpload size={15} /> Créer et pousser
            </button>
          )}
        </>
      }
    >
      <Field label="Action">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'create', label: 'Créer & pousser' },
            { value: 'link', label: 'Lier un existant' }
          ]}
        />
      </Field>
      {mode === 'create' ? (
        <>
          <GitFields value={git} onChange={setGit} status={gitStatus} />
          <Field label="Nom du dépôt" hint="Tel qu’il apparaîtra sur GitHub.">
            <input className="input mono" value={git.name} onChange={(e) => setGit({ ...git, name: e.target.value })} />
          </Field>
          <Field label="Description" hint="Facultatif. Visible sur la page du dépôt.">
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </>
      ) : (
        <Field label="URL du remote" hint="https://github.com/org/repo.git ou l’URL Cursor Origin.">
          <input className="input mono" autoFocus placeholder="https://github.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
      )}
    </Modal>
  )
}

function DatabaseModal({ project, onClose, act }) {
  const [databaseId, setDatabaseId] = useState(project.databaseId || 'none')
  const [provision, setProvision] = useState(true)
  const [ready, setReady] = useState(false)
  const [ask, setAsk] = useState(false)
  useEffect(() => {
    api.database.list().then((r) => {
      setReady(Boolean(r?.cloud?.find((c) => c.id === databaseId)?.ready))
    }).catch(() => {})
  }, [databaseId])

  const apply = async () => {
    onClose()
    await act(
      () => api.database.apply({ id: project.id, databaseId, provision }),
      databaseId === 'none' ? 'Aucune base configurée' : `Base ${databaseId} configurée`
    )
  }

  const overwrite = project.databaseId && project.databaseId !== 'none' && project.databaseId !== databaseId

  return (
    <>
    <Modal
      title={`Base de données · ${project.name}`}
      subtitle="Client, .env, et — si le compte est prêt — création de la base distante."
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={() => (overwrite ? setAsk(true) : apply())}>
            <Database size={15} /> Appliquer
          </button>
        </>
      }
    >
      <DatabasePicker value={databaseId} onChange={setDatabaseId} />
      <ProvisionToggle databaseId={databaseId} ready={ready} value={provision} onChange={setProvision} />
    </Modal>
    {ask && (
      <Confirm
        title={`Remplacer ${project.databaseId} ?`}
        subtitle={`Le client et le .env seront réécrits pour ${databaseId === 'none' ? 'aucune base' : databaseId}.`}
        confirm="Remplacer"
        onClose={() => setAsk(false)}
        onConfirm={apply}
      />
    )}
    </>
  )
}

function ThemesModal({ project, onClose, act }) {
  const [themes, setThemes] = useState(project.themes || [])
  return (
    <Modal
      title={`Thèmes · ${project.name}`}
      subtitle="Ce que le projet est. Ça sert à filtrer la liste."
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn primary"
            onClick={async () => {
              onClose()
              await act(
                () => api.project.update({ id: project.id, fields: { themes } }),
                'Thèmes enregistrés'
              )
            }}
          >
            Enregistrer
          </button>
        </>
      }
    >
      <ThemePicker value={themes} onChange={setThemes} />
    </Modal>
  )
}
