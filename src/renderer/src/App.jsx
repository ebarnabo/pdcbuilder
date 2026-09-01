import { useState, useEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { Boxes, Bookmark, Layers, Settings as Cog, Sparkles, Terminal, Trash2, Download } from 'lucide-react'
import Projects from './Projects.jsx'
import Catalog from './Catalog.jsx'
import Blueprints from './Blueprints.jsx'
import Settings from './Settings.jsx'
import Chat from './Chat.jsx'
import { Chevron } from './ui.jsx'
import { api, waitForApi } from './bridge.js'

const VIEWS = {
  projects: { label: 'Projets', icon: Boxes, title: 'Projets', sub: 'Créer, lancer, construire' },
  blueprints: { label: 'Blueprints', icon: Bookmark, title: 'Blueprints', sub: 'Bases réutilisables' },
  catalog: { label: 'Catalogue', icon: Layers, title: 'Catalogue', sub: 'Frameworks et librairies' },
  settings: { label: 'Réglages', icon: Cog, title: 'Réglages', sub: 'Atelier, dépôts et IA' }
}
const ORDER = Object.keys(VIEWS)
const NAV_STEP = 46 // hauteur 42 + gap 4

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function App() {
  const [state, setState] = useState(null)
  const [view, setView] = useState('projects')
  const [catalogTab, setCatalogTab] = useState('frameworks')
  const [logs, setLogs] = useState([])
  const [consoleH, setConsoleH] = useState(0)      // 0 = replié
  const [chatOpen, setChatOpen] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [toast, setToast] = useState(null)
  const [stuck, setStuck] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [bootError, setBootError] = useState(null)
  const [update, setUpdate] = useState(null)
  const [docsStatus, setDocsStatus] = useState(null)
  const logRef = useRef(null)
  const lastH = useRef(300)

  const refresh = useCallback(() => {
    if (!window.pdc) return Promise.resolve()
    return api.state.get().then(setState).catch((err) => {
      setBootError(err?.message || String(err))
    })
  }, [])
  useEffect(() => {
    waitForApi()
      .then(() => refresh())
      .catch((err) => setBootError(err.message))
  }, [refresh])

  useEffect(() => {
    let off = () => {}
    waitForApi().then(() => {
      api.app.updateStatus().then(setUpdate)
      off = api.on('app:update', setUpdate)
    }).catch(() => {})
    return () => off()
  }, [])

  useEffect(() => {
    let off = () => {}
    waitForApi().then(() => {
      api.docs.status().then(setDocsStatus)
      off = api.on('docs:status', setDocsStatus)
    }).catch(() => {})
    return () => off()
  }, [])

  useEffect(() => {
    let unsub = () => {}
    waitForApi().then(() => {
      const offLog = api.on('proc:log', (entry) => {
        setLogs((l) => [...l.slice(-800), entry])
        setConsoleH((h) => (h === 0 ? lastH.current : h))
      })
      const offState = api.on('proc:state', refresh)
      const offProject = api.on('project:changed', refresh)
      unsub = () => { offLog(); offState(); offProject() }
    }).catch(() => {})
    return () => unsub()
  }, [refresh])

  useEffect(() => { logRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [logs, consoleH])

  /* changement de vue animé par l'API View Transitions */
  const go = useCallback((id) => {
    if (id === view) return
    if (document.startViewTransition && !reduced()) {
      document.startViewTransition(() => flushSync(() => setView(id)))
    } else setView(id)
  }, [view])

  const toggleConsole = useCallback(() => {
    setConsoleH((h) => {
      if (h > 0) { lastH.current = h; return 0 }
      return lastH.current
    })
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'k') { e.preventDefault(); setChatOpen((v) => !v) }
      if (mod && e.key === 'j') { e.preventDefault(); toggleConsole() }
      if (mod && e.key >= '1' && e.key <= '4') { e.preventDefault(); go(ORDER[Number(e.key) - 1]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, toggleConsole])

  /* poignée de redimensionnement de la console */
  const startDrag = (e) => {
    e.preventDefault()
    setDragging(true)
    const move = (ev) => {
      const h = Math.min(Math.max(46, window.innerHeight - ev.clientY), window.innerHeight - 160)
      setConsoleH(h)
      lastH.current = h
    }
    const up = () => {
      setDragging(false)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const notify = useCallback((message, isError = false) => {
    setToast({ message, isError, key: Date.now() })
    setTimeout(() => setToast((t) => (t?.message === message ? null : t)), 3400)
  }, [])

  if (bootError) {
    return (
      <div className="shell">
        <nav className="rail"><div className="drag" /></nav>
        <main className="main">
          <div className="content"><div className="content-inner">
            <div className="empty">
              <strong>Impossible de démarrer l’interface</strong>
              <p>{bootError}</p>
            </div>
          </div></div>
        </main>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="shell">
        <nav className="rail"><div className="drag" /></nav>
        <main className="main">
          <div className="content"><div className="content-inner">
            <div className="grid">{[0, 1, 2].map((i) => <div className="skeleton" key={i} />)}</div>
          </div></div>
        </main>
      </div>
    )
  }

  const active = state.projects.find((p) => p.id === activeId)
  const meta = VIEWS[view]
  const open = consoleH > 46
  const panelH = Math.max(consoleH, 46)

  return (
    <div className="shell">
      <nav className="rail">
        <div className="drag" />
        <div className="brand">
          <div className="mark">PB</div>
          <div>
            <h1>PDC Builder</h1>
            <span>Atelier web</span>
          </div>
        </div>

        <div className="nav">
          <span className="nav-thumb" style={{ transform: `translateY(${ORDER.indexOf(view) * NAV_STEP}px)` }} />
          {ORDER.map((id) => {
            const v = VIEWS[id]
            const Icon = v.icon
            const count = id === 'projects' ? state.projects.length
              : id === 'blueprints' ? state.blueprints.length
              : id === 'catalog' ? state.frameworks.length : null
            return (
              <button key={id} className={`nav-item${view === id ? ' on' : ''}`} onClick={() => go(id)} aria-current={view === id}>
                <Icon size={17} />
                <span className="nav-label">{v.label}</span>
                {count != null && <span className="nav-count">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="rail-foot">
          <button className={`nav-item${chatOpen ? ' on' : ''}`} onClick={() => setChatOpen((v) => !v)}>
            <Sparkles size={17} />
            <span className="nav-label">Assistant</span>
            <span className="nav-count"><span className={`ai-dot${state.ai.model ? ' live' : ''}`} /></span>
          </button>
          <button className={`nav-item${open ? ' on' : ''}`} onClick={toggleConsole}>
            <Terminal size={17} />
            <span className="nav-label">Console</span>
            <span className="nav-count">{logs.length || ''}</span>
          </button>
        </div>
      </nav>

      <main className="main">
        <header className={`topbar${stuck ? ' stuck' : ''}`}>
          <h2>{meta.title}</h2>
          <span className="sub">{meta.sub}</span>
          <div className="spacer" />
          {active && <span className="chip accent">Actif · {active.name}</span>}
        </header>

        {update && (update.status === 'ready' || update.status === 'downloading') && (
          <div className="update-bar">
            {update.status === 'downloading' ? (
              <span>Téléchargement de la {update.version || 'mise à jour'}… {Math.round(update.percent || 0)} %</span>
            ) : (
              <span>PDC Builder {update.version} est prêt.</span>
            )}
            <div className="spacer" />
            {update.status === 'ready' && (
              <button className="btn sm primary" onClick={() => api.app.installUpdate()}>
                <Download size={14} /> Mettre à jour
              </button>
            )}
          </div>
        )}

        <div
          className="content"
          onScroll={(e) => setStuck(e.currentTarget.scrollTop > 8)}
          style={{ paddingBottom: panelH + 48 }}
        >
          <div className="content-inner">
            {view === 'projects' && (
              <Projects state={state} refresh={refresh} toast={notify}
                focusProject={(id) => { setActiveId(id); setConsoleH((h) => (h === 0 ? lastH.current : h)) }} />
            )}
            {view === 'blueprints' && <Blueprints state={state} refresh={refresh} toast={notify} />}
            {view === 'catalog' && <Catalog state={state} refresh={refresh} toast={notify} tab={catalogTab} setTab={setCatalogTab} docsStatus={docsStatus} />}
            {view === 'settings' && <Settings state={state} refresh={refresh} toast={notify} update={update} docsStatus={docsStatus} />}
          </div>
        </div>

        <section
          className={`console${dragging ? ' dragging' : ''}`}
          style={{ height: panelH }}
          aria-label="Journal des commandes"
        >
          {open && <div className="console-grip" onMouseDown={startDrag} role="separator" aria-orientation="horizontal" />}
          <div className="console-head">
            <Terminal size={14} color="var(--text-3)" />
            <strong>Console</strong>
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
              {logs.length ? `${logs.length} lignes` : 'aucune activité'}
            </span>
            <div className="spacer" />
            {logs.length > 0 && (
              <button className="btn icon sm ghost" aria-label="Vider la console" onClick={() => setLogs([])}><Trash2 size={14} /></button>
            )}
            <button className="btn icon sm ghost" aria-label={open ? 'Réduire' : 'Déplier'} onClick={toggleConsole}>
              <Chevron open={!open} size={16} />
            </button>
          </div>
          {open && (
            <div className="console-body" ref={logRef}>
              {logs.length === 0
                ? <span style={{ color: 'var(--text-3)' }}>Les créations, installations et builds s’affichent ici.</span>
                : logs.map((l, i) => (
                    <div className={`line ${l.kind}`} key={i}>
                      <span className="who">{state.projects.find((p) => p.id === l.projectId)?.name || l.projectId}</span>
                      <span>{l.line}</span>
                    </div>
                  ))}
            </div>
          )}
        </section>

        {chatOpen && <Chat state={state} refresh={refresh} toast={notify} project={active} onClose={() => setChatOpen(false)} />}
      </main>

      {toast && <div key={toast.key} className={`toast${toast.isError ? ' err' : ''}`}>{toast.message}</div>}
    </div>
  )
}
