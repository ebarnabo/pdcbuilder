import {
  Store, ShoppingBag, AppWindow, Cloud, LayoutDashboard, Rocket,
  BookOpen, Briefcase, Building2, Server, Smartphone
} from 'lucide-react'
import { Field } from './ui.jsx'

export const THEMES = [
  { id: 'vitrine', label: 'Site vitrine', icon: Store },
  { id: 'ecommerce', label: 'E-commerce', icon: ShoppingBag },
  { id: 'application', label: 'Application', icon: AppWindow },
  { id: 'saas', label: 'SaaS', icon: Cloud },
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'landing', label: 'Landing', icon: Rocket },
  { id: 'blog', label: 'Blog', icon: BookOpen },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'interne', label: 'Outil interne', icon: Building2 },
  { id: 'api', label: 'API', icon: Server },
  { id: 'mobile', label: 'Mobile', icon: Smartphone }
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
