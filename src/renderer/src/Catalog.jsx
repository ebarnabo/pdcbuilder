import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Pencil, RotateCcw, Package, Terminal, BookOpen } from 'lucide-react'
import { Modal, Field, Chevron, SearchBox, ScoreStrip, Confirm } from './ui.jsx'
import { CatalogSync } from './CatalogSync.jsx'
import { api } from './bridge.js'
const blankFw = {
  id: '', name: '', tag: '', description: '',
  create: 'npm create vite@latest {{name}} -- --template vanilla',
  install: 'npm install', dev: 'npm run dev', build: 'npm run build',
  preview: 'npm run preview', outDir: 'dist'
}

export default function Catalog({ state, refresh, toast, tab, setTab, docsStatus, jumpCat }) {
  const [editFw, setEditFw] = useState(null)
  const [editLib, setEditLib] = useState(null)
  const [docsIndex, setDocsIndex] = useState([])
  const [libQuery, setLibQuery] = useState('')
  const [openCats, setOpenCats] = useState(() => (state.libraries[0] ? [state.libraries[0].id] : []))
  const [ask, setAsk] = useState(null)

  useEffect(() => {
    api.docs.index().then((r) => setDocsIndex(r?.packages || [])).catch(() => {})
  }, [docsStatus?.done, docsStatus?.status, docsStatus?.lastRun])

  useEffect(() => {
    if (!jumpCat) return
    const catId = String(jumpCat).split(':')[0]
    if (!catId) return
    setTab('libraries')
    setOpenCats((ids) => (ids.includes(catId) ? ids : [...ids, catId]))
    const t = window.setTimeout(() => {
      document.getElementById(`lib-cat-${catId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 40)
    return () => clearTimeout(t)
  }, [jumpCat, setTab])

  const applyFw = async (fw) => {
    const id = fw.id || fw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const exists = state.frameworks.some((f) => f.id === id)
    const next = exists
      ? state.frameworks.map((f) => (f.id === id ? { ...f, ...fw, id } : f))
      : [...state.frameworks, { ...fw, id }]
    await api.state.patch({ frameworks: next })
    setEditFw(null); refresh(); toast(exists ? 'Framework mis à jour' : 'Framework ajouté')
  }

  const saveFw = async (fw) => {
    const id = fw.id || fw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    if (!fw.id && state.frameworks.some((f) => f.id === id)) {
      setAsk({
        title: `Remplacer ${fw.name} ?`,
        subtitle: 'Un framework avec le même identifiant existe déjà. Tes réglages actuels seront écrasés.',
        confirm: 'Remplacer',
        run: () => applyFw(fw)
      })
      return
    }
    await applyFw(fw)
  }

  const removeFw = async (id) => {
    await api.state.patch({ frameworks: state.frameworks.filter((f) => f.id !== id) })
    refresh(); toast('Framework retiré du catalogue')
  }

  const applyLib = async ({ category, name, pkg, description, dev, docs, newCategory, for: compat }) => {
    const catId = newCategory ? newCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-') : category
    let libs = state.libraries
    if (!libs.some((c) => c.id === catId)) {
      libs = [...libs, { id: catId, name: newCategory || catId, description: '', items: [] }]
    }
    libs = libs.map((c) =>
      c.id === catId
        ? { ...c, items: [...c.items.filter((i) => i.pkg !== pkg), { id: pkg, name, pkg, description, dev: !!dev, docs: docs || '', for: compat?.length ? compat : ['any'] }] }
        : c
    )
    await api.state.patch({ libraries: libs })
    setEditLib(null); refresh(); toast('Librairie enregistrée')
  }

  const saveLib = async (payload) => {
    if (!editLib?.pkg && payload.pkg && state.libraries.some((c) => c.items.some((i) => i.pkg === payload.pkg))) {
      setAsk({
        title: `Remplacer ${payload.name || payload.pkg} ?`,
        subtitle: 'Une librairie avec le même paquet existe déjà dans le catalogue.',
        confirm: 'Remplacer',
        run: () => applyLib(payload)
      })
      return
    }
    await applyLib(payload)
  }

  const removeLib = async (catId, pkg) => {
    const libs = state.libraries.map((c) => (c.id === catId ? { ...c, items: c.items.filter((i) => i.pkg !== pkg) } : c))
    await api.state.patch({ libraries: libs })
    refresh()
  }

  const filteredLibs = useMemo(() => {
    const q = libQuery.trim().toLowerCase()
    if (!q) return state.libraries
    return state.libraries
      .map((c) => ({
        ...c,
        items: c.items.filter((i) =>
          i.name.toLowerCase().includes(q)
          || i.pkg.toLowerCase().includes(q)
          || (i.description || '').toLowerCase().includes(q)
        )
      }))
      .filter((c) => c.items.length > 0 || c.name.toLowerCase().includes(q))
  }, [state.libraries, libQuery])

  useEffect(() => {
    if (libQuery.trim()) setOpenCats(filteredLibs.map((c) => c.id))
  }, [libQuery, filteredLibs])

  return (
    <>
      <div className="section-head">
        <div style={{ flex: 1 }}>
          <h3>Catalogue</h3>
          <p>
            {tab === 'frameworks' ? `${state.frameworks.length} frameworks` : `${state.libraries.reduce((n, c) => n + c.items.length, 0)} librairies`}
            {tab === 'libraries' && docsStatus?.total > 0 && (
              <> · docs {docsStatus.done}/{docsStatus.total}{docsStatus.status === 'running' ? ' (fond)' : ''}</>
            )}
          </p>
        </div>
        {tab === 'libraries' && (
          <SearchBox value={libQuery} onChange={setLibQuery} placeholder="Filtrer les paquets" />
        )}
        <button className="btn" onClick={() => setAsk({
          title: 'Réinitialiser le catalogue ?',
          subtitle: 'Frameworks et librairies reviennent aux valeurs d’origine. Tes ajouts et modifications du catalogue sont perdus.',
          confirm: 'Réinitialiser',
          run: async () => { await api.state.resetCatalog(); refresh(); toast('Catalogue réinitialisé') }
        })}>
          <RotateCcw size={15} /> Réinitialiser
        </button>
        <CatalogSync state={state} refresh={refresh} toast={toast} />
        <button className="btn primary" onClick={() => (tab === 'frameworks' ? setEditFw(blankFw) : setEditLib({ category: state.libraries[0]?.id }))}>
          <Plus size={15} /> Ajouter
        </button>
      </div>

      <div className="view-filters" role="tablist" aria-label="Sections catalogue">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'frameworks'}
          className={`view-filter-chip${tab === 'frameworks' ? ' on' : ''}`}
          onClick={() => setTab('frameworks')}
        >
          Frameworks <span className="muted">{state.frameworks.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'libraries'}
          className={`view-filter-chip${tab === 'libraries' ? ' on' : ''}`}
          onClick={() => setTab('libraries')}
        >
          Librairies <span className="muted">{state.libraries.reduce((n, c) => n + c.items.length, 0)}</span>
        </button>
      </div>

      {tab === 'frameworks' ? (
        <div className="grid">
          {state.frameworks.map((f, i) => (
            <article className="card interactive" key={f.id} style={{ '--i': Math.min(i, 8) }}>
              <div className="card-head">
                <div style={{ flex: 1 }}>
                  <h4 className="card-title">{f.name}</h4>
                  <span className="chip accent">{f.tag}</span>
                </div>
              </div>
              <p className="card-desc">{f.description}</p>
              <ScoreStrip scores={f.scores} />
              <div className="card-path"><Terminal size={11} style={{ verticalAlign: -1 }} /> {f.create}</div>
              <div className="chip-row">
                <span className="chip">dev · {f.dev}</span>
                <span className="chip">build · {f.build}</span>
                <span className="chip">sortie · {f.outDir}</span>
              </div>
              <div className="card-actions">
                <button className="btn sm ghost" onClick={() => setEditFw(f)}><Pencil size={14} /> Modifier</button>
                <button className="btn sm danger" onClick={() => setAsk({
                  title: `Retirer ${f.name} ?`,
                  subtitle: 'Il quitte le catalogue. Les projets déjà créés avec ce framework restent en place.',
                  confirm: 'Retirer',
                  run: () => removeFw(f.id)
                })}><Trash2 size={14} /> Retirer</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredLibs.length === 0 && (
            <p className="card-desc">Aucune librairie ne correspond à « {libQuery} ».</p>
          )}
          {filteredLibs.map((c) => {
            const open = openCats.includes(c.id)
            return (
            <div className="lib-group" key={c.id} id={`lib-cat-${c.id}`}>
              <div className="lib-head">
                <button
                  type="button"
                  className="lib-toggle"
                  onClick={() => setOpenCats((ids) => ids.includes(c.id) ? ids.filter((id) => id !== c.id) : [...ids, c.id])}
                  aria-expanded={open}
                >
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <h4>{c.name}</h4>
                    <p>{c.description}</p>
                  </div>
                  <span className="chip">{c.items.length}</span>
                  <Chevron open={open} />
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => setEditLib({ category: c.id })}
                >
                  <Plus size={14} /> Ajouter ici
                </button>
              </div>
              {open && (
              <div className="lib-body">
                {c.items.map((i) => {
                  const doc = docsIndex.find((d) => d.pkg === i.pkg)
                  const url = i.docs || doc?.docsUrl
                  return (
                  <div className="lib" key={i.pkg}>
                    <Package size={16} color="var(--text-3)" style={{ marginTop: 2, flex: 'none' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong>
                        {i.name}
                        {i.dev && <span className="chip" style={{ marginLeft: 6, height: 18 }}>dev</span>}
                        {i.version && <span className="chip" style={{ marginLeft: 6, height: 18 }}>{i.version}</span>}
                      </strong>
                      <small>{i.description}</small>
                      <small className="mono" style={{ color: 'var(--accent)', marginTop: 4 }}>{i.pkg}</small>
                    </span>
                    {url && (
                      <button className="btn icon sm ghost" aria-label="Documentation" onClick={() => api.fs.openUrl(url)}>
                        <BookOpen size={14} />
                      </button>
                    )}
                    <button className="btn icon sm ghost" aria-label="Retirer" onClick={() => setAsk({
                      title: `Retirer ${i.name} ?`,
                      subtitle: `${i.pkg} quitte le catalogue. Les projets qui l’ont déjà installé ne sont pas désinstallés.`,
                      confirm: 'Retirer',
                      run: () => removeLib(c.id, i.pkg)
                    })}><Trash2 size={14} /></button>
                  </div>
                  )
                })}
                {c.items.length === 0 && <p className="card-desc">Catégorie vide.</p>}
              </div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {editFw && <FrameworkForm value={editFw} onClose={() => setEditFw(null)} onSave={saveFw} />}
      {editLib && <LibraryForm value={editLib} categories={state.libraries} onClose={() => setEditLib(null)} onSave={saveLib} />}
      {ask && (
        <Confirm
          title={ask.title}
          subtitle={ask.subtitle}
          confirm={ask.confirm}
          onClose={() => setAsk(null)}
          onConfirm={async () => {
            await ask.run()
            setAsk(null)
          }}
        />
      )}
    </>
  )
}

function FrameworkForm({ value, onClose, onSave }) {
  const [f, setF] = useState(value)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal
      title={value.id ? `Modifier ${value.name}` : 'Ajouter un framework'}
      subtitle="{{name}} est remplacé par le nom du dossier au moment de la création."
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!f.name || !f.create} onClick={() => onSave(f)}>Enregistrer</button>
        </>
      }
    >
      <div className="row">
        <Field label="Nom"><input className="input" value={f.name} onChange={set('name')} placeholder="Remix" /></Field>
        <Field label="Étiquette"><input className="input" value={f.tag} onChange={set('tag')} placeholder="React" /></Field>
      </div>
      <Field label="Écosystème" hint="Sert à filtrer les librairies compatibles à la création d’un projet.">
        <select className="select" value={f.family || ''} onChange={set('family')}>
          <option value="">Déduire depuis l’étiquette</option>
          <option value="react">React</option>
          <option value="vue">Vue</option>
          <option value="svelte">Svelte</option>
          <option value="vanilla">Vanilla</option>
          <option value="astro">Astro</option>
        </select>
      </Field>
      <Field label="Description" hint="Affichée au moment de choisir le framework.">
        <textarea className="textarea" value={f.description} onChange={set('description')} />
      </Field>
      <Field label="Commande de création"><input className="input mono" value={f.create} onChange={set('create')} /></Field>
      <div className="row">
        <Field label="Installation"><input className="input mono" value={f.install} onChange={set('install')} /></Field>
        <Field label="Serveur de dev"><input className="input mono" value={f.dev} onChange={set('dev')} /></Field>
      </div>
      <div className="row">
        <Field label="Build"><input className="input mono" value={f.build} onChange={set('build')} /></Field>
        <Field label="Aperçu"><input className="input mono" value={f.preview} onChange={set('preview')} /></Field>
      </div>
      <Field label="Dossier de sortie" hint="Ce dossier s'ouvre avec le bouton « Dossier du build ».">
        <input className="input mono" value={f.outDir} onChange={set('outDir')} />
      </Field>
    </Modal>
  )
}

const COMPAT = [
  { id: 'any', label: 'Tous' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'svelte', label: 'Svelte' },
  { id: 'next', label: 'Next.js' },
  { id: 'nuxt', label: 'Nuxt' },
  { id: 'vanilla', label: 'Vanilla' },
  { id: 'astro', label: 'Astro' }
]

function LibraryForm({ value, categories, onClose, onSave }) {
  const [l, setL] = useState({ name: '', pkg: '', description: '', dev: false, docs: '', newCategory: '', for: ['any'], ...value })
  const set = (k) => (e) => setL({ ...l, [k]: e.target.value })
  const tags = l.for?.length ? l.for : ['any']
  const toggleFor = (id) => {
    if (id === 'any') {
      setL({ ...l, for: ['any'] })
      return
    }
    const cur = tags.filter((t) => t !== 'any')
    const next = cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]
    setL({ ...l, for: next.length ? next : ['any'] })
  }
  return (
    <Modal
      title="Ajouter une librairie"
      subtitle="Le paquet est installé via npm au moment de la création du projet."
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!l.name || !l.pkg} onClick={() => onSave(l)}>Enregistrer</button>
        </>
      }
    >
      <div className="row">
        <Field label="Catégorie">
          <select className="select" value={l.category} onChange={set('category')}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="ou nouvelle catégorie"><input className="input" value={l.newCategory} onChange={set('newCategory')} placeholder="Audio & voix" /></Field>
      </div>
      <div className="row">
        <Field label="Nom affiché"><input className="input" value={l.name} onChange={set('name')} placeholder="Tone.js" /></Field>
        <Field label="Paquet npm"><input className="input mono" value={l.pkg} onChange={set('pkg')} placeholder="tone" /></Field>
      </div>
      <Field label="Description"><textarea className="textarea" value={l.description} onChange={set('description')} /></Field>
      <Field label="Compatible avec" hint="« Tous » reste visible pour n’importe quel framework. React / Vue / Next… ne s’affichent que là où ça s’installe.">
        <div className="chip-row">
          {COMPAT.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`chip link${tags.includes(o.id) ? ' accent' : ''}`}
              onClick={() => toggleFor(o.id)}
              aria-pressed={tags.includes(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Documentation (facultatif)" hint="Sinon l’app récupère homepage et README depuis npm, en silence au démarrage.">
        <input className="input mono" value={l.docs || ''} onChange={set('docs')} placeholder="https://…" />
      </Field>
      <label className="lib" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={l.dev} onChange={(e) => setL({ ...l, dev: e.target.checked })} style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
        <span><strong>Dépendance de développement</strong><small>Installée avec <code>npm install -D</code>.</small></span>
      </label>
    </Modal>
  )
}
