import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  X, Send, Square, Sparkles, FileDown, PlusCircle, Eraser, FileCode2,
  Loader2, Check, ChevronDown, FolderGit2, Wand2
} from 'lucide-react'
import { Confirm } from './ui.jsx'
import { themeLabels } from './themes.jsx'
import { api } from './bridge.js'

const uid = () => Math.random().toString(36).slice(2, 10)

/** Découpe la réponse en blocs texte / code (path=… dans l’info-string). */
function parse(md) {
  const parts = []
  const re = /```([^\n]*)\n([\s\S]*?)```/g
  let last = 0
  let m
  while ((m = re.exec(md))) {
    if (m.index > last) parts.push({ type: 'text', value: md.slice(last, m.index) })
    const info = m[1].trim()
    const lang = info.split(/\s+/)[0] || 'text'
    const path = (info.match(/path=["']?([^"'\s]+)/) || [])[1] || null
    parts.push({ type: 'code', lang, path, value: m[2], complete: true })
    last = re.lastIndex
  }
  if (last < md.length) {
    const rest = md.slice(last)
    const open = rest.match(/```([^\n]*)\n?([\s\S]*)$/)
    if (open && (rest.match(/```/g) || []).length % 2 === 1) {
      if (open.index > 0) parts.push({ type: 'text', value: rest.slice(0, open.index) })
      const info = (open[1] || '').trim()
      const lang = info.split(/\s+/)[0] || 'text'
      const path = (info.match(/path=["']?([^"'\s]+)/) || [])[1] || null
      parts.push({ type: 'code', lang, path, value: open[2] || '', complete: false })
    } else {
      parts.push({ type: 'text', value: rest })
    }
  }
  return parts
}

function activityFromContent(content, streaming) {
  if (!streaming) return null
  if (!content) return { label: 'Réflexion…', kind: 'think' }
  const parts = parse(content)
  const drafting = [...parts].reverse().find((p) => p.type === 'code' && !p.complete)
  if (drafting?.path) return { label: `Écriture de ${drafting.path}`, kind: 'file', path: drafting.path }
  if (drafting) return { label: `Génération (${drafting.lang})…`, kind: 'code' }
  return { label: 'Réponse en cours…', kind: 'stream' }
}

const PROJECT_PROMPTS = (name) => [
  { id: 'structure', label: 'Expliquer la structure', prompt: `Explique la structure du projet ${name} et ce que je dois ouvrir en premier.` },
  { id: 'theme', label: 'Thème dark', prompt: `Propose et écris les fichiers pour un thème dark chaud cohérent dans ${name}.` },
  { id: 'nav', label: 'Navigation', prompt: `Ajoute une navigation moderne et accessible dans ${name}.` },
  { id: 'readme', label: 'README', prompt: `Rédige un README.md clair pour ${name} (stack, scripts, démarrage).` },
  { id: 'libs', label: 'Librairies', prompt: `Quelles librairies du catalogue PDC recommandes-tu pour ${name}, et pourquoi ?` },
  { id: 'fix', label: 'Corriger', prompt: `Repère les problèmes évidents du projet ${name} et propose des correctifs avec fichiers.` }
]

export default function Chat({
  state,
  refresh,
  toast,
  onClose,
  project: activeProject,
  projectId: controlledProjectId,
  onProjectId,
  seed,
  onSeedConsumed
}) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [ask, setAsk] = useState(null)
  const [applied, setApplied] = useState({}) // key path+turn -> true
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState(null)
  const chatId = useRef(uid())
  const bodyRef = useRef(null)
  const inputRef = useRef(null)
  const seedKey = useRef(null)

  const projects = useMemo(
    () => (state.projects || []).filter((p) => !p.remoteOnly && p.exists !== false),
    [state.projects]
  )

  const projectId = controlledProjectId || activeProject?.id || null
  const project = projects.find((p) => p.id === projectId) || activeProject || null

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const activity = streaming ? activityFromContent(lastAssistant?.content || '', true) : null

  useEffect(() => {
    const offDelta = api.on('ai:delta', ({ chatId: id, delta }) => {
      if (id !== chatId.current) return
      setMessages((m) => {
        const next = [...m]
        const last = next[next.length - 1]
        if (!last || last.role !== 'assistant') return m
        next[next.length - 1] = { ...last, content: last.content + delta }
        return next
      })
    })
    const offDone = api.on('ai:done', ({ chatId: id }) => {
      if (id === chatId.current) setStreaming(false)
    })
    const offErr = api.on('ai:error', ({ chatId: id, error }) => {
      if (id !== chatId.current) return
      setStreaming(false)
      setMessages((m) => {
        const next = [...m]
        next[next.length - 1] = { role: 'assistant', content: error, error: true }
        return next
      })
    })
    return () => { offDelta(); offDone(); offErr() }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    bodyRef.current?.scrollTo({ top: 1e9, behavior })
  }, [messages, activity?.label])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  const sendText = useCallback(async (raw) => {
    const text = String(raw || '').trim()
    if (!text || streaming) return
    const history = [...messages.filter((m) => !m.error), { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    const context = project
      ? [
          `Projet actif : ${project.name}`,
          `Chemin : ${project.path}`,
          `Thèmes : ${themeLabels(project.themes).join(', ') || 'aucun'}`,
          `Libs : ${(project.libs || []).slice(0, 24).join(', ') || 'aucune'}`,
          project.frameworkId ? `Framework id : ${project.frameworkId}` : null
        ].filter(Boolean).join('\n')
      : 'Aucun projet sélectionné.'

    await api.ai.chat({
      chatId: chatId.current,
      messages: history,
      context,
      libs: project?.libs || [],
      projectId: project?.id || null
    })
  }, [messages, streaming, project])

  useEffect(() => {
    if (!seed?.key || seed.key === seedKey.current) return
    seedKey.current = seed.key
    if (seed.projectId) onProjectId?.(seed.projectId)
    if (seed.prompt && seed.autoSend) {
      setPendingPrompt(seed.prompt)
    } else if (seed.prompt) {
      setInput(seed.prompt)
    }
    onSeedConsumed?.()
  }, [seed, onProjectId, onSeedConsumed])

  useEffect(() => {
    if (!pendingPrompt || streaming) return
    const text = pendingPrompt
    setPendingPrompt(null)
    sendText(text)
  }, [pendingPrompt, streaming, sendText])

  const writeFile = async (path, content, turnKey) => {
    if (!project) return toast('Choisis un projet pour écrire des fichiers.', true)
    const full = `${project.path}/${path}`.replace(/\\/g, '/')
    const exists = await api.fs.exists(full)
    const write = async () => {
      await api.fs.write({ path: full, content })
      setApplied((a) => ({ ...a, [`${turnKey}:${path}`]: true }))
      toast(`Écrit · ${path}`)
    }
    if (exists) {
      setAsk({
        title: `Écraser ${path} ?`,
        subtitle: 'Le fichier existe déjà dans le projet. Son contenu actuel sera perdu.',
        confirm: 'Écraser',
        run: write
      })
      return
    }
    await write()
  }

  const addToCatalog = async (kind, json) => {
    try {
      const data = JSON.parse(json)
      const apply = async () => {
        if (kind === 'pdc-framework') {
          const id = data.id || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          await api.state.patch({
            frameworks: [...state.frameworks.filter((f) => f.id !== id), { ...data, id }]
          })
          toast(`Framework ${data.name} ajouté`)
        } else {
          const catId = (data.category || 'utils').toLowerCase().replace(/[^a-z0-9]+/g, '-')
          let libs = state.libraries
          if (!libs.some((c) => c.id === catId)) {
            libs = [...libs, { id: catId, name: data.category, description: '', items: [] }]
          }
          libs = libs.map((c) => (c.id === catId
            ? {
                ...c,
                items: [
                  ...c.items.filter((i) => i.pkg !== data.pkg),
                  {
                    id: data.pkg,
                    name: data.name,
                    pkg: data.pkg,
                    description: data.description,
                    dev: !!data.dev,
                    docs: data.docs || ''
                  }
                ]
              }
            : c))
          await api.state.patch({ libraries: libs })
          toast(`Librairie ${data.name} ajoutée`)
        }
        refresh()
      }
      const exists = kind === 'pdc-framework'
        ? state.frameworks.some((f) => f.id === (data.id || data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-')))
        : state.libraries.some((c) => c.items.some((i) => i.pkg === data.pkg))
      if (exists) {
        setAsk({
          title: `Remplacer ${data.name || data.pkg} ?`,
          subtitle: 'Une entrée du même nom existe déjà dans le catalogue.',
          confirm: 'Remplacer',
          run: apply
        })
        return
      }
      await apply()
    } catch (e) {
      toast(`JSON invalide : ${e.message}`, true)
    }
  }

  const prompts = project ? PROJECT_PROMPTS(project.name) : [
    { id: 'fw', label: 'Nouveau framework', prompt: 'Propose un framework à ajouter au catalogue PDC.' },
    { id: 'lib', label: 'Librairie PWA', prompt: 'Quelles librairies pour une PWA hors ligne ?' },
    { id: 'bp', label: 'Blueprint landing', prompt: 'Propose un blueprint de landing page.' }
  ]

  return (
    <div className="agent-layer" role="presentation">
      <button type="button" className="agent-backdrop" aria-label="Fermer l’assistant" onClick={onClose} />
      <aside className="agent" role="dialog" aria-modal="true" aria-label="Agent IA">
        <header className="agent-head">
          <div className="agent-brand">
            <span className={`agent-mark${streaming ? ' live' : ''}`}>
              <Sparkles size={15} strokeWidth={1.8} />
            </span>
            <div className="agent-titles">
              <strong>Agent</strong>
              <span>
                {state.ai.model || 'modèle non choisi'}
                {state.ai.provider ? ` · ${state.ai.provider}` : ''}
              </span>
            </div>
          </div>
          <div className="agent-head-actions">
            <button
              type="button"
              className="btn icon sm ghost"
              aria-label="Vider la conversation"
              disabled={!messages.length || streaming}
              onClick={() => {
                if (!messages.length) return
                setAsk({
                  title: 'Vider la conversation ?',
                  subtitle: 'Les messages de cette session disparaissent. Rien n’est écrit sur le disque.',
                  confirm: 'Vider',
                  run: () => { setMessages([]); setApplied({}) }
                })
              }}
            >
              <Eraser size={15} />
            </button>
            <button type="button" className="btn icon sm ghost" aria-label="Fermer" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="agent-context">
          <button
            type="button"
            className={`agent-project${pickerOpen ? ' open' : ''}${project ? ' set' : ''}`}
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
          >
            <FolderGit2 size={14} strokeWidth={1.8} />
            <span className="agent-project-label">
              {project ? project.name : 'Sans projet'}
            </span>
            <ChevronDown size={14} className="agent-chevron" />
          </button>
          {pickerOpen && (
            <div className="agent-project-menu" role="listbox">
              <button
                type="button"
                className={!projectId ? 'on' : ''}
                onClick={() => { onProjectId?.(null); setPickerOpen(false) }}
              >
                Sans projet
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={projectId === p.id ? 'on' : ''}
                  onClick={() => { onProjectId?.(p.id); setPickerOpen(false) }}
                >
                  {p.name}
                </button>
              ))}
              {!projects.length && (
                <p className="agent-project-empty">Aucun projet local. Crée ou clone un dépôt d’abord.</p>
              )}
            </div>
          )}
        </div>

        {activity && (
          <div className={`agent-status agent-status-${activity.kind}`} role="status" aria-live="polite">
            <Loader2 size={13} className="spin" />
            <span>{activity.label}</span>
          </div>
        )}

        <div className="agent-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div className="agent-empty">
              <div className="agent-empty-hero">
                <Wand2 size={22} strokeWidth={1.6} />
                <h3>{project ? `Travailler sur ${project.name}` : 'Agent atelier'}</h3>
                <p>
                  {project
                    ? 'Demande du code, des correctifs ou une explication. Les fichiers proposés s’appliquent au projet choisi.'
                    : 'Choisis un projet pour écrire des fichiers, ou pose une question sur le catalogue.'}
                </p>
              </div>
              <div className="agent-quick">
                {prompts.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="agent-quick-item"
                    onClick={() => sendText(s.prompt)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const turnKey = `t${i}`
            if (m.role === 'user') {
              return (
                <div className="agent-turn user" key={turnKey}>
                  <div className="agent-user-bubble">{m.content}</div>
                </div>
              )
            }
            const parts = m.content === '' && streaming && i === messages.length - 1
              ? null
              : parse(m.content || '')
            return (
              <div className={`agent-turn assistant${m.error ? ' err' : ''}`} key={turnKey}>
                <div className="agent-role">
                  <Sparkles size={12} />
                  <span>Agent</span>
                </div>
                {m.error ? (
                  <p className="agent-error">{m.content}</p>
                ) : !parts ? (
                  <div className="agent-thinking">
                    <span className="typing"><i /><i /><i /></span>
                    <span>Prépare la réponse…</span>
                  </div>
                ) : (
                  <div className="agent-blocks">
                    {parts.map((part, j) => {
                      if (part.type === 'text') {
                        const text = part.value.trim()
                        if (!text) return null
                        return <p key={j} className="agent-prose">{text}</p>
                      }
                      const done = applied[`${turnKey}:${part.path}`]
                      return (
                        <div
                          key={j}
                          className={`agent-file${part.complete ? '' : ' drafting'}${done ? ' applied' : ''}`}
                        >
                          <div className="agent-file-head">
                            <FileCode2 size={14} strokeWidth={1.7} />
                            <span className="agent-file-path">{part.path || part.lang}</span>
                            {!part.complete && <em>en cours</em>}
                            {done && <em className="ok"><Check size={12} /> appliqué</em>}
                            <div className="spacer" />
                            {part.complete && part.path && project && (
                              <button
                                type="button"
                                className="btn sm primary"
                                disabled={done}
                                onClick={() => writeFile(part.path, part.value, turnKey)}
                              >
                                <FileDown size={13} /> {done ? 'Écrit' : 'Appliquer'}
                              </button>
                            )}
                            {part.complete && (part.lang === 'pdc-framework' || part.lang === 'pdc-library') && (
                              <button
                                type="button"
                                className="btn sm ghost"
                                onClick={() => addToCatalog(part.lang, part.value)}
                              >
                                <PlusCircle size={13} /> Catalogue
                              </button>
                            )}
                            {part.complete && (
                              <button
                                type="button"
                                className="btn sm ghost"
                                onClick={() => navigator.clipboard.writeText(part.value)}
                              >
                                Copier
                              </button>
                            )}
                          </div>
                          <pre><code>{part.value}</code></pre>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <footer className="agent-foot">
          {project && messages.length > 0 && (
            <div className="agent-chip-row">
              {PROJECT_PROMPTS(project.name).slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="chip link"
                  disabled={streaming}
                  onClick={() => sendText(s.prompt)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <div className="agent-composer">
            <textarea
              ref={inputRef}
              className="textarea"
              rows={2}
              placeholder={project ? `Demander pour ${project.name}…` : 'Poser une question…'}
              value={input}
              disabled={streaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendText(input)
                }
              }}
            />
            {streaming ? (
              <button
                type="button"
                className="btn icon"
                aria-label="Arrêter"
                onClick={() => api.ai.stop(chatId.current)}
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn icon primary"
                aria-label="Envoyer"
                disabled={!input.trim()}
                onClick={() => sendText(input)}
              >
                <Send size={16} />
              </button>
            )}
          </div>
          <p className="agent-hint">
            <span className="kbd">↵</span> envoyer
            {' · '}
            <span className="kbd">⇧↵</span> ligne
            {' · '}
            <span className="kbd">esc</span> fermer
            {' · '}clic dehors pour fermer
          </p>
        </footer>

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
      </aside>
    </div>
  )
}
