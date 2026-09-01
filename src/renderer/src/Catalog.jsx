import { useState } from 'react'
import { Plus, Trash2, Pencil, RotateCcw, Package, Terminal } from 'lucide-react'
import { Modal, Field, Segmented } from './ui.jsx'
import { api } from './bridge.js'
const blankFw = {
  id: '', name: '', tag: '', description: '',
  create: 'npm create vite@latest {{name}} -- --template vanilla',
  install: 'npm install', dev: 'npm run dev', build: 'npm run build',
  preview: 'npm run preview', outDir: 'dist'
}

export default function Catalog({ state, refresh, toast, tab, setTab }) {
  const [editFw, setEditFw] = useState(null)
  const [editLib, setEditLib] = useState(null)

  const saveFw = async (fw) => {
    const id = fw.id || fw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const exists = state.frameworks.some((f) => f.id === id)
    const next = exists
      ? state.frameworks.map((f) => (f.id === id ? { ...f, ...fw, id } : f))
      : [...state.frameworks, { ...fw, id }]
    await api.state.patch({ frameworks: next })
    setEditFw(null); refresh(); toast(exists ? 'Framework mis à jour' : 'Framework ajouté')
  }

  const removeFw = async (id) => {
    await api.state.patch({ frameworks: state.frameworks.filter((f) => f.id !== id) })
    refresh(); toast('Framework retiré du catalogue')
  }

  const saveLib = async ({ category, name, pkg, description, dev, newCategory }) => {
    const catId = newCategory ? newCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-') : category
    let libs = state.libraries
    if (!libs.some((c) => c.id === catId)) {
      libs = [...libs, { id: catId, name: newCategory || catId, description: '', items: [] }]
    }
    libs = libs.map((c) =>
      c.id === catId
        ? { ...c, items: [...c.items.filter((i) => i.pkg !== pkg), { id: pkg, name, pkg, description, dev: !!dev }] }
        : c
    )
    await api.state.patch({ libraries: libs })
    setEditLib(null); refresh(); toast('Librairie enregistrée')
  }

  const removeLib = async (catId, pkg) => {
    const libs = state.libraries.map((c) => (c.id === catId ? { ...c, items: c.items.filter((i) => i.pkg !== pkg) } : c))
    await api.state.patch({ libraries: libs })
    refresh()
  }

  return (
    <>
      <div className="section-head">
        <div style={{ flex: 1 }}>
          <h3>Catalogue</h3>
          <p>Les briques disponibles au moment de créer un projet.</p>
        </div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[{ value: 'frameworks', label: 'Frameworks' }, { value: 'libraries', label: 'Librairies' }]}
        />
        <button className="btn" onClick={async () => { await api.state.resetCatalog(); refresh(); toast('Catalogue réinitialisé') }}>
          <RotateCcw size={15} /> Réinitialiser
        </button>
        <button className="btn primary" onClick={() => (tab === 'frameworks' ? setEditFw(blankFw) : setEditLib({ category: state.libraries[0]?.id }))}>
          <Plus size={15} /> Ajouter
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
              <div className="card-path"><Terminal size={11} style={{ verticalAlign: -1 }} /> {f.create}</div>
              <div className="chip-row">
                <span className="chip">dev · {f.dev}</span>
                <span className="chip">build · {f.build}</span>
                <span className="chip">sortie · {f.outDir}</span>
              </div>
              <div className="card-actions">
                <button className="btn sm ghost" onClick={() => setEditFw(f)}><Pencil size={14} /> Modifier</button>
                <button className="btn sm danger" onClick={() => removeFw(f.id)}><Trash2 size={14} /> Retirer</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {state.libraries.map((c) => (
            <div className="lib-group" key={c.id}>
              <div className="lib-head" style={{ cursor: 'default' }}>
                <div style={{ flex: 1 }}>
                  <h4>{c.name}</h4>
                  <p>{c.description}</p>
                </div>
                <button className="btn sm ghost" onClick={() => setEditLib({ category: c.id })}><Plus size={14} /> Ajouter ici</button>
              </div>
              <div className="lib-body">
                {c.items.map((i) => (
                  <div className="lib" key={i.pkg}>
                    <Package size={16} color="var(--faint)" style={{ marginTop: 2, flex: 'none' }} />
                    <span style={{ flex: 1 }}>
                      <strong>{i.name}{i.dev && <span className="chip" style={{ marginLeft: 6, height: 18 }}>dev</span>}</strong>
                      <small>{i.description}</small>
                      <small className="mono" style={{ color: 'var(--accent)', marginTop: 4 }}>{i.pkg}</small>
                    </span>
                    <button className="btn icon sm ghost" aria-label="Retirer" onClick={() => removeLib(c.id, i.pkg)}><Trash2 size={14} /></button>
                  </div>
                ))}
                {c.items.length === 0 && <p className="card-desc">Catégorie vide.</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editFw && <FrameworkForm value={editFw} onClose={() => setEditFw(null)} onSave={saveFw} />}
      {editLib && <LibraryForm value={editLib} categories={state.libraries} onClose={() => setEditLib(null)} onSave={saveLib} />}
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
        <Field label="Famille"><input className="input" value={f.tag} onChange={set('tag')} placeholder="React" /></Field>
      </div>
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

function LibraryForm({ value, categories, onClose, onSave }) {
  const [l, setL] = useState({ name: '', pkg: '', description: '', dev: false, newCategory: '', ...value })
  const set = (k) => (e) => setL({ ...l, [k]: e.target.value })
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
      <label className="lib" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={l.dev} onChange={(e) => setL({ ...l, dev: e.target.checked })} style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
        <span><strong>Dépendance de développement</strong><small>Installée avec <code>npm install -D</code>.</small></span>
      </label>
    </Modal>
  )
}
