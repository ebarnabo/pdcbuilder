import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal, Trash2, Square, Globe, ExternalLink } from 'lucide-react'
import { Chevron, Confirm } from './ui.jsx'
import { api } from './bridge.js'

const HUES = [205, 32, 155, 285, 330, 48, 175, 255]

function colorFor(id, rank) {
  const i = rank >= 0 ? rank : Math.abs(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0))
  const h = HUES[i % HUES.length]
  return `oklch(0.74 0.13 ${h})`
}

export default function ConsolePanel({
  state,
  logs,
  height,
  dragging,
  onDragStart,
  onToggle,
  onClear,
  focusId,
  onFocus,
  toast
}) {
  const [filter, setFilter] = useState('all') // 'all' | projectId
  const [askClear, setAskClear] = useState(false)
  const [busyStop, setBusyStop] = useState('')
  const logRef = useRef(null)
  const open = height > 46

  const byId = useMemo(
    () => Object.fromEntries((state.projects || []).map((p) => [p.id, p])),
    [state.projects]
  )

  const live = useMemo(
    () => (state.projects || []).filter((p) => p.status === 'running' || p.status === 'starting'),
    [state.projects]
  )

  const logProjectIds = useMemo(() => {
    const seen = new Set()
    const ids = []
    for (let i = logs.length - 1; i >= 0; i--) {
      const id = logs[i].projectId
      if (!id || seen.has(id) || id === 'system') continue
      seen.add(id)
      ids.push(id)
      if (ids.length >= 12) break
    }
    return ids
  }, [logs])

  const tabIds = useMemo(() => {
    const ids = []
    const seen = new Set()
    for (const p of live) {
      ids.push(p.id)
      seen.add(p.id)
    }
    for (const id of logProjectIds) {
      if (seen.has(id)) continue
      ids.push(id)
      seen.add(id)
    }
    return ids
  }, [live, logProjectIds])

  const rankOf = useMemo(() => {
    const map = new Map()
    tabIds.forEach((id, i) => map.set(id, i))
    return map
  }, [tabIds])

  useEffect(() => {
    if (focusId && tabIds.includes(focusId)) setFilter(focusId)
  }, [focusId, tabIds])

  useEffect(() => {
    if (filter !== 'all' && !tabIds.includes(filter) && !live.some((p) => p.id === filter)) {
      setFilter('all')
    }
  }, [filter, tabIds, live])

  const visible = useMemo(() => {
    if (filter === 'all') return logs
    return logs.filter((l) => l.projectId === filter)
  }, [logs, filter])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    logRef.current?.scrollTo({ top: 1e9, behavior: reduced ? 'auto' : 'smooth' })
  }, [visible, height, filter])

  const activeLive = live.find((p) => p.id === filter)
  const openUrl = activeLive?.url || (filter === 'all' ? live.find((p) => p.url)?.url : null)

  const stopOne = async (id) => {
    setBusyStop(id)
    try {
      await api.run.stop(id)
      toast?.(`${byId[id]?.name || 'Projet'} arrêté`)
    } finally {
      setBusyStop('')
    }
  }

  const stopAll = async () => {
    setBusyStop('all')
    try {
      const r = await api.run.stopAll()
      const n = r?.stopped?.length || 0
      toast?.(n ? `${n} serveur${n > 1 ? 's' : ''} arrêté${n > 1 ? 's' : ''}` : 'Aucun serveur actif')
      setFilter('all')
    } finally {
      setBusyStop('')
    }
  }

  return (
    <>
      <section
        className={`console${dragging ? ' dragging' : ''}${live.length > 1 ? ' multi' : ''}`}
        style={{ height }}
        aria-label="Journal des commandes"
      >
        {open && <div className="console-grip" onMouseDown={onDragStart} role="separator" aria-orientation="horizontal" />}

        <div className="console-head">
          <Terminal size={14} color="var(--text-3)" />
          <strong>Console</strong>
          {live.length > 0 && (
            <span className="chip accent console-live-count">
              {live.length} actif{live.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="console-meta">
            {visible.length ? `${visible.length} lignes` : 'aucune activité'}
          </span>
          {openUrl && (
            <button
              type="button"
              className="btn sm primary console-open-url"
              onClick={() => api.fs.openUrl(openUrl)}
              title={openUrl}
            >
              <Globe size={13} />
              Ouvrir {openUrl.replace(/^https?:\/\//, '')}
              <ExternalLink size={11} aria-hidden />
            </button>
          )}
          <div className="spacer" />
          {filter !== 'all' && (byId[filter]?.status === 'running' || byId[filter]?.status === 'starting') && (
            <button
              type="button"
              className="btn sm"
              disabled={!!busyStop}
              onClick={() => stopOne(filter)}
            >
              <Square size={13} /> Arrêter
            </button>
          )}
          {live.length > 1 && (
            <button type="button" className="btn sm" disabled={!!busyStop} onClick={stopAll}>
              <Square size={13} /> Tout arrêter
            </button>
          )}
          {live.length === 1 && filter === 'all' && (
            <button type="button" className="btn sm" disabled={!!busyStop} onClick={() => stopOne(live[0].id)}>
              <Square size={13} /> Arrêter
            </button>
          )}
          {logs.length > 0 && (
            <button type="button" className="btn icon sm ghost" aria-label="Vider la console" onClick={() => setAskClear(true)}>
              <Trash2 size={14} />
            </button>
          )}
          <button type="button" className="btn icon sm ghost" aria-label={open ? 'Réduire' : 'Déplier'} onClick={onToggle}>
            <Chevron open={!open} size={16} />
          </button>
        </div>

        {open && tabIds.length > 0 && (
          <div className="console-tabs" role="tablist" aria-label="Terminaux">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={`console-tab${filter === 'all' ? ' on' : ''}`}
              onClick={() => setFilter('all')}
            >
              Tous
              <em>{logs.length || ''}</em>
            </button>
            {tabIds.map((id) => {
              const p = byId[id]
              const isLive = p?.status === 'running' || p?.status === 'starting'
              const color = colorFor(id, rankOf.get(id) ?? -1)
              const count = logs.filter((l) => l.projectId === id).length
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  className={`console-tab${filter === id ? ' on' : ''}${isLive ? ' live' : ''}`}
                  style={{ '--session': color }}
                  onClick={() => {
                    setFilter(id)
                    onFocus?.(id)
                  }}
                >
                  <i className="console-dot" aria-hidden />
                  <span className="console-tab-name">{p?.name || id}</span>
                  {isLive && <span className="console-tab-pulse" aria-label="en cours" />}
                  <em>{count || ''}</em>
                  {isLive && (
                    <span
                      className="console-tab-stop"
                      title="Arrêter ce serveur"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        stopOne(id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          stopOne(id)
                        }
                      }}
                    >
                      <Square size={10} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {open && (
          <div className="console-body" ref={logRef}>
            {visible.length === 0 ? (
              <span style={{ color: 'var(--text-3)' }}>
                {filter === 'all'
                  ? 'Lance un projet : créations, installs, builds et serveurs s’affichent ici en direct.'
                  : 'Pas encore de sortie pour ce projet — relance-le ou regarde l’onglet Tous.'}
              </span>
            ) : (
              visible.map((l, i) => {
                const color = colorFor(l.projectId, rankOf.get(l.projectId) ?? -1)
                const name = byId[l.projectId]?.name || (l.projectId === 'system' ? 'système' : l.projectId)
                const time = l.at
                  ? new Date(l.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : ''
                return (
                  <div className={`line ${l.kind}`} key={`${l.at || 0}-${i}-${l.line?.slice(0, 24) || ''}`}>
                    {time && <span className="console-time" title={time}>{time}</span>}
                    {filter === 'all' && (
                      <button
                        type="button"
                        className="who"
                        style={{ '--session': color }}
                        title={name}
                        onClick={() => {
                          if (l.projectId && l.projectId !== 'system') {
                            setFilter(l.projectId)
                            onFocus?.(l.projectId)
                          }
                        }}
                      >
                        <i className="console-dot" aria-hidden />
                        {name}
                      </button>
                    )}
                    <span>{l.line}</span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </section>

      {askClear && (
        <Confirm
          title="Vider la console ?"
          subtitle={`${logs.length} ligne${logs.length > 1 ? 's' : ''} seront effacées. Les fichiers des projets ne bougent pas.`}
          confirm="Vider"
          onClose={() => setAskClear(false)}
          onConfirm={() => { onClear(); setAskClear(false) }}
        />
      )}
    </>
  )
}
