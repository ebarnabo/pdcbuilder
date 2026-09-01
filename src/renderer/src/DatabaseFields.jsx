import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Field } from './ui.jsx'
import { api } from './bridge.js'

export function DatabasePicker({ value, onChange }) {
  const [providers, setProviders] = useState([])
  const [guide, setGuide] = useState([])

  useEffect(() => {
    api.database.list().then((r) => {
      setProviders(r?.providers || [])
      setGuide(r?.guide || [])
    }).catch(() => {})
  }, [])

  const selected = providers.find((d) => d.id === value) || providers[0]

  return (
    <Field
      label="Base de données"
      hint="Un seul produit. Le client, .env.example et un guide sont générés dans le projet."
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
          </button>
        ))}
      </div>
      {selected && selected.id !== 'none' && (
        <div className="db-explain">
          <p><strong>À choisir si</strong> {selected.choose}</p>
          <p><strong>À éviter si</strong> {selected.skip}</p>
          {selected.features?.length > 0 && (
            <div className="chip-row" style={{ marginTop: 8 }}>
              {selected.features.map((f) => <span className="chip" key={f}>{f}</span>)}
            </div>
          )}
        </div>
      )}
    </Field>
  )
}
