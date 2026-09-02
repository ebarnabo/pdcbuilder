import { useState, useMemo } from 'react'
import { Plus, Trash2, Pencil, Bookmark, FileCode2, Database } from 'lucide-react'
import { Modal, Field, Empty, LibraryPicker, ScoreNotes, Confirm } from './ui.jsx'
import { DatabasePicker } from './DatabaseFields.jsx'
import { librariesFor, keepCompatible, filterLibraryItems } from './compat.js'
import { ThemePicker, themeLabel } from './themes.jsx'
import { api } from './bridge.js'

export default function Blueprints({ state, refresh, toast }) {
  const [edit, setEdit] = useState(null)
  const [drop, setDrop] = useState(null)
  const fwName = (id) => state.frameworks.find((f) => f.id === id)?.name || 'Framework retiré'

  return (
    <>
      <div className="section-head">
        <div style={{ flex: 1 }}>
          <h3>Blueprints</h3>
          <p>Des bases réutilisables : un framework, ses librairies, ses fichiers de départ.</p>
        </div>
        <button className="btn primary" onClick={() => setEdit({
          name: '', description: '', frameworkId: state.frameworks[0]?.id, libs: [], files: [], commands: [], databaseId: state.database?.defaultId || 'none', themes: []
        })}>
          <Plus size={16} /> Nouveau blueprint
        </button>
      </div>

      {state.blueprints.length === 0 ? (
        <Empty
          icon={<Bookmark size={38} color="var(--accent)" strokeWidth={1.4} />}
          title="Aucune base enregistrée"
          text="Enregistre une configuration une fois, réutilise-la à chaque projet. Un projet existant peut aussi devenir un blueprint en un clic."
        />
      ) : (
        <div className="grid">
          {state.blueprints.map((b, i) => (
            <article className="card interactive" key={b.id} style={{ '--i': Math.min(i, 8) }}>
              <div className="card-head">
                <div style={{ flex: 1 }}>
                  <h4 className="card-title">{b.name}</h4>
                  <span className="chip accent">{fwName(b.frameworkId)}</span>
                </div>
              </div>
              {b.description && <p className="card-desc">{b.description}</p>}
              <div className="chip-row">
                {(b.themes || []).map((id) => (
                  <span className="chip" key={id}>{themeLabel(id)}</span>
                ))}
                <span className="chip">{b.libs?.length || 0} librairies</span>
                {b.databaseId && b.databaseId !== 'none' && (
                  <span className="chip"><Database size={12} /> {b.databaseId}</span>
                )}
                {b.files?.length > 0 && <span className="chip"><FileCode2 size={12} /> {b.files.length} fichiers</span>}
                {b.commands?.length > 0 && <span className="chip">{b.commands.length} commandes</span>}
              </div>
              <div className="card-actions">
                <button className="btn sm ghost" onClick={() => setEdit(b)}><Pencil size={14} /> Modifier</button>
                <button className="btn sm danger" onClick={() => setDrop(b)}>
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {drop && (
        <Confirm
          title={`Supprimer ${drop.name} ?`}
          subtitle="Le blueprint quitte le catalogue. Les projets déjà créés avec lui restent en place."
          confirm="Supprimer"
          onClose={() => setDrop(null)}
          onConfirm={async () => {
            await api.blueprint.remove(drop.id)
            setDrop(null)
            refresh()
            toast('Blueprint supprimé')
          }}
        />
      )}

      {edit && (
        <BlueprintForm
          value={edit}
          state={state}
          onClose={() => setEdit(null)}
          onSave={async (bp) => { await api.blueprint.save(bp); setEdit(null); refresh(); toast('Blueprint enregistré') }}
        />
      )}
    </>
  )
}

function BlueprintForm({ value, state, onClose, onSave }) {
  const [b, setB] = useState({ databaseId: 'none', themes: [], ...value, files: value.files || [], commands: value.commands || [] })
  const [dropFile, setDropFile] = useState(null)
  const [libQuery, setLibQuery] = useState('')
  const fw = state.frameworks.find((f) => f.id === b.frameworkId)
  const compatible = useMemo(() => librariesFor(state.libraries, fw), [state.libraries, fw])
  const visibleLibs = useMemo(() => filterLibraryItems(compatible, libQuery), [compatible, libQuery])
  const [open, setOpen] = useState([compatible[0]?.id].filter(Boolean))

  const setFramework = (id) => {
    const nextFw = state.frameworks.find((f) => f.id === id)
    const nextCats = librariesFor(state.libraries, nextFw)
    setB({ ...b, frameworkId: id, libs: keepCompatible(b.libs, state.libraries, nextFw) })
    setOpen([nextCats[0]?.id].filter(Boolean))
  }

  return (
    <>
    <Modal
      title={value.id ? `Modifier ${value.name}` : 'Nouveau blueprint'}
      subtitle="Ce que tu définis ici sera appliqué à chaque projet créé depuis cette base."
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!b.name.trim()} onClick={() => onSave(b)}>Enregistrer</button>
        </>
      }
    >
      <div className="row">
        <Field label="Nom"><input className="input" autoFocus value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="Landing PDC" /></Field>
        <Field label="Framework" hint={fw?.description}>
          <select className="select" value={b.frameworkId} onChange={(e) => setFramework(e.target.value)}>
            {state.frameworks.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
      </div>
      <ScoreNotes scores={fw?.scores} />
      <ThemePicker
        value={b.themes || []}
        onChange={(themes) => setB({ ...b, themes })}
        hint="Repris à la création d’un projet depuis cette base."
      />
      <Field label="Description"><textarea className="textarea" value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} /></Field>

      <DatabasePicker value={b.databaseId || 'none'} onChange={(id) => setB({ ...b, databaseId: id })} />

      <Field label="Fichiers de départ" hint="Un chemin relatif par bloc. Écrits juste après l'installation.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {b.files.map((f, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row">
                <input className="input mono" value={f.path} placeholder="src/styles/tokens.css"
                  onChange={(e) => setB({ ...b, files: b.files.map((x, j) => (j === i ? { ...x, path: e.target.value } : x)) })} />
                <button className="btn icon none danger" aria-label="Retirer le fichier"
                  onClick={() => {
                    if (!f.path.trim() && !f.content.trim()) setB({ ...b, files: b.files.filter((_, j) => j !== i) })
                    else setDropFile(i)
                  }}><Trash2 size={16} /></button>
              </div>
              <textarea className="textarea mono" value={f.content} placeholder="Contenu du fichier"
                onChange={(e) => setB({ ...b, files: b.files.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)) })} />
            </div>
          ))}
          <button className="btn sm ghost" onClick={() => setB({ ...b, files: [...b.files, { path: '', content: '' }] })}>
            <Plus size={14} /> Ajouter un fichier
          </button>
        </div>
      </Field>

      <Field label="Commandes après installation" hint="Une commande par ligne, exécutées dans le projet.">
        <textarea className="textarea mono" value={b.commands.join('\n')}
          placeholder="npx tailwindcss init -p"
          onChange={(e) => setB({ ...b, commands: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
      </Field>

      <Field
        label={`Librairies · ${b.libs.length}`}
        hint={fw ? `Uniquement celles compatibles avec ${fw.name}.` : undefined}
      >
        <LibraryPicker
          categories={visibleLibs}
          selected={b.libs}
          openIds={open}
          query={libQuery}
          onQueryChange={setLibQuery}
          onOpenAll={() => setOpen(visibleLibs.map((c) => c.id))}
          onCloseAll={() => setOpen([])}
          showScores
          onToggleGroup={(id) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))}
          onToggle={(pkg) => setB({ ...b, libs: b.libs.includes(pkg) ? b.libs.filter((x) => x !== pkg) : [...b.libs, pkg] })}
        />
      </Field>
    </Modal>
    {dropFile != null && (
      <Confirm
        title={`Retirer ${b.files[dropFile]?.path || 'ce fichier'} ?`}
        subtitle="Il sort du blueprint. Le disque du projet n’est pas touché tant que tu n’enregistres pas."
        confirm="Retirer"
        onClose={() => setDropFile(null)}
        onConfirm={() => {
          setB({ ...b, files: b.files.filter((_, j) => j !== dropFile) })
          setDropFile(null)
        }}
      />
    )}
    </>
  )
}
