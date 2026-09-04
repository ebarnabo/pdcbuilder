import { useEffect, useMemo, useState } from 'react'
import { ArrowUpCircle, Download, RefreshCw, Trash2 } from 'lucide-react'
import { Confirm, Field } from './ui.jsx'
import { api } from './bridge.js'

function ToolRow({ item, busy, onInstall, onUpdate, onUninstall }) {
  const working = busy === item.id
  return (
    <div className={`tc-card${item.installed ? ' on' : ''}`}>
      <div className="tc-card-body">
        <div className="tc-card-head">
          <strong>{item.name}</strong>
          {item.installed && item.version && <span className="chip ok">{item.version}</span>}
          {item.installed && item.isDefault && <span className="chip accent">Défaut</span>}
          {!item.installed && <span className="chip err">Absent</span>}
        </div>
        {item.tag && <span className="tc-tag">{item.tag}</span>}
        <p className="tc-blurb">{item.blurb}</p>
        {item.path && <code className="tc-path" title={item.path}>{item.path}</code>}
      </div>
      <div className="tc-card-actions">
        {!item.installed && item.canInstall && (
          <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => onInstall(item)}>
            {working ? <RefreshCw size={13} className="spin" /> : <Download size={13} />}
            Installer
          </button>
        )}
        {item.installed && item.canUpdate && (
          <button type="button" className="btn sm ghost" disabled={!!busy} onClick={() => onUpdate(item)}>
            {working ? <RefreshCw size={13} className="spin" /> : <ArrowUpCircle size={13} />}
            Mettre à jour
          </button>
        )}
        {item.installed && item.canUninstall && (
          <button type="button" className="btn sm danger" disabled={!!busy} onClick={() => onUninstall(item)}>
            {working ? <RefreshCw size={13} className="spin" /> : <Trash2 size={13} />}
            Supprimer
          </button>
        )}
        {item.installed && !item.canUninstall && !item.canUpdate && (
          <span className="chip">Détecté</span>
        )}
      </div>
    </div>
  )
}

export function ToolchainPanel({ toast }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState('')
  const [checking, setChecking] = useState(false)
  const [pendingRemove, setPendingRemove] = useState(null)

  const reload = async () => {
    setChecking(true)
    try {
      const r = await api.toolchain.status()
      setData(r || null)
    } catch {
      setData(null)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { reload() }, [])

  const byGroup = useMemo(() => {
    if (!data) return []
    const buckets = new Map()
    for (const g of data.groups || []) buckets.set(g.id, { ...g, items: [] })
    const push = (item) => {
      const g = buckets.get(item.group)
      if (g) g.items.push(item)
      else {
        if (!buckets.has(item.group)) buckets.set(item.group, { id: item.group, label: item.group, hint: '', items: [] })
        buckets.get(item.group).items.push(item)
      }
    }
    for (const item of data.python || []) push(item)
    for (const item of data.tools || []) push(item)
    return [...buckets.values()].filter((g) => g.items.length)
  }, [data])

  const run = async (item, action, verb) => {
    setBusy(item.id)
    try {
      const r = await api.toolchain[action](item.id)
      if (r?.error || r?.ok === false) {
        toast?.(r.error || r.stderr || `${verb} échoué — voir la console`, true)
      } else {
        toast?.(`${item.name} : ${verb}`)
      }
    } finally {
      setBusy('')
      await reload()
    }
  }

  const installerHint = data?.installer
    ? (data.installer.ok
      ? `Installations via ${data.installer.label}. La sortie apparaît dans la console.`
      : `${data.installer.label} est introuvable — installe-le pour ajouter ou retirer des SDK.`)
    : 'Détection des runtimes et outils installés sur la machine.'

  return (
    <Field label="SDK & outils de développement" hint={installerHint}>
      <div className="pm-toolbar">
        <button type="button" className="btn sm ghost" disabled={!!busy || checking} onClick={reload}>
          <RefreshCw size={13} className={checking ? 'spin' : ''} /> Actualiser
        </button>
        {data?.pythons?.length > 0 && (
          <span className="chip accent">
            {data.pythons.length} Python détecté{data.pythons.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!data && checking && <p className="card-desc">Scan de la machine…</p>}

      {byGroup.map((group) => (
        <div className="tc-group" key={group.id}>
          <div className="tc-group-head">
            <h5>{group.label}</h5>
            {group.hint && <p>{group.hint}</p>}
          </div>
          <div className="tc-grid">
            {group.items.map((item) => (
              <ToolRow
                key={item.id}
                item={item}
                busy={busy}
                onInstall={(it) => run(it, 'install', 'installé')}
                onUpdate={(it) => run(it, 'update', 'mis à jour')}
                onUninstall={setPendingRemove}
              />
            ))}
          </div>
        </div>
      ))}

      {pendingRemove && (
        <Confirm
          title={`Supprimer ${pendingRemove.name} ?`}
          subtitle="L’outil sera désinstallé de la machine (pas seulement de PDC Builder)."
          confirm="Supprimer"
          busy={busy === pendingRemove.id}
          onClose={() => setPendingRemove(null)}
          onConfirm={async () => {
            const item = pendingRemove
            setPendingRemove(null)
            await run(item, 'uninstall', 'supprimé')
          }}
        >
          <p className="card-desc" style={{ margin: 0 }}>
            {pendingRemove.path
              ? <>Chemin : <code>{pendingRemove.path}</code></>
              : 'Confirme uniquement si tu n’en as plus besoin pour d’autres projets.'}
          </p>
        </Confirm>
      )}
    </Field>
  )
}
