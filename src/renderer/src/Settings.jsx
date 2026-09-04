import { useState, useEffect, useRef } from 'react'
import {
  RefreshCw, Check, FolderOpen, Download, BookOpen, FileText,
  Palette, Wrench, Boxes, Sparkles, Database, Github, Cpu, FileCode2
} from 'lucide-react'
import { Field, ScoreNotes } from './ui.jsx'
import { GitFields, GitStatus } from './GitFields.jsx'
import { DatabasePicker } from './DatabaseFields.jsx'
import { DatabaseAccounts } from './DatabaseCloud.jsx'
import { PackageManagerPicker } from './PackageManagerPicker.jsx'
import { ToolchainPanel } from './ToolchainPanel.jsx'
import { UI_THEMES, applyUiTheme, BrandMark } from './Brand.jsx'
import { api } from './bridge.js'

const SECTIONS = [
  { id: 'apparence', label: 'Apparence', icon: Palette },
  { id: 'atelier', label: 'Atelier', icon: Wrench },
  { id: 'sdk', label: 'SDK & outils', icon: Cpu },
  { id: 'git', label: 'Dépôts Git', icon: Github },
  { id: 'database', label: 'Bases', icon: Database },
  { id: 'ai', label: 'IA', icon: Sparkles },
  { id: 'docs', label: 'Docs', icon: BookOpen },
  { id: 'prefs', label: 'Agents', icon: FileCode2 },
  { id: 'app', label: 'Application', icon: Boxes }
]

function SettingsNav({ active, onJump }) {
  return (
    <nav className="settings-nav" aria-label="Sections des réglages">
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`settings-nav-item${active === id ? ' on' : ''}`}
          onClick={() => onJump(id)}
        >
          <Icon size={14} strokeWidth={1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

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
  const [activeSection, setActiveSection] = useState('apparence')
  const rootRef = useRef(null)

  useEffect(() => { api.ai.providers().then(setProviders) }, [])
  useEffect(() => { api.git.status().then(setGitStatus) }, [])
  useEffect(() => { setUiTheme(state.uiTheme || 'cap') }, [state.uiTheme])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const nodes = [...root.querySelectorAll('[data-settings-section]')]
    if (!nodes.length) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target?.dataset?.settingsSection) {
          setActiveSection(visible[0].target.dataset.settingsSection)
        }
      },
      { root: root.closest('.content') || null, rootMargin: '-12% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] }
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  const jump = (id) => {
    const el = rootRef.current?.querySelector(`[data-settings-section="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
  }

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
    <div className="settings-layout" ref={rootRef}>
      <div className="section-head settings-head">
        <div style={{ flex: 1 }}>
          <h3>Réglages</h3>
          <p>Sections rangées — utilise les raccourcis pour aller directement au bon bloc.</p>
        </div>
      </div>

      <SettingsNav active={activeSection} onJump={jump} />

      <section className="card settings-section" data-settings-section="apparence" id="settings-apparence">
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
      </section>

      <section className="card settings-section" data-settings-section="atelier" id="settings-atelier">
        <h4 className="card-title">Atelier</h4>
        <p className="card-desc">Dossier des projets, éditeur et gestionnaire de paquets JS par défaut.</p>
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
      </section>

      <section className="card settings-section" data-settings-section="sdk" id="settings-sdk">
        <h4 className="card-title">SDK & outils</h4>
        <p className="card-desc">
          Python multi-versions, runtimes et CLIs utiles au code. Installer, mettre à jour ou supprimer depuis ici.
        </p>
        <ToolchainPanel toast={toast} />
      </section>

      <section className="card settings-section" data-settings-section="git" id="settings-git">
        <h4 className="card-title">Dépôts Git</h4>
        <p className="card-desc">
          Un dépôt GitHub ou Cursor Origin peut être créé avec le projet, ou cloné depuis Projets → Récupérer.
          Le push et le pull se font ensuite dans le menu de la carte.
        </p>
        <GitFields value={git} status={gitStatus} showAuto onChange={(next) => saveGit(next)} />
        <GitStatus status={gitStatus} onRefresh={() => api.git.status().then(setGitStatus)} />
      </section>

      <section className="card settings-section" data-settings-section="database" id="settings-database">
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
      </section>

      <section className="card settings-section" data-settings-section="ai" id="settings-ai">
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
      </section>

      <section className="card settings-section" data-settings-section="docs" id="settings-docs">
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
          <button className="btn none" onClick={() => { toast('Mise à jour des docs en arrière-plan…'); api.docs.refresh() }}>
            <RefreshCw size={16} /> Rafraîchir
          </button>
          <button className="btn none" onClick={() => api.docs.open()}>
            <BookOpen size={16} /> Ouvrir le dossier
          </button>
        </div>
      </section>

      <section className="card settings-section" data-settings-section="prefs" id="settings-prefs">
        <h4 className="card-title">Préférences pour les agents IA</h4>
        <p className="card-desc">
          Tous les réglages sont exportés en <code> preferences.md</code> et copiés dans chaque projet sous
          <code> .pdc/preferences.md</code>. Les secrets ne sont jamais écrits en clair.
        </p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn none" onClick={() => api.preferences.open()}>
            <FileText size={16} /> Ouvrir le dossier
          </button>
        </div>
      </section>

      <section className="card settings-section" data-settings-section="app" id="settings-app">
        <h4 className="card-title">Application</h4>
        <p className="card-desc">
          Les mises à jour se téléchargent automatiquement. Quand c’est prêt, un clic redémarre sur la nouvelle version.
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
      </section>
    </div>
  )
}
