import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Play, Square, Hammer, FolderOpen, Copy, Trash2, Globe, Plus, Package,
  Code2, Layers, MoreHorizontal, FolderInput, Bookmark, Boxes, ExternalLink
} from 'lucide-react'
import { Modal, Menu, Field, SearchBox, LibraryPicker, Empty, bytes, ago, shortPath } from './ui.jsx'

const api = window.pdc

export default function Projects({ state, refresh, toast, focusProject }) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [dup, setDup] = useState(null)
  const [del, setDel] = useState(null)
  const [addLibs, setAddLibs] = useState(null)
  const [builds, setBuilds] = useState({})
  const [menu, setMenu] = useState(null)

  const fwById = useMemo(() => Object.fromEntries(state.frameworks.map((f) => [f.id, f])), [state.frameworks])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.projects.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || (fwById[p.frameworkId]?.name || '').toLowerCase().includes(q)
    )
  }, [state.projects, query, fwById])

  const buildKey = state.projects.map((p) => `${p.id}:${p.lastBuild}`).join()
  useEffect(() => {
    let alive = true
    Promise.all(state.projects.map((p) => api.run.buildInfo(p.id).then((i) => [p.id, i])))
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

  return (
    <>
      <div className="section-head">
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3>Projets</h3>
          <p>{state.projects.length || 'Aucun'} projet{state.projects.length > 1 ? 's' : ''} · {shortPath(state.workspace)}</p>
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="Filtrer" />
        <button className="btn" onClick={async () => {
          const path = await api.fs.pickDir()
          if (path) await act(() => api.project.import({ path }), 'Projet ajouté')
        }}>
          <FolderInput size={15} /> Importer
        </button>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> Nouveau projet
        </button>
      </div>

      {list.length === 0 ? (
        <Empty
          icon={<Boxes size={38} color="var(--accent)" strokeWidth={1.4} />}
          title={query ? 'Aucun projet ne correspond' : 'Rien à construire pour l’instant'}
          text={query
            ? 'Change le filtre pour retrouver un projet.'
            : 'Choisis un framework, coche les librairies utiles, et PDC Builder monte le projet pour toi.'}
          action={!query && <button className="btn primary" onClick={() => setCreating(true)}><Plus size={15} /> Créer un projet</button>}
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
              onMenu={(el) => setMenu(menu?.id === p.id ? null : { id: p.id, el })}
              act={act}
              focusProject={focusProject}
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
            toast(r.ok ? `${payload.name} est prêt` : r.error || 'Création interrompue', !r.ok)
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

function ProjectCard({ project: p, framework: fw, build, index, onMenu, act, focusProject }) {
  const btnRef = useRef(null)
  const busy = p.status === 'scaffolding'
  const live = p.status === 'running' || p.status === 'starting'

  const statusLabel = busy ? 'Installation en cours'
    : p.status === 'running' ? 'Serveur actif'
    : p.status === 'starting' ? 'Démarrage'
    : p.status === 'error' ? 'Dernière opération en échec'
    : p.lastBuild ? `Build ${ago(p.lastBuild)}`
    : 'Prêt'

  return (
    <article className={`card interactive${live ? ' live' : ''}`} style={{ '--i': Math.min(index, 8) }}>
      <div className="card-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 className="card-title">{p.name}</h4>
          <div className="card-path" title={p.path}>{shortPath(p.path, 40)}</div>
        </div>
        <button ref={btnRef} className="btn icon sm ghost" aria-label="Plus d'actions" aria-haspopup="menu"
          onClick={() => onMenu(btnRef.current)}>
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="chip-row">
        <span className="chip accent">{fw?.name || 'Framework retiré'}</span>
        {p.libs?.length > 0 && <span className="chip"><Package size={11} /> {p.libs.length}</span>}
        {build?.exists && <span className="chip ok">build {bytes(build.size)}</span>}
        {p.exists === false && <span className="chip err">dossier introuvable</span>}
      </div>

      <div className="status">
        <span className={`pulse ${busy ? 'starting' : p.status === 'error' ? 'error' : p.status || ''}`} />
        <span>{statusLabel}</span>
        {p.status === 'running' && p.url && (
          <a href="#" onClick={(e) => { e.preventDefault(); api.fs.openUrl(p.url) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
            {p.url.replace(/^https?:\/\//, '')} <ExternalLink size={11} />
          </a>
        )}
      </div>

      {busy && <div className="progress"><i /></div>}

      <div className="card-actions">
        {live ? (
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
        <button className="btn sm" disabled={busy}
          onClick={() => { focusProject(p.id); act(() => api.run.build(p.id), 'Build terminé') }}>
          <Hammer size={13} /> Build
        </button>
        <button className="btn sm ghost" onClick={() => act(() => api.run.openBuild(p.id))}>
          <FolderOpen size={13} /> Sortie
        </button>
        {build?.exists && (
          <button className="btn sm ghost" onClick={() => act(() => api.run.openBuildFile(p.id))}>Aperçu</button>
        )}
      </div>
    </article>
  )
}

function ProjectMenu({ project: p, anchor, editor, onClose, onDuplicate, onDelete, onAddLibs, act }) {
  if (!p) return null
  const run = (fn) => { onClose(); fn() }
  return (
    <Menu anchor={anchor} onClose={onClose}>
      <button onClick={() => run(() => api.editor.open({ path: p.path, editor }))}><Code2 size={15} /> Ouvrir dans l’éditeur</button>
      <button onClick={() => run(() => api.fs.reveal(p.path))}><FolderOpen size={15} /> Révéler le dossier</button>
      <hr />
      <button onClick={() => run(() => onAddLibs(p))}><Package size={15} /> Ajouter des librairies</button>
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
  const [name, setName] = useState('')
  const [frameworkId, setFrameworkId] = useState(state.frameworks[0]?.id || '')
  const [blueprintId, setBlueprintId] = useState('')
  const [libs, setLibs] = useState([])
  const [open, setOpen] = useState(['ui'])
  const [workspace, setWorkspace] = useState(state.workspace)

  const fw = state.frameworks.find((f) => f.id === frameworkId)
  const slug = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const applyBlueprint = (id) => {
    setBlueprintId(id)
    const bp = state.blueprints.find((b) => b.id === id)
    if (bp) { setFrameworkId(bp.frameworkId); setLibs(bp.libs || []) }
  }

  return (
    <Modal
      title="Nouveau projet"
      subtitle="Framework, librairies et dossier. Le reste est automatique."
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!slug || !frameworkId}
            onClick={() => onDone({ name: name.trim(), frameworkId, libs, blueprintId: blueprintId || null, workspace })}>
            <Layers size={15} /> Créer le projet
          </button>
        </>
      }
    >
      <div className="row">
        <Field label="Nom du projet" hint={slug ? `Dossier : ${slug}` : 'Le dossier reprend ce nom, en minuscules.'}>
          <input className="input" autoFocus placeholder="Portfolio 2026" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Blueprint">
          <select className="select" value={blueprintId} onChange={(e) => applyBlueprint(e.target.value)}>
            <option value="">Partir de zéro</option>
            {state.blueprints.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Framework" hint={fw?.description}>
        <select className="select" value={frameworkId} onChange={(e) => setFrameworkId(e.target.value)}>
          {state.frameworks.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.tag}</option>)}
        </select>
      </Field>

      <Field label="Dossier parent">
        <div className="row">
          <input className="input mono" value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
          <button className="btn none" onClick={async () => { const d = await api.fs.pickDir(); if (d) setWorkspace(d) }}>Choisir</button>
        </div>
      </Field>

      <Field label={libs.length ? `Librairies · ${libs.length} sélectionnées` : 'Librairies'}>
        <LibraryPicker
          categories={state.libraries}
          selected={libs}
          openIds={open}
          onToggleGroup={(id) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))}
          onToggle={(pkg) => setLibs((l) => (l.includes(pkg) ? l.filter((x) => x !== pkg) : [...l, pkg]))}
        />
      </Field>
    </Modal>
  )
}

function AddLibs({ project, state, onClose, onDone }) {
  const [libs, setLibs] = useState([])
  const cats = state.libraries
    .map((c) => ({ ...c, items: c.items.filter((i) => !project.libs?.includes(i.pkg)) }))
    .filter((c) => c.items.length)
  const [open, setOpen] = useState([cats[0]?.id])

  return (
    <Modal
      title={`Ajouter des librairies à ${project.name}`}
      subtitle="Installation via npm dans le projet existant."
      onClose={onClose}
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
        categories={cats}
        selected={libs}
        openIds={open}
        onToggleGroup={(id) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))}
        onToggle={(pkg) => setLibs((l) => (l.includes(pkg) ? l.filter((x) => x !== pkg) : [...l, pkg]))}
      />
    </Modal>
  )
}
