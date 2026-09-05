import { useState, useEffect, useRef } from 'react'
import {
  RefreshCw, Check, FolderOpen, Download, BookOpen, FileText,
  Palette, Wrench, Boxes, Sparkles, Database, Github, Cpu, FileCode2, Presentation
} from 'lucide-react'
import { Field, ScoreNotes } from './ui.jsx'
import { GitFields, GitStatus } from './GitFields.jsx'
import { DatabasePicker } from './DatabaseFields.jsx'
import { DatabaseAccounts } from './DatabaseCloud.jsx'
import { PackageManagerPicker } from './PackageManagerPicker.jsx'
import { ToolchainPanel } from './ToolchainPanel.jsx'
import { UI_THEMES, applyUiTheme, BrandMark } from './Brand.jsx'
import { api } from './bridge.js'

export const SETTINGS_SECTIONS = [
  { id: 'apparence', label: 'Apparence', icon: Palette },
  { id: 'atelier', label: 'Atelier', icon: Wrench },
  { id: 'sdk', label: 'SDK & outils', icon: Cpu },
  { id: 'git', label: 'Dépôts Git', icon: Github },
  { id: 'showroom', label: 'Showroom', icon: Presentation },
  { id: 'database', label: 'Bases', icon: Database },
  { id: 'ai', label: 'IA', icon: Sparkles },
  { id: 'docs', label: 'Docs', icon: BookOpen },
  { id: 'prefs', label: 'Agents', icon: FileCode2 },
  { id: 'app', label: 'Application', icon: Boxes }
]

const PROJECT_CARD_TOGGLES = [
  { id: 'agent', label: 'Agent IA' },
  { id: 'build', label: 'Build' },
  { id: 'pull', label: 'Pull' },
  { id: 'push', label: 'Push / Push GitHub' },
  { id: 'out', label: 'Sortie (dossier build)' },
  { id: 'preview', label: 'Aperçu build' },
  { id: 'showroom', label: 'Showroom' }
]

export default function Settings({
  state,
  refresh,
  toast,
  update,
  docsStatus,
  activeSection = 'apparence',
  onSectionChange,
  jumpTo
}) {
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
  const [projectCard, setProjectCard] = useState(() => ({
    agent: true,
    build: true,
    pull: true,
    push: true,
    out: true,
    preview: true,
    showroom: true,
    ...(state.projectCard || {})
  }))
  const [showroom, setShowroom] = useState(() => ({
    siteUrl: '',
    repoPath: '',
    apiKey: '',
    projectId: '',
    authDomain: '',
    ...(state.showroom || {})
  }))
  const [showroomStatus, setShowroomStatus] = useState(null)
  const [showroomBusy, setShowroomBusy] = useState(false)
  const rootRef = useRef(null)
  const jumping = useRef(false)

  useEffect(() => { api.ai.providers().then(setProviders) }, [])
  useEffect(() => { api.git.status().then(setGitStatus) }, [])
  useEffect(() => { setUiTheme(state.uiTheme || 'cap') }, [state.uiTheme])
  useEffect(() => {
    setProjectCard({
      agent: true,
      build: true,
      pull: true,
      push: true,
      out: true,
      preview: true,
      showroom: true,
      ...(state.projectCard || {})
    })
  }, [state.projectCard])

  useEffect(() => {
    setShowroom({
      siteUrl: '',
      repoPath: '',
      apiKey: '',
      projectId: '',
      authDomain: '',
      ...(state.showroom || {})
    })
  }, [state.showroom])

  useEffect(() => {
    api.showroom.status().then(setShowroomStatus).catch(() => {})
  }, [state.showroom?.refreshToken, state.showroom?.siteUrl, state.showroom?.projectId])

  const saveShowroom = (next) => {
    const merged = {
      siteUrl: '',
      repoPath: '',
      apiKey: '',
      projectId: '',
      authDomain: '',
      refreshToken: state.showroom?.refreshToken || '',
      uid: state.showroom?.uid || '',
      email: state.showroom?.email || '',
      ...next
    }
    setShowroom(merged)
    save({ showroom: merged })
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const nodes = [...root.querySelectorAll('[data-settings-section]')]
    if (!nodes.length) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (jumping.current) return
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const id = visible[0]?.target?.dataset?.settingsSection
        if (id) onSectionChange?.(id)
      },
      { root: root.closest('.content') || null, rootMargin: '-12% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] }
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [onSectionChange])

  useEffect(() => {
    if (!jumpTo) return undefined
    const el = rootRef.current?.querySelector(`[data-settings-section="${jumpTo}"]`)
    if (!el) return undefined
    jumping.current = true
    onSectionChange?.(jumpTo)
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const t = setTimeout(() => { jumping.current = false }, 600)
    return () => clearTimeout(t)
  }, [jumpTo, onSectionChange])

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
          <p>{SETTINGS_SECTIONS.find((s) => s.id === activeSection)?.label || 'Atelier'}</p>
        </div>
      </div>

      <nav className="settings-tabs" aria-label="Sections réglages">
        {SETTINGS_SECTIONS.map((s) => {
          const Icon = s.icon
          const on = activeSection === s.id
          return (
            <button
              key={s.id}
              type="button"
              className={`settings-tab${on ? ' on' : ''}`}
              aria-current={on ? 'true' : undefined}
              onClick={() => {
                onSectionChange?.(s.id)
                const el = rootRef.current?.querySelector(`[data-settings-section="${s.id}"]`)
                if (el) {
                  jumping.current = true
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  setTimeout(() => { jumping.current = false }, 600)
                }
              }}
            >
              <Icon size={14} strokeWidth={1.8} />
              {s.label}
            </button>
          )
        })}
      </nav>

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

        <Field
          label="Boutons sur les cartes projets"
          hint="Lancer, Arrêter, Dossier et Cloner restent toujours visibles. Les idées et étapes n’apparaissent que dans le détail d’un projet."
        >
          <div className="chip-row settings-toggles">
            {PROJECT_CARD_TOGGLES.map((t) => {
              const on = projectCard[t.id] !== false
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`chip link${on ? ' accent' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    const next = { ...projectCard, [t.id]: !on }
                    setProjectCard(next)
                    save({ projectCard: next })
                  }}
                >
                  {on && <Check size={12} />} {t.label}
                </button>
              )
            })}
          </div>
        </Field>
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

      <section className="card settings-section" data-settings-section="showroom" id="settings-showroom">
        <h4 className="card-title">Showroom PDC</h4>
        <p className="card-desc">
          Publie un projet atelier sur pdc-design-showroom : entrée Firestore + URL{' '}
          <code className="mono">/projet/&#123;slug&#125;</code>, et copie optionnelle dans{' '}
          <code className="mono">public/maquettes/</code>.
        </p>
        <Field label="URL publique du site" hint="Ex. https://ton-showroom.netlify.app">
          <input
            className="input mono"
            value={showroom.siteUrl || ''}
            onChange={(e) => setShowroom({ ...showroom, siteUrl: e.target.value })}
            onBlur={() => saveShowroom(showroom)}
            placeholder="https://…"
          />
        </Field>
        <Field
          label="Dépôt local du showroom"
          hint="Clone de ebarnabo/pdc-design-showroom — pour copier les maquettes HTML."
        >
          <div className="row">
            <input
              className="input mono"
              value={showroom.repoPath || ''}
              onChange={(e) => setShowroom({ ...showroom, repoPath: e.target.value })}
              onBlur={() => saveShowroom(showroom)}
              placeholder="C:\…\pdc-design-showroom"
            />
            <button
              type="button"
              className="btn none"
              onClick={async () => {
                const d = await api.fs.pickDir()
                if (d) saveShowroom({ ...showroom, repoPath: d })
              }}
            >
              Choisir
            </button>
            {showroom.repoPath && (
              <button type="button" className="btn icon none" aria-label="Ouvrir" onClick={() => api.fs.openPath(showroom.repoPath)}>
                <FolderOpen size={16} />
              </button>
            )}
          </div>
        </Field>
        <Field label="Firebase projectId">
          <input
            className="input mono"
            value={showroom.projectId || ''}
            onChange={(e) => setShowroom({ ...showroom, projectId: e.target.value })}
            onBlur={() => saveShowroom(showroom)}
            placeholder="ton-projet-firebase"
          />
        </Field>
        <Field label="Firebase apiKey (Web)">
          <input
            className="input mono"
            type="password"
            value={showroom.apiKey || ''}
            onChange={(e) => setShowroom({ ...showroom, apiKey: e.target.value })}
            onBlur={() => saveShowroom(showroom)}
            placeholder="AIza…"
            autoComplete="off"
          />
        </Field>
        <Field label="authDomain" hint="Optionnel — défaut : {projectId}.firebaseapp.com">
          <input
            className="input mono"
            value={showroom.authDomain || ''}
            onChange={(e) => setShowroom({ ...showroom, authDomain: e.target.value })}
            onBlur={() => saveShowroom(showroom)}
            placeholder="projet.firebaseapp.com"
          />
        </Field>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {showroomStatus?.connected ? (
            <>
              <span className="chip ok">
                <Check size={12} /> {showroomStatus.email || showroomStatus.uid || 'Connecté'}
              </span>
              <button
                type="button"
                className="btn ghost"
                disabled={showroomBusy}
                onClick={async () => {
                  await api.showroom.logout()
                  refresh()
                  const st = await api.showroom.status()
                  setShowroomStatus(st)
                  toast('Déconnecté du showroom')
                }}
              >
                Déconnecter
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn primary"
              disabled={showroomBusy || !(showroom.apiKey && showroom.projectId)}
              onClick={async () => {
                setShowroomBusy(true)
                try {
                  saveShowroom(showroom)
                  const r = await api.showroom.login()
                  if (r?.error || r?.ok === false) toast(r.error || 'Connexion échouée', true)
                  else toast(`Connecté${r.email ? ` · ${r.email}` : ''}`)
                  refresh()
                  setShowroomStatus(await api.showroom.status())
                } finally {
                  setShowroomBusy(false)
                }
              }}
            >
              Se connecter avec Google
            </button>
          )}
          {showroom.siteUrl && (
            <button type="button" className="btn ghost" onClick={() => api.fs.openUrl(showroom.siteUrl)}>
              Ouvrir le site
            </button>
          )}
        </div>
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

        <Field
          label="Prompt système de l’agent"
          hint="Ajouté à chaque conversation. Ton, règles de code, stack préférée, interdits… Laisse vide pour le comportement par défaut."
        >
          <textarea
            className="textarea"
            rows={7}
            value={ai.systemPrompt || ''}
            placeholder={'Ex. : Réponds en français. Préfère Vite + React. N’introduis pas de nouvelles dépendances sans le demander. Écris des composants accessibles.'}
            onChange={(e) => setAi({ ...ai, systemPrompt: e.target.value })}
            onBlur={() => save({ ai })}
          />
        </Field>
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
