import { useMemo, useState } from 'react'
import {
  ArrowLeft, Play, Square, Hammer, Package, Plus, Github, CloudDownload, CloudUpload,
  Globe, ExternalLink, FolderOpen, Code2, Database, CheckSquare, Tag, GanttChart
} from 'lucide-react'
import { LibraryPicker, bytes, ago, shortPath, Empty } from './ui.jsx'
import { RepoChip } from './GitFields.jsx'
import { librariesFor, filterLibraryItems, countCatalogLibraries } from './compat.js'
import { themeLabel } from './themes.jsx'
import { ChecklistSnippet, checklistStats } from './ProjectChecklist.jsx'
import { StagesPanel, stagesStats } from './ProjectStages.jsx'
import { api } from './bridge.js'

function catalogIndex(libraries) {
  const map = new Map()
  for (const cat of libraries || []) {
    for (const item of cat.items || []) {
      map.set(item.pkg, { ...item, category: cat.name, categoryId: cat.id })
    }
  }
  return map
}

export default function ProjectDetail({
  project: p,
  state,
  build,
  onBack,
  act,
  focusProject,
  toast,
  onPush,
  onIdeas,
  onThemes,
  onDatabase,
  onRepo,
  refresh
}) {
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState([])
  const [libQuery, setLibQuery] = useState('')
  const [installing, setInstalling] = useState(false)

  const fw = state.frameworks.find((f) => f.id === p.frameworkId)
  const byPkg = useMemo(() => catalogIndex(state.libraries), [state.libraries])
  const installed = useMemo(() => (p.libs || []).map((pkg) => byPkg.get(pkg) || {
    pkg,
    name: pkg.split('/').pop() || pkg,
    description: 'Paquet hors catalogue PDC.',
    category: 'Autre'
  }), [p.libs, byPkg])

  const available = useMemo(() => filterLibraryItems(
    librariesFor(state.libraries, fw)
      .map((c) => ({ ...c, items: c.items.filter((i) => !(p.libs || []).includes(i.pkg)) }))
      .filter((c) => c.items.length),
    libQuery
  ), [state.libraries, fw, p.libs, libQuery])

  const remote = Boolean(p.remoteOnly)
  const busy = p.status === 'scaffolding' || p.status === 'cloning'
  const live = !remote && (p.status === 'running' || p.status === 'starting')
  const ideas = checklistStats(p.checklist)
  const stages = stagesStats(p.stages)
  const catalogCount = countCatalogLibraries(state.libraries)

  const grouped = useMemo(() => {
    const map = new Map()
    for (const item of installed) {
      const key = item.category || 'Autre'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    return [...map.entries()]
  }, [installed])

  const installPicked = async () => {
    if (!picked.length) return
    setInstalling(true)
    focusProject(p.id)
    try {
      const r = await act(() => api.project.addLibs({ id: p.id, libs: picked }), null)
      if (r?.error || r?.ok === false) toast(r.error || 'Installation échouée', true)
      else {
        toast(`${picked.length} librairie${picked.length > 1 ? 's' : ''} installée${picked.length > 1 ? 's' : ''}`)
        setPicked([])
        setAdding(false)
        setLibQuery('')
      }
      refresh?.()
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="proj-detail">
      <div className="proj-detail-top">
        <button type="button" className="btn ghost" onClick={onBack}>
          <ArrowLeft size={15} /> Projets
        </button>
        <div className="spacer" />
        {!remote && (
          <>
            <button type="button" className="btn" onClick={() => api.editor.open({ path: p.path, editor: state.editor })}>
              <Code2 size={15} /> Éditeur
            </button>
            <button type="button" className="btn" onClick={() => api.fs.reveal(p.path)}>
              <FolderOpen size={15} /> Dossier
            </button>
          </>
        )}
      </div>

      <header className="proj-detail-hero">
        <div className="proj-detail-identity">
          <h3>{p.name}</h3>
          <p className="proj-detail-path" title={p.path}>
            {remote ? (p.repo?.fullName || p.repo?.url || 'GitHub') : shortPath(p.path, 64)}
          </p>
          <div className="chip-row">
            {remote
              ? <span className="chip"><Github size={11} /> Distant</span>
              : <span className="chip accent">{fw?.name || 'Framework retiré'}</span>}
            {(p.themes || []).map((id) => (
              <span className="chip" key={id}><Tag size={11} /> {themeLabel(id)}</span>
            ))}
            {p.databaseId && p.databaseId !== 'none' && (
              <span className="chip"><Database size={11} /> {p.databaseId}</span>
            )}
            {build?.exists && <span className="chip ok">build {bytes(build.size)}</span>}
            <RepoChip repo={p.repo} onOpen={(url) => api.fs.openUrl(url)} />
            {ideas.total > 0 && (
              <button type="button" className="chip link accent" onClick={onIdeas}>
                <CheckSquare size={11} /> {ideas.done}/{ideas.total} idées
              </button>
            )}
            {stages.total > 0 && (
              <span className="chip accent">
                <GanttChart size={11} /> {stages.done}/{stages.total} étapes
              </span>
            )}
          </div>
        </div>

        <div className="proj-detail-actions">
          {remote ? (
            <button className="btn primary" disabled={busy} onClick={() => act(() => api.project.fetchRemote(p.id), 'Dépôt cloné')}>
              <CloudDownload size={15} /> Cloner
            </button>
          ) : live ? (
            <>
              <button className="btn" onClick={() => act(() => api.run.stop(p.id), 'Arrêté')}>
                <Square size={15} /> Arrêter
              </button>
              {p.url && (
                <button className="btn primary" onClick={() => api.fs.openUrl(p.url)}>
                  <Globe size={15} /> Ouvrir
                </button>
              )}
            </>
          ) : (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => { focusProject(p.id); act(() => api.run.dev(p.id)) }}
            >
              <Play size={15} /> Lancer
            </button>
          )}
          {!remote && (
            <>
              <button className="btn" disabled={busy} onClick={() => { focusProject(p.id); act(() => api.run.build(p.id), 'Build terminé') }}>
                <Hammer size={15} /> Build
              </button>
              {p.repo?.url ? (
                <>
                  <button className="btn" disabled={busy} onClick={() => { focusProject(p.id); act(() => api.git.pull(p.id), 'Code récupéré') }}>
                    <CloudDownload size={15} /> Pull
                  </button>
                  <button className="btn" disabled={busy || live} onClick={() => { focusProject(p.id); act(() => api.git.push(p.id), 'Push envoyé') }}>
                    <CloudUpload size={15} /> Push
                  </button>
                </>
              ) : (
                <button className="btn" onClick={onPush}>
                  <CloudUpload size={15} /> Lier GitHub
                </button>
              )}
              <button className="btn ghost" onClick={onThemes}>Thèmes</button>
              <button className="btn ghost" onClick={onDatabase}>Base</button>
              {!p.repo?.url && <button className="btn ghost" onClick={onRepo}>Dépôt</button>}
            </>
          )}
        </div>
      </header>

      {!remote && (
        <div className="proj-detail-ideas">
          <ChecklistSnippet project={p} onOpen={onIdeas} act={act} />
        </div>
      )}

      {!remote && (
        <section className="proj-detail-section">
          <div className="proj-detail-section-head">
            <div>
              <h4>Planning</h4>
              <p>
                {stages.total
                  ? `${stages.total} étape${stages.total > 1 ? 's' : ''} · vue Gantt`
                  : 'Découpe le projet en phases datées'}
              </p>
            </div>
          </div>
          <StagesPanel project={p} act={act} />
        </section>
      )}

      <section className="proj-detail-section">
        <div className="proj-detail-section-head">
          <div>
            <h4>Librairies</h4>
            <p>
              {installed.length
                ? `${installed.length} paquet${installed.length > 1 ? 's' : ''} dans ce projet`
                : 'Aucune librairie enregistrée pour l’instant'}
            </p>
          </div>
          {!remote && (
            <button
              type="button"
              className={`btn${adding ? '' : ' primary'}`}
              disabled={busy}
              onClick={() => { setAdding((v) => !v); setPicked([]); setLibQuery('') }}
            >
              {adding ? 'Fermer le catalogue' : <><Plus size={15} /> Ajouter</>}
            </button>
          )}
        </div>

        {adding && !remote && (
          <div className="proj-detail-add">
            <p className="form-section-lead">
              Catalogue PDC compatible avec {fw?.name || 'ce framework'} — déjà présentes exclues.
            </p>
            <LibraryPicker
              layout="explore"
              categories={available}
              selected={picked}
              query={libQuery}
              onQueryChange={setLibQuery}
              showScores
              framework={fw}
              catalogCount={catalogCount}
              onToggle={(pkg) => setPicked((l) => (l.includes(pkg) ? l.filter((x) => x !== pkg) : [...l, pkg]))}
              empty={<p className="card-desc" style={{ margin: 0 }}>Tout le catalogue compatible est déjà dans le projet, ou rien ne correspond.</p>}
            />
            <div className="proj-detail-add-foot">
              <span className="chip accent"><Package size={11} /> {picked.length} sélectionnée{picked.length > 1 ? 's' : ''}</span>
              <button
                type="button"
                className="btn primary"
                disabled={!picked.length || installing}
                onClick={installPicked}
              >
                <Package size={15} /> Installer {picked.length || ''}
              </button>
            </div>
          </div>
        )}

        {!installed.length && !adding ? (
          <Empty
            icon={<Package size={36} color="var(--accent)" strokeWidth={1.4} />}
            title="Pas encore de librairies"
            text="Ajoute des paquets du catalogue pour enrichir ce projet."
            action={!remote && (
              <button type="button" className="btn primary" onClick={() => setAdding(true)}>
                <Plus size={15} /> Parcourir le catalogue
              </button>
            )}
          />
        ) : (
          <div className="proj-lib-groups">
            {grouped.map(([cat, items]) => (
              <div className="proj-lib-group" key={cat}>
                <h5>{cat} <em>{items.length}</em></h5>
                <ul className="proj-lib-list">
                  {items.map((item) => (
                    <li key={item.pkg}>
                      <div>
                        <strong>{item.name}</strong>
                        <code>{item.pkg}</code>
                        {item.description && <p>{item.description}</p>}
                      </div>
                      {item.dev && <span className="chip">dev</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {p.notes && (
        <section className="proj-detail-section">
          <h4>Notes</h4>
          <p className="proj-detail-notes">{p.notes}</p>
        </section>
      )}

      {p.lastBuild && (
        <p className="proj-detail-meta">Dernier build {ago(p.lastBuild)}</p>
      )}
    </div>
  )
}
