import { useState, useEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { Boxes, Bookmark, Layers, Settings as Cog, Sparkles, Terminal, Download, Minus, Square, X } from 'lucide-react'
import Projects from './Projects.jsx'
import Catalog from './Catalog.jsx'
import Blueprints from './Blueprints.jsx'
import Settings, { SETTINGS_SECTIONS } from './Settings.jsx'
import Chat from './Chat.jsx'
import Onboarding from './Onboarding.jsx'
import ConsolePanel from './Console.jsx'
import AiModelPicker from './AiModelPicker.jsx'
import { BrandLockup, BrandMark, applyUiTheme } from './Brand.jsx'
import { api, waitForApi } from './bridge.js'

const VIEWS = {
  projects: { label: 'Projets', icon: Boxes, title: 'Projets', sub: 'Créer, lancer, construire' },
  blueprints: { label: 'Blueprints', icon: Bookmark, title: 'Blueprints', sub: 'Expériences réutilisables' },
  catalog: { label: 'Catalogue', icon: Layers, title: 'Catalogue', sub: 'Frameworks et librairies' },
  settings: { label: 'Réglages', icon: Cog, title: 'Réglages', sub: 'Atelier, dépôts, base et IA' }
}
const ORDER = Object.keys(VIEWS)
const NAV_STEP = 46 // hauteur 42 + gap 4

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isWin = () => window.pdc?.platform === 'win32'

function RestoreGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M4 2.5h5.5V8" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2.5" y="4" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function BootVeil({ fading }) {
  return (
    <div className={`boot-veil${fading ? ' out' : ''}`} aria-busy={!fading} aria-live="polite">
      <div className="boot-chrome">
        <div className="spacer" />
        <WindowControls />
      </div>
      <div className="boot-center">
        <div className="boot-badge">
          <span className="boot-arc" aria-hidden />
          <BrandMark size="boot" />
        </div>
        <p>Ouverture de l’atelier</p>
      </div>
    </div>
  )
}

function WindowControls() {
  const [maxed, setMaxed] = useState(false)
  useEffect(() => {
    if (!isWin()) return undefined
    let off = () => {}
    waitForApi().then(() => {
      api.window.isMaximized().then(setMaxed)
      off = api.on('window:maximized', setMaxed)
    }).catch(() => {})
    return () => off()
  }, [])
  if (!isWin()) return null
  return (
    <div className="win-controls" onDoubleClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Réduire" onClick={() => api.window.minimize()}>
        <Minus size={14} strokeWidth={1.8} />
      </button>
      <button type="button" aria-label={maxed ? 'Restaurer' : 'Agrandir'} onClick={() => api.window.toggleMax()}>
        {maxed ? <RestoreGlyph /> : <Square size={12} strokeWidth={1.8} />}
      </button>
      <button type="button" className="close" aria-label="Fermer" onClick={() => api.window.close()}>
        <X size={14} strokeWidth={1.8} />
      </button>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState(null)
  const [view, setView] = useState('projects')
  const [catalogTab, setCatalogTab] = useState('frameworks')
  const [settingsSection, setSettingsSection] = useState('apparence')
  const [settingsJump, setSettingsJump] = useState(null)
  const [aiProviders, setAiProviders] = useState({})
  const [logs, setLogs] = useState([])
  const [consoleH, setConsoleH] = useState(0)      // 0 = replié
  const [chatOpen, setChatOpen] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [toasts, setToasts] = useState([])
  const [stuck, setStuck] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [bootError, setBootError] = useState(null)
  const [update, setUpdate] = useState(null)
  const [docsStatus, setDocsStatus] = useState(null)
  const [boot, setBoot] = useState('loading')
  const contentRef = useRef(null)
  const lastH = useRef(300)

  const refresh = useCallback(() => {
    if (!window.pdc) return Promise.resolve()
    return api.state.get().then(setState).catch((err) => {
      setBootError(err?.message || String(err))
    })
  }, [])
  useEffect(() => {
    if (state?.uiTheme) applyUiTheme(state.uiTheme)
  }, [state?.uiTheme])

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
    waitForApi().then(() => api.ai.providers().then(setAiProviders)).catch(() => {})
  }, [])

  const pickAiModel = useCallback(async (model) => {
    if (!state?.ai || !model || state.ai.model === model) return
    const next = { ...state.ai, model }
    await api.state.patch({ ai: next })
    refresh()
  }, [state?.ai, refresh])

  useEffect(() => {
    let unsub = () => {}
    waitForApi().then(() => {
      const offLog = api.on('proc:log', (entry) => {
        setLogs((l) => [...l.slice(-2500), entry])
        setConsoleH((h) => (h < 160 ? Math.max(lastH.current || 280, 280) : h))
      })
      const offState = api.on('proc:state', refresh)
      const offProject = api.on('project:changed', refresh)
      unsub = () => { offLog(); offState(); offProject() }
    }).catch(() => {})
    return () => unsub()
  }, [refresh])

  useEffect(() => {
    if (!state || boot !== 'loading') return
    if (reduced()) {
      setBoot('ready')
      return
    }
    const id = requestAnimationFrame(() => setBoot('reveal'))
    return () => cancelAnimationFrame(id)
  }, [state, boot])

  useEffect(() => {
    if (boot !== 'reveal') return
    const t = setTimeout(() => setBoot('ready'), 560)
    return () => clearTimeout(t)
  }, [boot])

  /* changement de vue animé par l'API View Transitions */
  const go = useCallback((id) => {
    if (id === view) return
    if (document.startViewTransition && !reduced()) {
      document.startViewTransition(() => flushSync(() => setView(id)))
    } else setView(id)
  }, [view])

  const goSettingsSection = useCallback((sectionId) => {
    setSettingsSection(sectionId)
    setSettingsJump(`${sectionId}:${Date.now()}`)
    if (view !== 'settings') go('settings')
  }, [view, go])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
    setStuck(false)
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
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((list) => [...list.slice(-3), { key, message, isError, leaving: false }])
    const ttl = isError ? 4200 : 3200
    setTimeout(() => {
      setToasts((list) => list.map((t) => (t.key === key ? { ...t, leaving: true } : t)))
      setTimeout(() => setToasts((list) => list.filter((t) => t.key !== key)), 280)
    }, ttl)
  }, [])

  if (bootError) {
    return (
      <div className="shell">
        <nav className="rail"><div className="drag" /></nav>
        <main className="main">
          <header className="topbar"><div className="spacer" /><WindowControls /></header>
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
      <div className="shell boot-loading">
        <BootVeil fading={false} />
      </div>
    )
  }

  const active = state.projects.find((p) => p.id === activeId)
  const liveCount = state.projects.filter((p) => p.status === 'running' || p.status === 'starting').length
  const meta = VIEWS[view]
  const open = consoleH > 46
  const panelH = Math.max(consoleH, 46)
  const showOnboarding = boot === 'ready' && !state.onboarding?.completed

  return (
    <div className={`shell boot-${boot}${showOnboarding ? ' onboard-behind' : ''}`}>
      <nav className="rail">
        <div className="drag" />
        <BrandLockup tagline="Atelier web" />

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

        {view === 'settings' && (
          <div className="rail-settings" aria-label="Sections des réglages">
            <span className="rail-settings-label">Sections</span>
            {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`rail-settings-item${settingsSection === id ? ' on' : ''}`}
                onClick={() => goSettingsSection(id)}
              >
                <Icon size={14} strokeWidth={1.8} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="rail-foot">
          <button className={`nav-item${chatOpen ? ' on' : ''}`} onClick={() => setChatOpen((v) => !v)}>
            <Sparkles size={17} />
            <span className="nav-label">Assistant</span>
            <span className="nav-count"><span className={`ai-dot${state.ai.model ? ' live' : ''}`} /></span>
          </button>
          <button className={`nav-item${open ? ' on' : ''}`} onClick={toggleConsole}>
            <Terminal size={17} />
            <span className="nav-label">Console</span>
            <span className="nav-count">{liveCount || logs.length || ''}</span>
          </button>
        </div>
      </nav>

      <main className="main">
        <header
          className={`topbar${stuck ? ' stuck' : ''}`}
          onDoubleClick={() => { if (isWin()) api.window.toggleMax() }}
        >
          <h2>{meta.title}</h2>
          <span className="sub">{meta.sub}</span>
          <div className="spacer" />
          {active && <span className="chip accent">Actif · {active.name}</span>}
          <AiModelPicker
            ai={state.ai}
            providers={aiProviders}
            onPick={pickAiModel}
            toast={notify}
          />
          <WindowControls />
        </header>

        {update && (update.status === 'ready' || update.status === 'downloading' || update.status === 'checking') && (
          <div className="update-bar" role="status" aria-live="polite">
            {(update.status === 'downloading' || update.status === 'checking') && <span className="update-spin" aria-hidden />}
            {update.status === 'checking' ? (
              <span>Recherche d’une mise à jour…</span>
            ) : update.status === 'downloading' ? (
              <span>Téléchargement de la {update.version || 'mise à jour'}… {Math.round(update.percent || 0)} %</span>
            ) : (
              <span>PDC Builder {update.version} est prêt — redémarre pour l’installer.</span>
            )}
            <div className="spacer" />
            {update.status === 'ready' && (
              <button className="btn sm primary" onClick={() => api.app.installUpdate()}>
                <Download size={14} /> Mettre à jour
              </button>
            )}
            {update.status === 'downloading' && (
              <div className="update-bar-track" aria-hidden>
                <i className="update-bar-fill" style={{ width: `${Math.max(4, Math.round(update.percent || 0))}%` }} />
              </div>
            )}
          </div>
        )}

        <div
          ref={contentRef}
          className={`content${chatOpen ? ' with-chat' : ''}`}
          onScroll={(e) => setStuck(e.currentTarget.scrollTop > 8)}
          style={{ paddingBottom: panelH + 48 }}
        >
          <div className="content-inner">
            {view === 'projects' && (
              <Projects state={state} refresh={refresh} toast={notify}
                focusProject={(id) => {
                  setActiveId(id)
                  setConsoleH((h) => (h < 160 ? Math.max(lastH.current || 280, 280) : h))
                }} />
            )}
            {view === 'blueprints' && <Blueprints state={state} refresh={refresh} toast={notify} />}
            {view === 'catalog' && <Catalog state={state} refresh={refresh} toast={notify} tab={catalogTab} setTab={setCatalogTab} docsStatus={docsStatus} />}
            {view === 'settings' && (
              <Settings
                state={state}
                refresh={refresh}
                toast={notify}
                update={update}
                docsStatus={docsStatus}
                activeSection={settingsSection}
                onSectionChange={setSettingsSection}
                jumpTo={settingsJump?.split(':')[0]}
              />
            )}
          </div>
        </div>

        <ConsolePanel
          state={state}
          logs={logs}
          height={panelH}
          dragging={dragging}
          onDragStart={startDrag}
          onToggle={toggleConsole}
          onClear={() => setLogs([])}
          focusId={activeId}
          onFocus={setActiveId}
          toast={notify}
        />

        {chatOpen && <Chat state={state} refresh={refresh} toast={notify} project={active} onClose={() => setChatOpen(false)} />}
      </main>

      {toasts.length > 0 && (
        <div className="toast" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.key} className={`toast-item${t.isError ? ' err' : ''}${t.leaving ? ' out' : ''}`}>
              <div className="toast-mark"><BrandMark size="sm" /></div>
              <div className="toast-body">
                <span className="toast-kicker">{t.isError ? 'Attention' : 'PDC Builder'}</span>
                <span className="toast-msg">{t.message}</span>
              </div>
              <div className="toast-bar" aria-hidden><i /></div>
            </div>
          ))}
        </div>
      )}
      {boot !== 'ready' && <BootVeil fading={boot === 'reveal'} />}
      {showOnboarding && (
        <Onboarding state={state} onComplete={refresh} />
      )}
    </div>
  )
}
