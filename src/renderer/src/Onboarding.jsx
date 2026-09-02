import { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Boxes, Database, FolderOpen, Github, Sparkles, SkipForward, Wand2
} from 'lucide-react'
import { Field, ScoreNotes } from './ui.jsx'
import { GitFields, GitStatus } from './GitFields.jsx'
import { DatabasePicker } from './DatabaseFields.jsx'
import { DatabaseAccounts } from './DatabaseCloud.jsx'
import { PackageManagerPicker } from './PackageManagerPicker.jsx'
import { api } from './bridge.js'

const STEPS = [
  { id: 'welcome', label: 'Bienvenue', optional: false },
  { id: 'workspace', label: 'Atelier', optional: true },
  { id: 'pm', label: 'Paquets', optional: true },
  { id: 'git', label: 'Dépôts', optional: true },
  { id: 'database', label: 'Bases', optional: true },
  { id: 'ai', label: 'Assistant', optional: true },
  { id: 'done', label: 'Prêt', optional: false }
]

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Onboarding({ state, onComplete }) {
  const [step, setStep] = useState(0)
  const [skipped, setSkipped] = useState([])
  const [providers, setProviders] = useState({})
  const [gitStatus, setGitStatus] = useState(null)
  const [workspace, setWorkspace] = useState(state.workspace)
  const [editor, setEditor] = useState(state.editor)
  const [packageManager, setPackageManager] = useState(state.packageManager || 'npm')
  const [git, setGit] = useState({
    autoCreate: true,
    provider: 'github',
    visibility: 'private',
    org: '',
    branch: 'main',
    ...state.git
  })
  const [database, setDatabase] = useState(state.database || { defaultId: 'none', autoCreate: true, accounts: {} })
  const [ai, setAi] = useState(state.ai)

  useEffect(() => { api.ai.providers().then(setProviders) }, [])
  useEffect(() => { api.git.status().then(setGitStatus) }, [])

  const current = STEPS[step]
  const progress = ((step + 1) / STEPS.length) * 100

  const saveFields = async (fields) => {
    await api.state.patch(fields)
  }

  const finish = async (allSkipped = []) => {
    await saveFields({
      workspace,
      editor,
      packageManager,
      git: {
        autoCreate: true,
        provider: 'github',
        visibility: 'private',
        org: '',
        branch: 'main',
        ...git
      },
      database,
      ai,
      onboarding: {
        completed: true,
        version: 1,
        skipped: allSkipped.length ? allSkipped : skipped,
        completedAt: Date.now()
      }
    })
    onComplete()
  }

  const persistStep = async () => {
    if (current.id === 'workspace') await saveFields({ workspace, editor })
    if (current.id === 'pm') await saveFields({ packageManager })
    if (current.id === 'git') await saveFields({ git })
    if (current.id === 'database') await saveFields({ database })
    if (current.id === 'ai') await saveFields({ ai })
  }

  const next = async () => {
    if (current.id === 'done') {
      await finish()
      return
    }
    await persistStep()
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const skip = async () => {
    if (current.id === 'welcome') {
      await finish(STEPS.filter((s) => s.optional).map((s) => s.id))
      return
    }
    if (current.optional) setSkipped((ids) => [...ids, current.id])
    if (step >= STEPS.length - 1) await finish()
    else setStep((s) => s + 1)
  }

  const back = () => setStep((s) => Math.max(0, s - 1))

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="onboard-chrome">
        <div className="drag" />
      </div>

      <div className="onboard-progress" aria-hidden>
        <i style={{ width: `${progress}%` }} />
      </div>

      <div className="onboard-dots" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <span key={s.id} className={`onboard-dot${i === step ? ' on' : ''}${i < step ? ' done' : ''}`} />
        ))}
      </div>

      <div className="onboard-body">
        <div className={`onboard-panel${reduced() ? '' : ' animate'}`} key={current.id}>
          {current.id === 'welcome' && (
            <>
              <div className="onboard-hero">
                <div className="onboard-badge">
                  <span className="onboard-arc" aria-hidden />
                  <div className="mark">PB</div>
                </div>
                <h2 id="onboard-title">Bienvenue dans PDC Builder</h2>
                <p className="onboard-lead">
                  Quelques réglages pour préparer l’atelier. Chaque étape est facultative — tu pourras tout modifier dans Réglages.
                </p>
              </div>
              <ul className="onboard-features">
                <li><Boxes size={18} /> Créer, lancer et builder des projets web</li>
                <li><Github size={18} /> Lier GitHub ou Cursor Origin</li>
                <li><Database size={18} /> Configurer Supabase, Neon, Firebase…</li>
                <li><Sparkles size={18} /> Brancher l’assistant sur ton modèle</li>
              </ul>
            </>
          )}

          {current.id === 'workspace' && (
            <>
              <h2 id="onboard-title">Où vivent tes projets ?</h2>
              <p className="onboard-lead">Le dossier parent et la commande pour ouvrir le code dans ton éditeur.</p>
              <Field label="Dossier de l’atelier">
                <div className="row">
                  <input className="input mono" value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
                  <button type="button" className="btn none" onClick={async () => {
                    const d = await api.fs.pickDir()
                    if (d) setWorkspace(d)
                  }}>
                    <FolderOpen size={15} /> Choisir
                  </button>
                </div>
              </Field>
              <Field label="Éditeur" hint="« code » pour VS Code, « cursor » pour Cursor.">
                <input className="input mono" value={editor} onChange={(e) => setEditor(e.target.value)} />
              </Field>
            </>
          )}

          {current.id === 'pm' && (
            <>
              <h2 id="onboard-title">Gestionnaire de paquets</h2>
              <p className="onboard-lead">npm, pnpm, Yarn ou Bun — choisis celui qui installera tes dépendances par défaut.</p>
              <PackageManagerPicker value={packageManager} onChange={setPackageManager} />
            </>
          )}

          {current.id === 'git' && (
            <>
              <h2 id="onboard-title">Dépôts distants</h2>
              <p className="onboard-lead">Préférences pour créer ou cloner un dépôt avec chaque nouveau projet.</p>
              <GitFields value={git} onChange={setGit} status={gitStatus} showAuto />
              <GitStatus status={gitStatus} onRefresh={() => api.git.status().then(setGitStatus)} />
            </>
          )}

          {current.id === 'database' && (
            <>
              <h2 id="onboard-title">Bases de données</h2>
              <p className="onboard-lead">Choix par défaut et comptes pour provisionner une base à la création du projet.</p>
              <DatabasePicker
                value={database.defaultId || 'none'}
                onChange={(id) => setDatabase({ ...database, defaultId: id })}
              />
              <div className="onboard-scroll">
                <DatabaseAccounts
                  value={database}
                  onChange={setDatabase}
                  toast={() => {}}
                />
              </div>
            </>
          )}

          {current.id === 'ai' && (
            <>
              <h2 id="onboard-title">Assistant IA</h2>
              <p className="onboard-lead">Local (Ollama) ou API cloud. Tu peux ignorer et configurer plus tard.</p>
              <div className="chip-row" style={{ marginBottom: 12 }}>
                {Object.entries(providers).map(([id, p]) => (
                  <button
                    key={id}
                    type="button"
                    className={`chip link${ai.provider === id ? ' accent' : ''}`}
                    onClick={() => setAi({ ...ai, provider: id, baseUrl: p.baseUrl || ai.baseUrl })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <ScoreNotes scores={providers[ai.provider]?.scores} />
              <div className="row">
                <Field label="Adresse du service">
                  <input className="input mono" value={ai.baseUrl} onChange={(e) => setAi({ ...ai, baseUrl: e.target.value })} />
                </Field>
                <Field label={providers[ai.provider]?.needsKey ? 'Clé API' : 'Clé API (facultatif)'}>
                  <input
                    className="input mono"
                    type="password"
                    value={ai.apiKey || ''}
                    placeholder={providers[ai.provider]?.needsKey ? 'sk-…' : 'non requise en local'}
                    onChange={(e) => setAi({ ...ai, apiKey: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Modèle">
                <input className="input mono" value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} />
              </Field>
            </>
          )}

          {current.id === 'done' && (
            <>
              <div className="onboard-hero">
                <div className="onboard-badge done">
                  <Wand2 size={28} color="var(--accent)" />
                </div>
                <h2 id="onboard-title">L’atelier est prêt</h2>
                <p className="onboard-lead">
                  {skipped.length
                    ? `Tu as passé ${skipped.length} étape${skipped.length > 1 ? 's' : ''}. Tout reste modifiable dans Réglages.`
                    : 'Tes préférences sont enregistrées. Tu peux créer ton premier projet.'}
                </p>
              </div>
              <div className="chip-row" style={{ justifyContent: 'center' }}>
                <span className="chip">{workspace.split(/[/\\]/).pop() || workspace}</span>
                <span className="chip">{packageManager}</span>
                <span className="chip">{git.autoCreate ? `${git.provider} · dépôt auto` : 'Sans dépôt auto'}</span>
                <span className="chip">{database.defaultId === 'none' ? 'Sans base' : database.defaultId}</span>
                <span className="chip accent">{providers[ai.provider]?.label || ai.provider}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="onboard-foot">
        {step > 0 && current.id !== 'done' && (
          <button type="button" className="btn ghost" onClick={back}>
            <ArrowLeft size={15} /> Retour
          </button>
        )}
        <div className="spacer" />
        {current.id !== 'done' && (
          <button type="button" className="btn ghost" onClick={skip}>
            <SkipForward size={15} />
            {current.id === 'welcome' ? 'Passer l’introduction' : 'Passer cette étape'}
          </button>
        )}
        <button type="button" className="btn primary" onClick={next}>
          {current.id === 'welcome' ? 'Commencer' : current.id === 'done' ? 'Entrer dans l’atelier' : 'Continuer'}
          {current.id !== 'done' && <ArrowRight size={15} />}
        </button>
      </footer>
    </div>
  )
}
