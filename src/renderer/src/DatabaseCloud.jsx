import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, RefreshCw, Plus, Terminal } from 'lucide-react'
import { Field, Segmented, Chevron } from './ui.jsx'
import { api } from './bridge.js'

export function DatabaseAccounts({ value, onChange, toast }) {
  const [catalog, setCatalog] = useState([])
  const [cli, setCli] = useState({})
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState('')
  const [lists, setLists] = useState({})
  const [names, setNames] = useState({})

  const reload = () => {
    api.database.cloudStatus().then((r) => {
      setCatalog(r?.catalog || [])
      setCli(r?.cli || {})
    }).catch(() => {})
  }

  useEffect(() => { reload() }, [value.accounts])

  const accounts = value.accounts || {}
  const setAcc = (id, patch) => onChange({
    ...value,
    accounts: { ...accounts, [id]: { ...(accounts[id] || {}), ...patch } }
  })

  const run = async (key, fn, okMsg) => {
    setBusy(key)
    try {
      const r = await fn()
      if (r?.error || r?.ok === false) toast(r.error || 'Échec', true)
      else if (okMsg) toast(okMsg)
      return r
    } catch (e) {
      toast(e.message || String(e), true)
    } finally {
      setBusy('')
      reload()
    }
  }

  return (
    <>
      <Field
        label="Nouveau projet"
        hint="Si le compte est renseigné, PDC crée la base distante et remplit le .env. Sinon, seulement le client + .env.example."
      >
        <Segmented
          value={value.autoCreate !== false ? 'yes' : 'no'}
          onChange={(v) => onChange({ ...value, autoCreate: v === 'yes' })}
          options={[
            { value: 'yes', label: 'Créer la base' },
            { value: 'no', label: 'Plus tard' }
          ]}
        />
      </Field>

      <p className="card-desc" style={{ margin: '4px 0 12px' }}>
        Un compte par produit. Les clés restent sur ta machine. CLI pour l’app, MCP pour Cursor.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {catalog.map((p) => {
          const open = openId === p.id
          const a = accounts[p.id] || {}
          const tool = cli[p.id]
          return (
            <div className="lib-group" key={p.id}>
              <button
                type="button"
                className="lib-head"
                onClick={() => setOpenId(open ? null : p.id)}
                aria-expanded={open}
              >
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <h4>{p.name}</h4>
                  <p>{p.via}</p>
                </div>
                {p.ready
                  ? <span className="chip ok">prêt</span>
                  : <span className="chip">à renseigner</span>}
                {tool?.ok
                  ? <span className="chip">CLI</span>
                  : <span className="chip">CLI absente</span>}
                <Chevron open={open} />
              </button>
              {open && (
                <div className="lib-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
                  <p className="card-desc" style={{ margin: 0 }}>
                    {tool?.ok
                      ? `CLI ${p.cli} détectée.`
                      : `CLI ${p.cli} absente. ${p.install?.startsWith('http') ? 'Télécharge-la.' : `Install : ${p.install}`}`}
                    {p.mcp ? ` MCP : ${p.mcp}.` : ' Pas de MCP officiel.'}
                  </p>

                  {(p.fields || []).map((f) => (
                    <Field key={f.key} label={f.label} hint={f.hint}>
                      <div className="row">
                        <input
                          className="input mono"
                          type={f.secret ? 'password' : 'text'}
                          placeholder={f.placeholder}
                          value={a[f.key] || ''}
                          onChange={(e) => setAcc(p.id, { [f.key]: e.target.value })}
                          autoComplete="off"
                        />
                        {f.url && (
                          <button type="button" className="btn none" onClick={() => api.fs.openUrl(f.url)}>
                            <ExternalLink size={15} /> Où le prendre
                          </button>
                        )}
                      </div>
                    </Field>
                  ))}

                  <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn sm none"
                      disabled={busy === `t-${p.id}`}
                      onClick={() => run(`t-${p.id}`, () => api.database.cloudTest(p.id), 'Connexion OK')}
                    >
                      <RefreshCw size={14} className={busy === `t-${p.id}` ? 'spin' : ''} /> Tester
                    </button>
                    <button
                      type="button"
                      className="btn sm none"
                      disabled={busy === `l-${p.id}`}
                      onClick={async () => {
                        const r = await run(`l-${p.id}`, () => api.database.cloudList(p.id))
                        if (r?.ok) setLists((m) => ({ ...m, [p.id]: r.items || [] }))
                      }}
                    >
                      Lister
                    </button>
                    <button
                      type="button"
                      className="btn sm none"
                      onClick={() => api.fs.openUrl(p.console)}
                    >
                      <ExternalLink size={14} /> Console
                    </button>
                    {p.mcpDocs && (
                      <button type="button" className="btn sm none" onClick={() => api.fs.openUrl(p.mcpDocs)}>
                        Guide MCP
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn sm none"
                      onClick={async () => {
                        const r = await api.database.cloudMcp(p.id)
                        const text = r?.json ? JSON.stringify(r.json, null, 2) : (r?.note || '')
                        try {
                          await navigator.clipboard.writeText(text)
                          toast('Config MCP copiée. Cursor → Settings → MCP.')
                        } catch {
                          toast('Copie impossible. Ouvre le guide MCP.', true)
                        }
                      }}
                    >
                      <Copy size={14} /> Copier MCP
                    </button>
                  </div>

                  <Field label="Créer un projet distant" hint="Nom affiché chez l’hébergeur. Les clés iront dans le .env du prochain projet PDC.">
                    <div className="row">
                      <input
                        className="input"
                        placeholder={`mon-app-${p.id}`}
                        value={names[p.id] || ''}
                        onChange={(e) => setNames((m) => ({ ...m, [p.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn sm primary"
                        disabled={busy === `c-${p.id}` || !p.ready && p.id !== 'firebase'}
                        onClick={() => run(
                          `c-${p.id}`,
                          () => api.database.cloudCreate({ id: p.id, name: names[p.id] || p.name }),
                          'Projet distant créé'
                        )}
                      >
                        <Plus size={14} /> Créer
                      </button>
                    </div>
                  </Field>

                  {lists[p.id]?.length > 0 && (
                    <div className="db-guide">
                      {lists[p.id].map((item) => (
                        <div className="db-guide-item" key={item.id} style={{ cursor: 'default' }}>
                          <span>{item.name}</span>
                          <strong>{item.id}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function ProvisionToggle({ databaseId, ready, value, onChange, goSettings }) {
  if (!databaseId || databaseId === 'none') return null
  return (
    <Field
      label="Base distante"
      hint={ready
        ? 'Compte OK dans Réglages. On crée le projet chez l’hébergeur et on remplit le .env.'
        : 'Pas encore de compte. Le client sera généré ; les clés restent à coller, ou renseigne Réglages.'}
    >
      <Segmented
        value={value ? 'yes' : 'no'}
        onChange={(v) => onChange(v === 'yes')}
        options={[
          { value: 'yes', label: 'Créer maintenant' },
          { value: 'no', label: 'Plus tard' }
        ]}
      />
      {!ready && goSettings && (
        <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={goSettings}>
          <Terminal size={14} /> Ouvrir les comptes
        </button>
      )}
    </Field>
  )
}

export function CloudReady({ id, catalog }) {
  const row = catalog?.find((c) => c.id === id)
  if (!row || id === 'none') return null
  return row.ready
    ? <span className="chip ok" style={{ marginTop: 8 }}><Check size={11} /> Compte {row.name} prêt</span>
    : <span className="chip" style={{ marginTop: 8 }}>Compte {row.name} à renseigner dans Réglages</span>
}
