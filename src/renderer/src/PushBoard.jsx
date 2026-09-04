import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CloudUpload, RefreshCw, ChevronDown } from 'lucide-react'
import { api } from './bridge.js'

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function levelFor(count, max) {
  if (!count) return 0
  if (!max || max <= 1) return count ? 1 : 0
  const r = count / max
  if (r <= 0.25) return 1
  if (r <= 0.5) return 2
  if (r <= 0.75) return 3
  return 4
}

function formatDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${WEEKDAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]} ${y}`
}

function buildWeeks(days) {
  if (!days?.length) return []
  const weeks = []
  let col = []
  // Pad start so columns are Sunday→Saturday like GitHub
  const first = new Date(days[0].at)
  const pad = first.getDay() // 0 = Sunday
  for (let i = 0; i < pad; i++) col.push(null)
  for (const day of days) {
    col.push(day)
    if (col.length === 7) {
      weeks.push(col)
      col = []
    }
  }
  if (col.length) {
    while (col.length < 7) col.push(null)
    weeks.push(col)
  }
  return weeks
}

function monthLabels(weeks) {
  const labels = []
  let prev = ''
  weeks.forEach((week, i) => {
    const first = week.find((d) => d)
    if (!first) {
      labels.push('')
      return
    }
    const m = MONTHS[new Date(first.at).getMonth()]
    if (m !== prev) {
      labels.push(m)
      prev = m
    } else {
      labels.push('')
    }
  })
  return labels
}

export default function PushBoard({ projects, toast, refreshKey }) {
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [board, setBoard] = useState(null)
  const [hover, setHover] = useState(null) // { day, x, y }
  const heatRef = useRef(null)

  const load = useCallback(async () => {
    if (!projects?.length) {
      setBoard(null)
      return
    }
    setLoading(true)
    try {
      const r = await api.git.board()
      setBoard(r)
    } catch (e) {
      toast?.(e?.message || 'Impossible de lire l’activité', true)
    } finally {
      setLoading(false)
    }
  }, [projects?.length, toast])

  useEffect(() => { load() }, [load, refreshKey])

  const calendar = board?.calendar
  const weeks = useMemo(() => buildWeeks(calendar?.days || []), [calendar?.days])
  const labels = useMemo(() => monthLabels(weeks), [weeks])
  const summary = board?.summary
  const actionCount = summary
    ? (summary.draft || 0) + (summary.ahead || 0) + (summary.behind || 0)
    : 0

  if (!projects?.length) return null

  const showTip = (day, el) => {
    const rect = el.getBoundingClientRect()
    const root = heatRef.current?.getBoundingClientRect()
    if (!root) return
    setHover({
      day,
      x: rect.left - root.left + rect.width / 2,
      y: rect.top - root.top
    })
  }

  return (
    <section className={`push-board${open ? ' open' : ''}`} aria-label="Carte des push">
      <button type="button" className="push-board-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="push-board-title">
          <CloudUpload size={18} strokeWidth={1.8} />
          <div>
            <strong>Carte des push</strong>
            <span>
              {calendar
                ? `${calendar.total} activité${calendar.total > 1 ? 's' : ''} · ${calendar.activeDays} jour${calendar.activeDays > 1 ? 's' : ''}`
                : 'Activité sur tes dépôts'}
            </span>
          </div>
        </div>
        <div className="push-board-stats">
          {actionCount > 0 && <span className="chip accent">{actionCount} à traiter</span>}
          <ChevronDown size={16} className={`push-chevron${open ? ' up' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="push-board-body">
          <div className="push-board-toolbar">
            <p className="form-section-lead" style={{ margin: 0 }}>
              Chaque point = un jour avec commits ou push. Survole pour le détail.
            </p>
            <button type="button" className="btn sm ghost" disabled={loading} onClick={load}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualiser
            </button>
          </div>

          {loading && !calendar ? (
            <p className="push-board-empty">Lecture de l’activité…</p>
          ) : (
            <div className="push-heat-wrap" ref={heatRef} onMouseLeave={() => setHover(null)}>
              <div className="push-heat-months" aria-hidden>
                <span className="push-heat-spacer" />
                {labels.map((label, i) => (
                  <span key={`m-${i}`} className="push-heat-month">{label}</span>
                ))}
              </div>
              <div className="push-heat">
                <div className="push-heat-days" aria-hidden>
                  {WEEKDAYS.map((d, i) => (
                    <span key={d} className={i % 2 === 1 ? 'on' : ''}>{i % 2 === 1 ? d : ''}</span>
                  ))}
                </div>
                <div className="push-heat-grid" role="img" aria-label="Calendrier d’activité Git">
                  {weeks.map((week, wi) => (
                    <div className="push-heat-col" key={`w-${wi}`}>
                      {week.map((day, di) => {
                        if (!day) return <span key={`e-${wi}-${di}`} className="push-heat-cell empty" />
                        const lvl = levelFor(day.count, calendar?.max || 0)
                        return (
                          <button
                            key={day.date}
                            type="button"
                            className={`push-heat-cell l${lvl}`}
                            aria-label={`${formatDay(day.date)} · ${day.count} activité${day.count > 1 ? 's' : ''}`}
                            onMouseEnter={(e) => showTip(day, e.currentTarget)}
                            onFocus={(e) => showTip(day, e.currentTarget)}
                            onBlur={() => setHover(null)}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="push-heat-legend">
                <span>Moins</span>
                {[0, 1, 2, 3, 4].map((l) => (
                  <i key={l} className={`push-heat-cell l${l}`} aria-hidden />
                ))}
                <span>Plus</span>
              </div>

              {hover?.day && (
                <div
                  className="push-heat-tip"
                  style={{ left: hover.x, top: hover.y }}
                  role="tooltip"
                >
                  <strong>{formatDay(hover.day.date)}</strong>
                  {!hover.day.count ? (
                    <p>Aucune activité</p>
                  ) : (
                    <>
                      <p>
                        {hover.day.count} activité{hover.day.count > 1 ? 's' : ''}
                      </p>
                      <ul>
                        {hover.day.items.slice(0, 8).map((item, i) => (
                          <li key={`${item.at}-${item.hash || i}`}>
                            <em>{item.type === 'push' ? 'push' : 'commit'}</em>
                            <span>{item.name}</span>
                            <span className="push-heat-tip-msg">{item.message}</span>
                          </li>
                        ))}
                        {hover.day.items.length > 8 && (
                          <li className="more">+{hover.day.items.length - 8} autres</li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
