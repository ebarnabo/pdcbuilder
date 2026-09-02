import { Field } from './ui.jsx'

export const THEMES = [
  { id: 'vitrine', label: 'Site vitrine' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'application', label: 'Application' },
  { id: 'saas', label: 'SaaS' },
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'landing', label: 'Landing' },
  { id: 'blog', label: 'Blog' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'interne', label: 'Outil interne' },
  { id: 'api', label: 'API' },
  { id: 'mobile', label: 'Mobile' }
]

const LABELS = Object.fromEntries(THEMES.map((t) => [t.id, t.label]))

export function themeLabel(id) {
  return LABELS[id] || id
}

export function themeLabels(ids) {
  return (ids || []).map(themeLabel)
}

export function toggleTheme(list, id) {
  const cur = list || []
  return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
}

export function ThemePicker({ value = [], onChange, hint = 'Ce que le projet est. Plusieurs tags possibles.' }) {
  return (
    <Field label="Thème" hint={hint}>
      <div className="chip-row">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip link${value.includes(t.id) ? ' accent' : ''}`}
            onClick={() => onChange(toggleTheme(value, t.id))}
            aria-pressed={value.includes(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </Field>
  )
}
