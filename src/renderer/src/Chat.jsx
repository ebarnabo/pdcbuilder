import { useState, useEffect, useRef } from 'react'
import { X, Send, Square, Sparkles, FileDown, PlusCircle, Eraser } from 'lucide-react'
import { api } from './bridge.js'
const uid = () => Math.random().toString(36).slice(2, 10)

/** Découpe la réponse en blocs texte / code, en lisant l'info-string ```lang path=… */
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
    parts.push({ type: 'code', lang, path, value: m[2] })
    last = re.lastIndex
  }
  if (last < md.length) parts.push({ type: 'text', value: md.slice(last) })
  return parts
}

export default function Chat({ state, refresh, toast, onClose, project }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const chatId = useRef(uid())
  const bodyRef = useRef(null)

  useEffect(() => {
    const offDelta = api.on('ai:delta', ({ chatId: id, delta }) => {
      if (id !== chatId.current) return
      setMessages((m) => {
        const next = [...m]
        next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + delta }
        return next
      })
    })
    const offDone = api.on('ai:done', ({ chatId: id }) => { if (id === chatId.current) setStreaming(false) })
    const offErr = api.on('ai:error', ({ chatId: id, error }) => {
      if (id !== chatId.current) return
      setStreaming(false)
      setMessages((m) => {
        const next = [...m]
        next[next.length - 1] = { role: 'assistant', content: `⚠︎ ${error}`, error: true }
        return next
      })
    })
    return () => { offDelta(); offDone(); offErr() }
  }, [])

  useEffect(() => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    bodyRef.current?.scrollTo({ top: 1e9, behavior })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    const history = [...messages.filter((m) => !m.error), { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    const context = [
      `Frameworks du catalogue : ${state.frameworks.map((f) => f.id).join(', ')}`,
      `Catégories de librairies : ${state.libraries.map((c) => c.name).join(', ')}`,
      'La documentation officielle des librairies est extraite en local (fichiers .md) et fournie à l’assistant.',
      project
        ? `Projet actif : ${project.name} (${state.frameworks.find((f) => f.id === project.frameworkId)?.name}) — ${project.path}\nLibrairies : ${project.libs?.join(', ') || 'aucune'}\nBase de données : ${project.databaseId && project.databaseId !== 'none' ? project.databaseId : 'aucune'}`
        : 'Aucun projet sélectionné.'
    ].join('\n')

    await api.ai.chat({ chatId: chatId.current, messages: history, context, libs: project?.libs || [] })
  }

  const writeFile = async (path, content) => {
    if (!project) return toast('Sélectionne un projet dans la liste d’abord.', true)
    const full = `${project.path}/${path}`.replace(/\\/g, '/')
    await api.fs.write({ path: full, content })
    toast(`Écrit : ${path}`)
  }

  const addToCatalog = async (kind, json) => {
    try {
      const data = JSON.parse(json)
      if (kind === 'pdc-framework') {
        const id = data.id || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        await api.state.patch({
          frameworks: [...state.frameworks.filter((f) => f.id !== id), { ...data, id }]
        })
        toast(`Framework ${data.name} ajouté`)
      } else {
        const catId = (data.category || 'utils').toLowerCase().replace(/[^a-z0-9]+/g, '-')
        let libs = state.libraries
        if (!libs.some((c) => c.id === catId)) libs = [...libs, { id: catId, name: data.category, description: '', items: [] }]
        libs = libs.map((c) => c.id === catId
          ? { ...c, items: [...c.items.filter((i) => i.pkg !== data.pkg), { id: data.pkg, name: data.name, pkg: data.pkg, description: data.description, dev: !!data.dev, docs: data.docs || '' }] }
          : c)
        await api.state.patch({ libraries: libs })
        toast(`Librairie ${data.name} ajoutée`)
      }
      refresh()
    } catch (e) {
      toast(`JSON invalide : ${e.message}`, true)
    }
  }

  const suggestions = project
    ? [`Ajoute un thème dark chaud à ${project.name}`, 'Écris un composant de navigation animé', 'Configure Tailwind avec mes tokens']
    : ['Ajoute Remix au catalogue', 'Quelles librairies pour une PWA hors ligne ?', 'Propose un blueprint de landing page']

  return (
    <aside className="chat">
      <div className="chat-head">
        <Sparkles size={18} color="var(--accent)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 14 }}>Assistant</strong>
          <div style={{ fontSize: 12, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {state.ai.model} · {state.ai.provider}{project ? ` · ${project.name}` : ''}
          </div>
        </div>
        <button className="btn icon sm ghost" aria-label="Vider la conversation" onClick={() => setMessages([])}><Eraser size={16} /></button>
        <button className="btn icon sm ghost" aria-label="Fermer" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0 }}>
              Branché sur ton modèle. Demande du code, des librairies, ou de nouvelles entrées de catalogue —
              les blocs proposés s’écrivent directement dans le projet actif.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map((s) => (
                <button key={s} className="chip" style={{ height: 32, cursor: 'pointer' }} onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div className={`msg ${m.role}`} key={i}>
            {m.role === 'user'
              ? <p style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>
              : m.content === ''
                ? <span className="typing"><i /><i /><i /></span>
                : parse(m.content).map((part, j) =>
                    part.type === 'text'
                      ? <p key={j} style={{ whiteSpace: 'pre-wrap' }}>{part.value.trim()}</p>
                      : (
                        <div className="code-block" key={j}>
                          <div className="code-head">
                            <span className="path">{part.path || part.lang}</span>
                            {part.path && (
                              <button className="btn sm ghost" onClick={() => writeFile(part.path, part.value)}>
                                <FileDown size={13} /> Écrire
                              </button>
                            )}
                            {(part.lang === 'pdc-framework' || part.lang === 'pdc-library') && (
                              <button className="btn sm ghost" onClick={() => addToCatalog(part.lang, part.value)}>
                                <PlusCircle size={13} /> Ajouter au catalogue
                              </button>
                            )}
                            <button className="btn sm ghost" onClick={() => navigator.clipboard.writeText(part.value)}>Copier</button>
                          </div>
                          <pre><code>{part.value}</code></pre>
                        </div>
                      )
                  )}
          </div>
        ))}
      </div>

      <div className="chat-foot">
        <div className="chat-input">
          <textarea
            className="textarea"
            placeholder={project ? `Demander pour ${project.name}…` : 'Poser une question…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          {streaming
            ? <button className="btn icon" aria-label="Arrêter" onClick={() => api.ai.stop(chatId.current)}><Square size={16} /></button>
            : <button className="btn icon primary" aria-label="Envoyer" disabled={!input.trim()} onClick={send}><Send size={16} /></button>}
        </div>
        <span className="hint" style={{ color: 'var(--faint)', fontSize: 12 }}>
          <span className="kbd">↵</span> envoyer · <span className="kbd">⇧↵</span> nouvelle ligne
        </span>
      </div>
    </aside>
  )
}
