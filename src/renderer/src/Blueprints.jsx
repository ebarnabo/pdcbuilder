import { useMemo, useState } from 'react'
import {
  Plus, Trash2, Pencil, Bookmark, FileCode2, Database, Copy, Sparkles, Users, Target
} from 'lucide-react'
import { Modal, Field, Empty, LibraryPicker, ScoreNotes, Confirm, Segmented } from './ui.jsx'
import { DatabasePicker } from './DatabaseFields.jsx'
import { librariesFor, keepCompatible, filterLibraryItems, countCatalogLibraries } from './compat.js'
import { ThemePicker, themeLabel } from './themes.jsx'
import { EXPERIENCE_CATEGORIES, categoryLabel, isExperience } from './experienceMeta.js'
import { api } from './bridge.js'

export default function Blueprints({ state, refresh, toast }) {
  const [edit, setEdit] = useState(null)
  const [drop, setDrop] = useState(null)
  const [category, setCategory] = useState('all')
  const fwName = (id) => state.frameworks.find((f) => f.id === id)?.name || 'Framework retiré'

  const list = useMemo(() => {
    const all = state.blueprints || []
    if (category === 'all') return all
    if (category === 'custom') return all.filter((b) => !isExperience(b))
    return all.filter((b) => b.category === category || (category === 'marketing' && !b.category && isExperience(b)))
  }, [state.blueprints, category])

  const counts = useMemo(() => {
    const all = state.blueprints || []
    return {
      all: all.length,
      custom: all.filter((b) => !isExperience(b)).length,
      ...Object.fromEntries(EXPERIENCE_CATEGORIES.map((c) => [c.id, all.filter((b) => b.category === c.id).length]))
    }
  }, [state.blueprints])

  return (
    <>
      <div className="section-head">
        <div style={{ flex: 1 }}>
          <h3>Blueprints</h3>
          <p>Bases orientées expérience : intention, public, ambiance — puis stack et fichiers.</p>
        </div>
        <button className="btn primary" onClick={() => setEdit({
          name: '', description: '', tagline: '', intent: '', audience: '', promise: '', vibe: '',
          kind: 'custom', category: 'product', frameworkId: state.frameworks[0]?.id,
          libs: [], files: [], commands: [], databaseId: state.database?.defaultId || 'none', themes: []
        })}>
          <Plus size={16} /> Nouveau blueprint
        </button>
      </div>

      <div className="chip-row">
        <button type="button" className={`chip link${category === 'all' ? ' accent' : ''}`} onClick={() => setCategory('all')}>
          Tous ({counts.all})
        </button>
        {EXPERIENCE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip link${category === c.id ? ' accent' : ''}`}
            onClick={() => setCategory(c.id)}
            title={c.hint}
          >
            {c.label} ({counts[c.id] || 0})
          </button>
        ))}
        <button type="button" className={`chip link${category === 'custom' ? ' accent' : ''}`} onClick={() => setCategory('custom')}>
          Perso ({counts.custom})
        </button>
      </div>

      {list.length === 0 ? (
        <Empty
          icon={<Bookmark size={38} color="var(--accent)" strokeWidth={1.4} />}
          title={category === 'all' ? 'Aucune base enregistrée' : 'Rien dans cette catégorie'}
          text="Les blueprints expérience sont fournis avec l’app. Tu peux aussi en créer ou en dériver depuis un projet."
        />
      ) : (
        <div className="grid bp-grid">
          {list.map((b, i) => (
            <article className={`card interactive bp-card${isExperience(b) ? ' xp' : ''}`} key={b.id} style={{ '--i': Math.min(i, 8) }}>
              <div className="card-head">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bp-meta">
                    {isExperience(b) && <span className="chip accent"><Sparkles size={11} /> Expérience</span>}
                    {b.category && <span className="chip">{categoryLabel(b.category)}</span>}
                    <span className="chip">{fwName(b.frameworkId)}</span>
                  </div>
                  <h4 className="card-title">{b.name}</h4>
                  {b.tagline && <p className="bp-tagline">{b.tagline}</p>}
                </div>
              </div>
              {(b.description || b.intent) && (
                <p className="card-desc">{b.intent || b.description}</p>
              )}
              {(b.audience || b.promise) && (
                <div className="bp-brief">
                  {b.audience && (
                    <div><Users size={13} /><span>{b.audience}</span></div>
                  )}
                  {b.promise && (
                    <div><Target size={13} /><span>{b.promise}</span></div>
                  )}
                </div>
              )}
              <div className="chip-row">
                {(b.themes || []).map((id) => (
                  <span className="chip" key={id}>{themeLabel(id)}</span>
                ))}
                <span className="chip">{b.libs?.length || 0} librairies</span>
                {b.databaseId && b.databaseId !== 'none' && (
                  <span className="chip"><Database size={12} /> {b.databaseId}</span>
                )}
                {b.files?.length > 0 && <span className="chip"><FileCode2 size={12} /> {b.files.length} fichiers</span>}
              </div>
              <div className="card-actions">
                <button className="btn sm ghost" onClick={() => setEdit(b)}><Pencil size={14} /> Modifier</button>
                <button className="btn sm ghost" onClick={async () => {
                  const r = await api.blueprint.duplicate(b.id)
                  if (r?.error) toast(r.error, true)
                  else { refresh(); toast('Copie créée — tu peux la personnaliser') }
                }}>
                  <Copy size={14} /> Dupliquer
                </button>
                {!b.builtin && (
                  <button className="btn sm danger" onClick={() => setDrop(b)}>
                    <Trash2 size={14} /> Supprimer
                  </button>
                )}
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
            const r = await api.blueprint.remove(drop.id)
            setDrop(null)
            if (r?.error) toast(r.error, true)
            else { refresh(); toast('Blueprint supprimé') }
          }}
        />
      )}

      {edit && (
        <BlueprintForm
          value={edit}
          state={state}
          onClose={() => setEdit(null)}
          onSave={async (bp) => {
            await api.blueprint.save(bp)
            setEdit(null)
            refresh()
            toast('Blueprint enregistré')
          }}
        />
      )}
    </>
  )
}

function BlueprintForm({ value, state, onClose, onSave }) {
  const [b, setB] = useState({
    databaseId: 'none', themes: [], kind: 'custom', category: 'product',
    intent: '', audience: '', promise: '', vibe: '', tagline: '',
    ...value,
    files: value.files || [],
    commands: value.commands || []
  })
  const [dropFile, setDropFile] = useState(null)
  const [libQuery, setLibQuery] = useState('')
  const fw = state.frameworks.find((f) => f.id === b.frameworkId)
  const compatible = useMemo(() => librariesFor(state.libraries, fw), [state.libraries, fw])
  const visibleLibs = useMemo(() => filterLibraryItems(compatible, libQuery), [compatible, libQuery])

  const setFramework = (id) => {
    const nextFw = state.frameworks.find((f) => f.id === id)
    setB({ ...b, frameworkId: id, libs: keepCompatible(b.libs, state.libraries, nextFw) })
  }

  return (
    <>
      <Modal
        title={value.id ? `Modifier ${value.name}` : 'Nouveau blueprint'}
        subtitle="Définis l’expérience d’abord (qui, pourquoi, ambiance), puis la stack."
        onClose={onClose}
        width="min(920px, 100%)"
        footer={
          <>
            <button className="btn ghost" onClick={onClose}>Annuler</button>
            <button className="btn primary" disabled={!b.name.trim()} onClick={() => onSave({
              ...b,
              kind: b.kind || (b.builtin ? 'experience' : 'custom'),
              builtin: Boolean(b.builtin)
            })}>Enregistrer</button>
          </>
        }
      >
        <section className="form-section">
          <h4>Expérience</h4>
          <div className="row">
            <Field label="Nom"><input className="input" autoFocus value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="Landing luxe" /></Field>
            <Field label="Accroche">
              <input className="input" value={b.tagline || ''} onChange={(e) => setB({ ...b, tagline: e.target.value })} placeholder="Première impression cinématographique" />
            </Field>
          </div>
          <Field label="Catégorie">
            <Segmented
              value={b.category || 'product'}
              onChange={(category) => setB({ ...b, category })}
              options={EXPERIENCE_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
            />
          </Field>
          <Field label="Intention" hint="Ce que l’écran doit accomplir.">
            <textarea className="textarea" value={b.intent || ''} onChange={(e) => setB({ ...b, intent: e.target.value })} placeholder="Convaincre en 5 secondes…" />
          </Field>
          <div className="row">
            <Field label="Public">
              <input className="input" value={b.audience || ''} onChange={(e) => setB({ ...b, audience: e.target.value })} placeholder="Prospects froids, décideurs…" />
            </Field>
            <Field label="Promesse">
              <input className="input" value={b.promise || ''} onChange={(e) => setB({ ...b, promise: e.target.value })} placeholder="Une page qui sent le soin" />
            </Field>
          </div>
          <Field label="Ambiance / vibe">
            <input className="input" value={b.vibe || ''} onChange={(e) => setB({ ...b, vibe: e.target.value })} placeholder="Sombre chaud, serif, accent champagne" />
          </Field>
          <Field label="Description courte">
            <textarea className="textarea" value={b.description || ''} onChange={(e) => setB({ ...b, description: e.target.value })} />
          </Field>
          <ThemePicker
            value={b.themes || []}
            onChange={(themes) => setB({ ...b, themes })}
            hint="Repris à la création d’un projet depuis cette base."
          />
        </section>

        <section className="form-section">
          <h4>Stack</h4>
          <Field label="Framework" hint={fw?.description}>
            <select className="select" value={b.frameworkId} onChange={(e) => setFramework(e.target.value)}>
              {state.frameworks.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <ScoreNotes scores={fw?.scores} />
          <DatabasePicker value={b.databaseId || 'none'} onChange={(id) => setB({ ...b, databaseId: id })} />
        </section>

        <section className="form-section">
          <h4>Fichiers & commandes</h4>
          <Field label="Fichiers de départ" hint="Tokens, EXPERIENCE.md, App de départ… Écrits après l’install.">
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
          <Field label="Commandes après installation" hint="Une commande par ligne.">
            <textarea className="textarea mono" value={(b.commands || []).join('\n')}
              placeholder="npx tailwindcss init -p"
              onChange={(e) => setB({ ...b, commands: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
        </section>

        <section className="form-section form-section-libraries">
          <h4>Librairies · {b.libs.length}</h4>
          <LibraryPicker
            layout="explore"
            categories={visibleLibs}
            selected={b.libs}
            query={libQuery}
            onQueryChange={setLibQuery}
            showScores
            framework={fw}
            catalogCount={countCatalogLibraries(state.libraries)}
            onToggle={(pkg) => setB({ ...b, libs: b.libs.includes(pkg) ? b.libs.filter((x) => x !== pkg) : [...b.libs, pkg] })}
          />
        </section>
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
