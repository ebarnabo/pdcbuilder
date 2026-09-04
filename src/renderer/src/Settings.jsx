import { useState, useEffect } from 'react'
import { RefreshCw, Check, FolderOpen, Download, BookOpen, FileText } from 'lucide-react'
import { Field, ScoreNotes } from './ui.jsx'
import { GitFields, GitStatus } from './GitFields.jsx'
import { DatabasePicker } from './DatabaseFields.jsx'
import { DatabaseAccounts } from './DatabaseCloud.jsx'
import { PackageManagerPicker } from './PackageManagerPicker.jsx'
import { ToolchainPanel } from './ToolchainPanel.jsx'
import { UI_THEMES, applyUiTheme, BrandMark } from './Brand.jsx'
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
  const [databasePref, setDatabasePref] = useState(state.database || { defaultId: 'none' })
  const [packageManager, setPackageManager] = useState(state.packageManager || 'npm')
  const [uiTheme, setUiTheme] = useState(state.uiTheme || 'cap')

  useEffect(() => { api.ai.providers().then(setProviders) }, [])
  useEffect(() => { api.git.status().then(setGitStatus) }, [])
  useEffect(() => { setUiTheme(state.uiTheme || 'cap') }, [state.uiTheme])

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
          <p>Atelier, SDK (Python…), dépôts, comptes des bases (CLI / MCP) et moteur d’IA.</p>
        </div>
      </div>

      <div className="card">
        <h4 className="card-title">Apparence</h4>
        <p className="card-desc">
          Le thème Cap reprend le logo (navy → cyan). Atelier garde l’ambiance ambrée d’origine.
        </p>
        <div className="ui-theme-grid" role="radiogroup" aria-label="Thème de l’interface">
          {UI_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={uiTheme === t.id}
              className={`ui-theme-pick${uiTheme === t.id ? ' on' : ''} theme-preview-${t.id}`}
              onClick={() => {
                setUiTheme(t.id)
                applyUiTheme(t.id)
                save({ uiTheme: t.id })
                toast(`Thème ${t.label}`)
              }}
            >
              <div className="ui-theme-swatches" aria-hidden>
                {t.swatches.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </div>
              <div className="ui-theme-meta">
                {t.id === 'cap' ? <BrandMark size="sm" /> : <span className="ui-theme-dot" />}
                <div>
                  <strong>{t.label}</strong>
                  <span>{t.hint}</span>
                </div>
              </div>
            </button>
          ))}
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
        <PackageManagerPicker
          value={packageManager}
          onChange={(id) => { setPackageManager(id); save({ packageManager: id }) }}
          toast={toast}
        />
        <div style={{ marginTop: 20 }}>
          <ToolchainPanel toast={toast} />
        </div>
      </div>

      <div className="card">
        <h4 className="card-title">Préférences pour les agents IA</h4>
        <p className="card-desc">
          Tous les réglages (atelier, Git, bases, catalogue, projets) sont exportés en
          <code> preferences.md</code> et copiés dans chaque projet sous
          <code> .pdc/preferences.md</code>. L’assistant intégré et les agents externes (Cursor, etc.) peuvent s’y référer.
          Les secrets (clés API, tokens) ne sont jamais écrits en clair.
        </p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn none" onClick={() => api.preferences.open()}>
            <FileText size={16} /> Ouvrir le dossier
          </button>
        </div>
      </div>

      <div className="card">
        <h4 className="card-title">Application</h4>
        <p className="card-desc">
          Les mises à jour se téléchargent automatiquement en arrière-plan. Quand c’est prêt, un clic redémarre sur la nouvelle version — pas besoin de re-télécharger l’installeur.
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
        {update?.status === 'downloading' && (
          <div className="update-bar-track" style={{ marginTop: 8 }} aria-hidden>
            <i className="update-bar-fill" style={{ width: `${Math.max(4, Math.round(update.percent || 0))}%` }} />
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn none" onClick={async () => {
            const r = await api.app.checkUpdate()
            if (r?.status === 'dev') toast('Les mises à jour marchent sur l’app installée, pas en dev.')
            else if (r?.status === 'error') toast(r.error || 'Vérification impossible', true)
            else toast('Recherche de mise à jour…')
          }}>
            <RefreshCw size={16} className={update?.status === 'checking' || update?.status === 'downloading' ? 'spin' : ''} /> Vérifier
          </button>
          {update?.status === 'ready' && (
            <button className="btn primary" onClick={() => api.app.installUpdate()}>
              <Download size={16} /> Installer et redémarrer
            </button>
          )}
          {state.onboarding?.completed && (
            <button className="btn none" onClick={() => save({ onboarding: { ...state.onboarding, completed: false } })}>
              Relancer l’introduction
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h4 className="card-title">Documentation des librairies</h4>
        <p className="card-desc">
          Au démarrage, l’app récupère en silence les liens officiels (npm, README, llms.txt, pages docs)
          et les extrait en fichiers Markdown. L’assistant s’en sert ; chaque projet reçoit une copie dans
          <code> .pdc/docs</code>, avec les préférences dans <code>.pdc/preferences.md</code>.
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
          Un dépôt GitHub ou Cursor Origin peut être créé avec le projet, ou cloné depuis Projets → Récupérer.
          Le push et le pull se font ensuite dans le menu de la carte. Ces options sont mémorisées pour les créations.
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
        <h4 className="card-title">Base de données</h4>
        <p className="card-desc">Choix par défaut, puis les comptes CLI / MCP pour créer et gérer les bases depuis l’app.</p>
        <DatabasePicker
          value={databasePref.defaultId || 'none'}
          onChange={(id) => {
            const next = { ...databasePref, defaultId: id }
            setDatabasePref(next)
            save({ database: next })
          }}
        />
        <div style={{ marginTop: 20 }}>
          <h4 className="card-title">Comptes, CLI et MCP</h4>
          <DatabaseAccounts
            value={databasePref}
            onChange={(next) => {
              setDatabasePref(next)
              save({ database: next })
            }}
            toast={toast}
          />
        </div>
      </div>

      <div className="card">
        <h4 className="card-title">Intelligence artificielle</h4>
        <p className="card-desc">Local = hors ligne. API = une clé, stockée ici seulement.</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(providers).map(([id, p]) => (
            <button key={id} className={`btn sm${ai.provider === id ? ' primary' : ''}`} onClick={() => pickProvider(id)}>
              {ai.provider === id && <Check size={13} />} {p.label}
            </button>
          ))}
        </div>
        <ScoreNotes scores={providers[ai.provider]?.scores} />

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
