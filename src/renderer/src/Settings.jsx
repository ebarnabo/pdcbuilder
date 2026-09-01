import { useState, useEffect } from 'react'
import { RefreshCw, Check, FolderOpen } from 'lucide-react'
import { Field } from './ui.jsx'

const api = window.pdc

export default function Settings({ state, refresh, toast }) {
  const [providers, setProviders] = useState({})
  const [models, setModels] = useState([])
  const [testing, setTesting] = useState(false)
  const [ai, setAi] = useState(state.ai)
  const [workspace, setWorkspace] = useState(state.workspace)
  const [editor, setEditor] = useState(state.editor)

  useEffect(() => { api.ai.providers().then(setProviders) }, [])

  const save = async (fields) => { await api.state.patch(fields); refresh() }

  const pickProvider = (id) => {
    const next = { ...ai, provider: id, baseUrl: providers[id]?.baseUrl || ai.baseUrl }
    setAi(next); save({ ai: next })
    setModels([])
  }

  const loadModels = async () => {
    setTesting(true)
    const r = await api.ai.models(ai)
    setTesting(false)
    if (r?.error) return toast(r.error, true)
    setModels(r)
    toast(`${r.length} modèles détectés`)
  }

  const needsKey = providers[ai.provider]?.needsKey

  return (
    <>
      <div className="section-head">
        <div style={{ flex: 1 }}>
          <h3>Réglages</h3>
          <p>Dossier de travail, éditeur et moteur d’IA.</p>
        </div>
      </div>

      <div className="card">
        <h4 className="card-title">Atelier</h4>
        <Field label="Dossier des projets">
          <div className="row">
            <input className="input mono" value={workspace} onChange={(e) => setWorkspace(e.target.value)} onBlur={() => save({ workspace })} />
            <button className="btn none" onClick={async () => { const d = await api.fs.pickDir(); if (d) { setWorkspace(d); save({ workspace: d }) } }}>Choisir</button>
            <button className="btn icon none" aria-label="Ouvrir le dossier" onClick={() => api.fs.openPath(workspace)}><FolderOpen size={16} /></button>
          </div>
        </Field>
        <Field label="Commande de l’éditeur" hint="« code » pour VS Code, « cursor » pour Cursor, « subl » pour Sublime.">
          <input className="input mono" value={editor} onChange={(e) => setEditor(e.target.value)} onBlur={() => save({ editor })} />
        </Field>
      </div>

      <div className="card">
        <h4 className="card-title">Intelligence artificielle</h4>
        <p className="card-desc">
          Un modèle local reste sur ta machine et fonctionne hors ligne. Une API distante demande une clé,
          stockée uniquement dans le fichier de configuration de l’application.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(providers).map(([id, p]) => (
            <button key={id} className={`btn sm${ai.provider === id ? ' primary' : ''}`} onClick={() => pickProvider(id)}>
              {ai.provider === id && <Check size={13} />} {p.label}
            </button>
          ))}
        </div>

        <div className="row">
          <Field label="Adresse du service">
            <input className="input mono" value={ai.baseUrl}
              onChange={(e) => setAi({ ...ai, baseUrl: e.target.value })}
              onBlur={() => save({ ai })} />
          </Field>
          <Field label={needsKey ? 'Clé API' : 'Clé API (facultative)'}>
            <input className="input mono" type="password" value={ai.apiKey} placeholder={needsKey ? 'sk-…' : 'non requise en local'}
              onChange={(e) => setAi({ ...ai, apiKey: e.target.value })}
              onBlur={() => save({ ai })} />
          </Field>
        </div>

        <div className="row">
          <Field label="Modèle">
            {models.length ? (
              <select className="select" value={ai.model} onChange={(e) => { const next = { ...ai, model: e.target.value }; setAi(next); save({ ai: next }) }}>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input className="input mono" value={ai.model}
                onChange={(e) => setAi({ ...ai, model: e.target.value })}
                onBlur={() => save({ ai })} />
            )}
          </Field>
          <Field label="Température" hint="Bas = code stable, haut = plus créatif.">
            <input className="input" type="number" step="0.1" min="0" max="1" value={ai.temperature}
              onChange={(e) => { const next = { ...ai, temperature: Number(e.target.value) }; setAi(next); save({ ai: next }) }} />
          </Field>
          <button className="btn none" onClick={loadModels} disabled={testing}>
            <RefreshCw size={16} className={testing ? 'spin' : ''} /> {testing ? 'Test…' : 'Détecter les modèles'}
          </button>
        </div>
      </div>
    </>
  )
}
