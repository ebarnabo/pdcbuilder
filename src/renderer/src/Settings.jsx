import { useState, useEffect } from 'react'
import { RefreshCw, Check, FolderOpen, Download, BookOpen } from 'lucide-react'
import { Field } from './ui.jsx'
import { GitFields, GitStatus } from './GitFields.jsx'
import { api } from './bridge.js'

export default function Settings({ state, refresh, toast, update, docsStatus }) {
  const [providers, setProviders] = useState({})
  const [models, setModels] = useState([])
  const [testing, setTesting] = useState(false)
  const [ai, setAi] = useState(state.ai)
  const [workspace, setWorkspace] = useState(state.workspace)
  const [editor, setEditor] = useState(state.editor)
  const [git, setGit] = useState(state.git || {})
  const [gitStatus, setGitStatus] = useState(null)

  useEffect(() => { api.ai.providers().then(setProviders) }, [])
  useEffect(() => { api.git.status().then(setGitStatus) }, [])

  const save = async (fields) => { await api.state.patch(fields); refresh() }
  const saveGit = (next) => {
    const merged = {
      autoCreate: true,
      provider: 'github',
      visibility: 'private',
      org: '',
      branch: 'main',
      ...next
    }
    setGit(merged)
    save({ git: merged })
  }

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
          <p>Dossier de travail, dépôts Git et moteur d’IA.</p>
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
        <h4 className="card-title">Application</h4>
        <p className="card-desc">
          Un push sur la branche main du dépôt GitHub publie un installeur.
          L’app le télécharge toute seule ; un clic redémarre sur la nouvelle version.
        </p>
        <div className="row" style={{ alignItems: 'center' }}>
          <Field label="Version installée">
            <input className="input mono" readOnly value={update?.current || '…'} />
          </Field>
          <Field label="Statut">
            <input className="input" readOnly value={
              update?.status === 'ready' ? `Prête · ${update.version}`
                : update?.status === 'downloading' ? `Téléchargement ${Math.round(update.percent || 0)} %`
                  : update?.status === 'checking' ? 'Recherche…'
                    : update?.status === 'none' ? 'À jour'
                      : update?.status === 'dev' ? 'Mode développement — packager pour activer'
                        : update?.status === 'error' ? (update.error || 'Erreur')
                          : 'En attente'
            } />
          </Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn none" onClick={async () => {
            const r = await api.app.checkUpdate()
            if (r?.status === 'dev') toast('Les mises à jour marchent sur l’app installée, pas en dev.')
            else if (r?.status === 'error') toast(r.error || 'Vérification impossible', true)
            else toast('Recherche de mise à jour…')
          }}>
            <RefreshCw size={16} /> Vérifier
          </button>
          {update?.status === 'ready' && (
            <button className="btn primary" onClick={() => api.app.installUpdate()}>
              <Download size={16} /> Mettre à jour
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h4 className="card-title">Documentation des librairies</h4>
        <p className="card-desc">
          Au démarrage, l’app récupère en silence les liens officiels (npm, README, llms.txt, pages docs)
          et les extrait en fichiers Markdown. L’assistant s’en sert ; chaque projet reçoit une copie dans
          <code> .pdc/docs</code>.
        </p>
        <div className="row" style={{ alignItems: 'center' }}>
          <Field label="Statut">
            <input className="input" readOnly value={
              docsStatus?.status === 'running'
                ? `Mise à jour silencieuse… ${docsStatus.done}/${docsStatus.total}${docsStatus.current ? ` · ${docsStatus.current}` : ''}`
                : docsStatus?.lastRun
                  ? `À jour · ${docsStatus.updated || 0} extraits, ${docsStatus.failed || 0} échecs`
                  : docsStatus?.total
                    ? `${docsStatus.done || 0}/${docsStatus.total}`
                    : 'En attente de la première passe'
            } />
          </Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn none" onClick={async () => {
            toast('Mise à jour des docs en arrière-plan…')
            api.docs.refresh()
          }}>
            <RefreshCw size={16} /> Rafraîchir
          </button>
          <button className="btn none" onClick={() => api.docs.open()}>
            <BookOpen size={16} /> Ouvrir le dossier
          </button>
        </div>
      </div>

      <div className="card">
        <h4 className="card-title">Dépôts Git</h4>
        <p className="card-desc">
          Un dépôt GitHub (ou Cursor Origin) peut être créé en même temps que le projet.
          Ces options sont mémorisées et préremplies à chaque création.
        </p>
        <GitFields
          value={git}
          status={gitStatus}
          showAuto
          onChange={(next) => saveGit(next)}
        />
        <GitStatus status={gitStatus} onRefresh={() => api.git.status().then(setGitStatus)} />
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
