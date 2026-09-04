import { useEffect, useRef, useState } from 'react'
import { CheckSquare, Plus, Trash2, Square, Check } from 'lucide-react'
import { Modal, Field } from './ui.jsx'
import { api } from './bridge.js'

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function checklistStats(list) {
  const items = Array.isArray(list) ? list : []
  const done = items.filter((i) => i.done).length
  return { total: items.length, done, open: items.length - done }
}

export function normalizeChecklist(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((item) => ({
      id: String(item?.id || uid()),
      text: String(item?.text || '').trim(),
      done: Boolean(item?.done),
      createdAt: Number(item?.createdAt) || Date.now()
    }))
    .filter((item) => item.text)
}

/** Aperçu compact sur la carte projet. */
export function ChecklistSnippet({ project, onOpen, act }) {
  const items = normalizeChecklist(project.checklist)
  const open = items.filter((i) => !i.done)
  const { total, done } = checklistStats(items)
  if (!total) {
    return (
      <button type="button" className="proj-ideas-empty" onClick={onOpen}>
        <Plus size={13} /> Ajouter une idée
      </button>
    )
  }

  const toggle = async (id) => {
    const next = items.map((i) => (i.id === id ? { ...i, done: !i.done } : i))
    await act(
      () => api.project.update({ id: project.id, fields: { checklist: next } }),
      null
    )
  }

  return (
    <div className="proj-ideas">
      <div className="proj-ideas-head">
        <span>
          <CheckSquare size={12} /> Idées
          <em>{done}/{total}</em>
        </span>
        <button type="button" className="linkish" onClick={onOpen}>Tout voir</button>
      </div>
      <ul className="proj-ideas-list">
        {open.slice(0, 3).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="proj-ideas-check"
              aria-label={`Marquer « ${item.text} » comme fait`}
              onClick={() => toggle(item.id)}
            >
              <Square size={14} />
            </button>
            <span title={item.text}>{item.text}</span>
          </li>
        ))}
        {open.length === 0 && (
          <li className="proj-ideas-done-all">Toutes les idées sont cochées.</li>
        )}
        {open.length > 3 && (
          <li className="proj-ideas-more">+{open.length - 3} autre{open.length - 3 > 1 ? 's' : ''}</li>
        )}
      </ul>
    </div>
  )
}

export function ChecklistModal({ project, onClose, act }) {
  const [items, setItems] = useState(() => normalizeChecklist(project.checklist))
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState('open') // open | all | done
  const inputRef = useRef(null)

  useEffect(() => {
    setItems(normalizeChecklist(project.checklist))
  }, [project.id, project.checklist])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const persist = async (next, toastMsg) => {
    setItems(next)
    await act(
      () => api.project.update({ id: project.id, fields: { checklist: next } }),
      toastMsg
    )
  }

  const add = async () => {
    const text = draft.trim()
    if (!text) return
    const next = [
      { id: uid(), text, done: false, createdAt: Date.now() },
      ...items
    ]
    setDraft('')
    await persist(next, null)
    inputRef.current?.focus()
  }

  const toggle = (id) => {
    persist(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)), null)
  }

  const remove = (id) => {
    persist(items.filter((i) => i.id !== id), null)
  }

  const clearDone = () => {
    persist(items.filter((i) => !i.done), 'Idées terminées retirées')
  }

  const visible = items.filter((i) => {
    if (filter === 'open') return !i.done
    if (filter === 'done') return i.done
    return true
  })

  const { total, done, open } = checklistStats(items)

  return (
    <Modal
      title={`Idées · ${project.name}`}
      subtitle="Checklist légère : idées, tâches, pistes à ne pas perdre."
      onClose={onClose}
      width="min(520px, 100%)"
      footer={
        <>
          {done > 0 && (
            <button type="button" className="btn ghost" onClick={clearDone} style={{ marginRight: 'auto' }}>
              Retirer les terminées ({done})
            </button>
          )}
          <button type="button" className="btn primary" onClick={onClose}>Fermer</button>
        </>
      }
    >
      <form
        className="ideas-add"
        onSubmit={(e) => { e.preventDefault(); add() }}
      >
        <Field label="Nouvelle idée" hint="Entrée pour ajouter.">
          <div className="row">
            <input
              ref={inputRef}
              className="input"
              placeholder="Ex. hero plus calme, pricing en 3 paliers…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={200}
            />
            <button type="submit" className="btn primary" disabled={!draft.trim()}>
              <Plus size={15} /> Ajouter
            </button>
          </div>
        </Field>
      </form>

      <div className="ideas-toolbar">
        <div className="chip-row">
          <button type="button" className={`chip link${filter === 'open' ? ' accent' : ''}`} onClick={() => setFilter('open')}>
            Ouvertes ({open})
          </button>
          <button type="button" className={`chip link${filter === 'all' ? ' accent' : ''}`} onClick={() => setFilter('all')}>
            Toutes ({total})
          </button>
          <button type="button" className={`chip link${filter === 'done' ? ' accent' : ''}`} onClick={() => setFilter('done')}>
            Faites ({done})
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="ideas-empty">
          {filter === 'done'
            ? 'Aucune idée cochée pour l’instant.'
            : filter === 'open' && total
              ? 'Tout est coché — bravo.'
              : 'Note la première idée pour ce projet.'}
        </p>
      ) : (
        <ul className="ideas-list">
          {visible.map((item) => (
            <li key={item.id} className={item.done ? 'done' : ''}>
              <button
                type="button"
                className="ideas-toggle"
                aria-pressed={item.done}
                aria-label={item.done ? 'Remettre en ouvert' : 'Marquer comme fait'}
                onClick={() => toggle(item.id)}
              >
                {item.done ? <Check size={15} /> : <Square size={15} />}
              </button>
              <span className="ideas-text">{item.text}</span>
              <button
                type="button"
                className="btn icon sm ghost"
                aria-label="Supprimer"
                onClick={() => remove(item.id)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
