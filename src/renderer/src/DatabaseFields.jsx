import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Field, ScoreStrip, ScoreNotes } from './ui.jsx'
import { CloudReady } from './DatabaseCloud.jsx'
import { api } from './bridge.js'

export function DatabasePicker({ value, onChange }) {
  const [providers, setProviders] = useState([])
  const [guide, setGuide] = useState([])
  const [cloud, setCloud] = useState([])

  useEffect(() => {
    api.database.list().then((r) => {
      setProviders(r?.providers || [])
      setGuide(r?.guide || [])
      setCloud(r?.cloud || [])
    }).catch(() => {})
  }, [])

  const selected = providers.find((d) => d.id === value) || providers[0]
  const cloudRow = cloud.find((c) => c.id === selected?.id)

  return (
    <Field
      label="Base de données"
      hint="Client, .env et guide générés. Sortie free : plus de points = tu payes plus tôt."
    >
      {guide.length > 0 && (
        <div className="db-guide">
          {guide.map((g) => (
            <button
              key={g.id}
              type="button"
              className="db-guide-item"
              onClick={() => onChange(g.id)}
            >
              <span>{g.match}</span>
              <strong>{providers.find((p) => p.id === g.id)?.name || g.id}</strong>
            </button>
          ))}
        </div>
      )}
      <div className="db-grid">
        {providers.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`db-card${value === d.id ? ' on' : ''}`}
            onClick={() => onChange(d.id)}
            aria-pressed={value === d.id}
          >
            <span className="db-card-top">
              <span>
                <strong>{d.name}</strong>
                <em>{d.kind}</em>
              </span>
              {value === d.id && <Check size={15} />}
            </span>
            <small>{d.summary}</small>
            <ScoreStrip scores={d.scores} />
          </button>
        ))}
      </div>
      {selected && selected.id !== 'none' && (
        <div className="db-explain">
          <p><strong>Si</strong> {selected.choose}</p>
          <p><strong>Pas si</strong> {selected.skip}</p>
          <ScoreNotes scores={selected.scores} />
          {cloudRow && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--text-2)' }}>
              {cloudRow.via}. MCP : {cloudRow.mcp || 'aucun officiel'}.
              {cloudRow.ready ? ' Compte prêt — on peut créer la base depuis l’app.' : ' Renseigne le compte dans Réglages → Comptes, CLI et MCP.'}
            </p>
          )}
          <CloudReady id={selected.id} catalog={cloud} />
        </div>
      )}
    </Field>
  )
}
