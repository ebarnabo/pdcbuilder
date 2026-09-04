/** Métadonnées UI pour les blueprints expérience (miroir du seed main). */
export const EXPERIENCE_CATEGORIES = [
  { id: 'marketing', label: 'Marketing', hint: 'Conversion, récit, première impression' },
  { id: 'product', label: 'Produit', hint: 'Usage quotidien, rétention, clarté' },
  { id: 'content', label: 'Contenu', hint: 'Lecture, éditorial, portfolio' },
  { id: 'commerce', label: 'Commerce', hint: 'Catalogue, confiance, achat' },
  { id: 'ops', label: 'Opérations', hint: 'Outils internes, densité, efficacité' }
]

export function categoryLabel(id) {
  return EXPERIENCE_CATEGORIES.find((c) => c.id === id)?.label || id || 'Perso'
}

export function isExperience(bp) {
  return bp?.kind === 'experience' || bp?.builtin === true
}
