import { useEffect, useMemo, useRef, useState } from 'react'
import { GanttChart, Plus, Trash2, CalendarRange, Sparkles } from 'lucide-react'
import { Modal, Field, Empty } from './ui.jsx'
import { api } from './bridge.js'

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const STATUS = [
  { id: 'planned', label: 'Prévu' },
  { id: 'active', label: 'En cours' },
  { id: 'done', label: 'Fait' }
]

const DAY = 86_400_000

function toDay(value) {
  if (!value) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const s = String(value).slice(0, 10)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function toInput(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function todayUtc() {
  const n = new Date()
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())
}

function addDays(ms, n) {
  return ms + n * DAY
}

function formatShort(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function normalizeStages(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((item, i) => {
      let start = toDay(item?.start)
      let end = toDay(item?.end)
      if (start == null && end == null) {
        start = addDays(todayUtc(), i * 7)
        end = addDays(start, 6)
      } else if (start == null) start = end
      else if (end == null) end = start
      if (end < start) [start, end] = [end, start]
      const status = STATUS.some((s) => s.id === item?.status) ? item.status : 'planned'
      return {
        id: String(item?.id || uid()),
        title: String(item?.title || item?.name || '').trim().slice(0, 80),
        start,
        end,
        status,
        notes: String(item?.notes || '').trim().slice(0, 240)
      }
    })
    .filter((item) => item.title)
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

export function stagesStats(list) {
  const items = normalizeStages(list)
  return {
    total: items.length,
    done: items.filter((i) => i.status === 'done').length,
    active: items.filter((i) => i.status === 'active').length
  }
}

export function defaultStageTemplate() {
  const t0 = todayUtc()
  return normalizeStages([
    { title: 'Cadrage', start: toInput(t0), end: toInput(addDays(t0, 6)), status: 'active' },
    { title: 'Conception', start: toInput(addDays(t0, 5)), end: toInput(addDays(t0, 18)), status: 'planned' },
    { title: 'Développement', start: toInput(addDays(t0, 14)), end: toInput(addDays(t0, 35)), status: 'planned' },
    { title: 'Tests & polish', start: toInput(addDays(t0, 32)), end: toInput(addDays(t0, 45)), status: 'planned' },
    { title: 'Mise en ligne', start: toInput(addDays(t0, 42)), end: toInput(addDays(t0, 49)), status: 'planned' }
  ])
}

function buildTimeline(stages) {
  const today = todayUtc()
  if (!stages.length) {
    return { start: today, end: addDays(today, 28), days: 29, today }
  }
  let start = Math.min(...stages.map((s) => s.start))
  let end = Math.max(...stages.map((s) => s.end))
  start = addDays(start, -2)
  end = addDays(end, 3)
  if (today < start) start = addDays(today, -1)
  if (today > end) end = addDays(today, 2)
  const days = Math.max(1, Math.round((end - start) / DAY) + 1)
  return { start, end, days, today }
}

function monthTicks(range) {
  const ticks = []
  const d = new Date(range.start)
  let cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
  if (cursor < range.start) cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
  while (cursor <= range.end) {
    const offset = (cursor - range.start) / DAY
    ticks.push({
      ms: cursor,
      left: (offset / range.days) * 100,
      label: new Date(cursor).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    })
    const next = new Date(cursor)
    cursor = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1)
  }
  return ticks
}

/** Mini barre sur la carte projet. */
export function StagesSnippet({ project, onOpen }) {
  const stages = normalizeStages(project.stages)
  const stats = stagesStats(stages)
  if (!stats.total) {
    return (
      <button type="button" className="proj-gantt-empty" onClick={onOpen}>
        <GanttChart size={13} /> Planifier des étapes
      </button>
    )
  }

  const range = buildTimeline(stages)
  return (
    <button type="button" className="proj-gantt-snip" onClick={onOpen} title="Ouvrir le planning">
      <div className="proj-gantt-snip-head">
        <span><GanttChart size={12} /> Étapes <em>{stats.done}/{stats.total}</em></span>
        <span className="linkish">Gantt</span>
      </div>
      <div className="proj-gantt-snip-track" aria-hidden>
        {stages.slice(0, 5).map((s) => {
          const left = ((s.start - range.start) / DAY / range.days) * 100
          const width = Math.max(2, ((s.end - s.start) / DAY + 1) / range.days * 100)
          return (
            <i
              key={s.id}
              className={`proj-gantt-snip-bar status-${s.status}`}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          )
        })}
        <i
          className="proj-gantt-snip-today"
          style={{ left: `${((range.today - range.start) / DAY / range.days) * 100}%` }}
        />
      </div>
    </button>
  )
}

function GanttView({ stages, selectedId, onSelect }) {
  const range = useMemo(() => buildTimeline(stages), [stages])
  const ticks = useMemo(() => monthTicks(range), [range])
  const todayLeft = ((range.today - range.start) / DAY / range.days) * 100

  return (
    <div className="gantt">
      <div className="gantt-head">
        <div className="gantt-label-col">Étape</div>
        <div className="gantt-time-col">
          <div className="gantt-months">
            {ticks.map((t) => (
              <span key={t.ms} style={{ left: `${t.left}%` }}>{t.label}</span>
            ))}
          </div>
          <div className="gantt-range-hint">
            {formatShort(range.start)} → {formatShort(range.end)}
          </div>
        </div>
      </div>
      <div className="gantt-body">
        {stages.map((s, i) => {
          const left = ((s.start - range.start) / DAY / range.days) * 100
          const width = Math.max(1.5, ((s.end - s.start) / DAY + 1) / range.days * 100)
          const on = selectedId === s.id
          return (
            <div
              key={s.id}
              className={`gantt-row${on ? ' on' : ''}`}
              style={{ '--i': Math.min(i, 10) }}
              onClick={() => onSelect?.(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(s.id) } }}
              role="button"
              tabIndex={0}
            >
              <div className="gantt-label-col">
                <strong>{s.title}</strong>
                <span className={`chip status-${s.status}`}>{STATUS.find((x) => x.id === s.status)?.label}</span>
              </div>
              <div className="gantt-time-col">
                <div className="gantt-track">
                  <i className="gantt-today" style={{ left: `${todayLeft}%` }} title="Aujourd’hui" />
                  <button
                    type="button"
                    className={`gantt-bar status-${s.status}${on ? ' on' : ''}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${s.title} · ${formatShort(s.start)} → ${formatShort(s.end)}`}
                    onClick={(e) => { e.stopPropagation(); onSelect?.(s.id) }}
                  >
                    <span>{s.title}</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StageEditor({ stage, onChange, onRemove }) {
  if (!stage) {
    return <p className="card-desc" style={{ margin: 0 }}>Sélectionne une barre du Gantt pour l’éditer.</p>
  }
  return (
    <div className="gantt-editor">
      <Field label="Titre">
        <input
          className="input"
          value={stage.title}
          onChange={(e) => onChange({ ...stage, title: e.target.value })}
          maxLength={80}
        />
      </Field>
      <div className="row">
        <Field label="Début">
          <input
            className="input"
            type="date"
            value={toInput(stage.start)}
            onChange={(e) => {
              const start = toDay(e.target.value) ?? stage.start
              onChange({ ...stage, start, end: Math.max(stage.end, start) })
            }}
          />
        </Field>
        <Field label="Fin">
          <input
            className="input"
            type="date"
            value={toInput(stage.end)}
            onChange={(e) => {
              const end = toDay(e.target.value) ?? stage.end
              onChange({ ...stage, end, start: Math.min(stage.start, end) })
            }}
          />
        </Field>
      </div>
      <Field label="Statut">
        <div className="row" style={{ gap: 6 }}>
          {STATUS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`btn sm${stage.status === s.id ? ' primary' : ''}`}
              onClick={() => onChange({ ...stage, status: s.id })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Notes">
        <textarea
          className="textarea"
          rows={2}
          value={stage.notes || ''}
          onChange={(e) => onChange({ ...stage, notes: e.target.value })}
          placeholder="Livrable, dépendance…"
        />
      </Field>
      <button type="button" className="btn sm danger" onClick={() => onRemove(stage.id)}>
        <Trash2 size={14} /> Supprimer l’étape
      </button>
    </div>
  )
}

export function StagesPanel({ project, act, compact = false }) {
  const [stages, setStages] = useState(() => normalizeStages(project.stages))
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState('')
  const saveTimer = useRef(null)

  useEffect(() => {
    setStages(normalizeStages(project.stages))
  }, [project.id, project.stages])

  const selected = stages.find((s) => s.id === selectedId) || null

  const persist = (next, toastMsg = null) => {
    setStages(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      act(
        () => api.project.update({ id: project.id, fields: { stages: next } }),
        toastMsg
      )
    }, 280)
  }

  const add = () => {
    const title = draft.trim() || `Étape ${stages.length + 1}`
    const last = stages[stages.length - 1]
    const start = last ? addDays(last.end, 1) : todayUtc()
    const next = normalizeStages([
      ...stages,
      { id: uid(), title, start: toInput(start), end: toInput(addDays(start, 6)), status: 'planned' }
    ])
    setDraft('')
    setSelectedId(next[next.length - 1]?.id || null)
    persist(next, null)
  }

  const applyTemplate = () => {
    const next = defaultStageTemplate()
    setSelectedId(next[0]?.id || null)
    persist(next, 'Planning type appliqué')
  }

  if (!stages.length) {
    return (
      <div className={`gantt-wrap${compact ? ' compact' : ''}`}>
        <Empty
          icon={<CalendarRange size={36} color="var(--accent)" strokeWidth={1.4} />}
          title="Aucune étape"
          text="Découpe le projet en phases datées — le Gantt se construit tout seul."
          action={(
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn primary" onClick={applyTemplate}>
                <Sparkles size={15} /> Modèle 5 étapes
              </button>
              <button type="button" className="btn" onClick={add}>
                <Plus size={15} /> Première étape
              </button>
            </div>
          )}
        />
      </div>
    )
  }

  return (
    <div className={`gantt-wrap${compact ? ' compact' : ''}`}>
      <div className="gantt-toolbar">
        <div className="row" style={{ flex: 1, minWidth: 180 }}>
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nouvelle étape…"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          />
          <button type="button" className="btn primary" onClick={add}>
            <Plus size={15} /> Ajouter
          </button>
        </div>
        <span className="chip accent">
          {stagesStats(stages).done}/{stages.length} terminée{stages.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="gantt-layout">
        <GanttView stages={stages} selectedId={selectedId} onSelect={setSelectedId} />
        <StageEditor
          stage={selected}
          onChange={(nextStage) => {
            persist(stages.map((s) => (s.id === nextStage.id ? { ...nextStage, title: nextStage.title.trim() || s.title } : s)))
          }}
          onRemove={(id) => {
            const next = stages.filter((s) => s.id !== id)
            setSelectedId(next[0]?.id || null)
            persist(next, null)
          }}
        />
      </div>
    </div>
  )
}

export function StagesModal({ project, onClose, act }) {
  return (
    <Modal
      title={`Planning · ${project.name}`}
      subtitle="Étapes datées en vue Gantt — clique une barre pour l’éditer."
      onClose={onClose}
      width={920}
      footer={
        <button type="button" className="btn primary" onClick={onClose}>Fermer</button>
      }
    >
      <StagesPanel project={project} act={act} />
    </Modal>
  )
}
