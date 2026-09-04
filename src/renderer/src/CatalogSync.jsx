import { useMemo, useState } from 'react'
import { ClipboardCopy, ClipboardPaste, Braces } from 'lucide-react'
import { Modal, Field } from './ui.jsx'
import { api } from './bridge.js'

export const CATALOG_FORMAT = 'pdc-catalog'
export const CATALOG_FORMAT_VERSION = 1

const SCHEMA_HINT = `{
  "format": "pdc-catalog",
  "version": 1,
  "frameworks": [
    {
      "id": "vite-react",
      "name": "Vite + React",
      "tag": "React",
      "description": "…",
      "create": "npm create vite@latest {{name}} -- --template react",
      "dev": "npm run dev",
      "build": "npm run build",
      "preview": "npm run preview",
      "outDir": "dist"
    }
  ],
  "libraries": [
    {
      "id": "ui",
      "name": "Interface & composants",
      "description": "…",
      "items": [
        {
          "name": "Zod",
          "pkg": "zod",
          "description": "Schémas TypeScript runtime",
          "dev": false,
          "version": "3.24.0",
          "docs": "https://zod.dev",
          "for": ["any"]
        }
      ]
    }
  ]
}`

function slimFramework(f) {
  return {
    id: f.id,
    name: f.name,
    tag: f.tag || '',
    description: f.description || '',
    family: f.family || undefined,
    create: f.create,
    install: f.install || undefined,
    dev: f.dev,
    build: f.build,
    preview: f.preview,
    outDir: f.outDir,
    scores: f.scores || undefined
  }
}

function slimLibItem(i) {
  const row = {
    name: i.name,
    pkg: i.pkg,
    description: i.description || '',
    dev: Boolean(i.dev)
  }
  if (i.docs) row.docs = i.docs
  if (i.for?.length) row.for = i.for
  if (i.version) row.version = i.version
  return row
}

function slimCategory(c) {
  return {
    id: c.id,
    name: c.name,
    description: c.description || '',
    items: (c.items || []).map(slimLibItem)
  }
}

export function buildCatalogExport({ frameworks, libraries }) {
  const fw = frameworks || []
  const libs = libraries || []
  return {
    format: CATALOG_FORMAT,
    version: CATALOG_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      frameworks: fw.length,
      categories: libs.length,
      libraries: libs.reduce((n, c) => n + (c.items?.length || 0), 0)
    },
    frameworks: fw.map(slimFramework),
    libraries: libs.map(slimCategory)
  }
}

function normalizeItem(raw) {
  const pkg = String(raw?.pkg || '').trim()
  if (!pkg) return null
  const name = String(raw?.name || pkg.split('/').pop() || pkg).trim()
  return {
    id: pkg,
    name,
    pkg,
    description: String(raw?.description || '').trim(),
    dev: Boolean(raw?.dev),
    docs: raw?.docs ? String(raw.docs).trim() : '',
    for: Array.isArray(raw?.for) && raw.for.length ? raw.for.map(String) : ['any'],
    ...(raw?.version ? { version: String(raw.version) } : {})
  }
}

function mergeFrameworkList(current, incoming, mode) {
  if (mode === 'replace' && Array.isArray(incoming)) {
    return incoming.map((f) => {
      const id = String(f.id || f.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (!id || !f.name || !f.create) return null
      return {
        id,
        name: String(f.name),
        tag: String(f.tag || ''),
        description: String(f.description || ''),
        family: f.family || undefined,
        create: String(f.create),
        install: f.install || 'npm install',
        dev: f.dev || 'npm run dev',
        build: f.build || 'npm run build',
        preview: f.preview || 'npm run preview',
        outDir: f.outDir || 'dist',
        scores: f.scores
      }
    }).filter(Boolean)
  }

  const byId = new Map((current || []).map((f) => [f.id, { ...f }]))
  for (const f of incoming || []) {
    const id = String(f.id || f.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!id || !f.name) continue
    const prev = byId.get(id)
    byId.set(id, {
      ...(prev || {
        install: 'npm install',
        dev: 'npm run dev',
        build: 'npm run build',
        preview: 'npm run preview',
        outDir: 'dist'
      }),
      ...prev,
      id,
      name: String(f.name),
      tag: f.tag != null ? String(f.tag) : (prev?.tag || ''),
      description: f.description != null ? String(f.description) : (prev?.description || ''),
      family: f.family || prev?.family,
      create: f.create != null ? String(f.create) : (prev?.create || ''),
      install: f.install || prev?.install || 'npm install',
      dev: f.dev || prev?.dev || 'npm run dev',
      build: f.build || prev?.build || 'npm run build',
      preview: f.preview || prev?.preview || 'npm run preview',
      outDir: f.outDir || prev?.outDir || 'dist',
      scores: f.scores || prev?.scores
    })
  }
  return [...byId.values()]
}

function mergeLibraryList(current, incoming, mode) {
  if (mode === 'replace' && Array.isArray(incoming)) {
    return incoming.map((c) => {
      const id = String(c.id || c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (!id) return null
      const items = (c.items || []).map((i) => normalizeItem(i)).filter(Boolean)
      return {
        id,
        name: String(c.name || id),
        description: String(c.description || ''),
        items
      }
    }).filter(Boolean)
  }

  const byId = new Map((current || []).map((c) => [c.id, { ...c, items: [...(c.items || [])] }]))
  for (const cat of incoming || []) {
    const id = String(cat.id || cat.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!id) continue
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        name: String(cat.name || id),
        description: String(cat.description || ''),
        items: []
      })
    }
    const target = byId.get(id)
    if (cat.name) target.name = String(cat.name)
    if (cat.description != null) target.description = String(cat.description)
    const pkgs = new Map(target.items.map((i) => [i.pkg, { ...i }]))
    for (const raw of cat.items || []) {
      const item = normalizeItem(raw)
      if (!item) continue
      const prev = pkgs.get(item.pkg)
      pkgs.set(item.pkg, {
        ...prev,
        ...item,
        for: item.for?.length ? item.for : (prev?.for || ['any']),
        docs: item.docs || prev?.docs || '',
        version: item.version || prev?.version
      })
    }
    target.items = [...pkgs.values()]
  }
  return [...byId.values()]
}

export function parseCatalogImport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON invalide — vérifie les virgules et guillemets.' }
  }

  if (Array.isArray(data)) {
    data = { format: CATALOG_FORMAT, version: 1, libraries: [{ id: 'import', name: 'Import', items: data }] }
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Le JSON doit être un objet (ou un tableau de paquets).' }
  }

  const hasFw = Array.isArray(data.frameworks)
  const hasLib = Array.isArray(data.libraries)
  if (!hasFw && !hasLib) {
    return { ok: false, error: 'Attendu : { frameworks?: [], libraries?: [] } (format pdc-catalog).' }
  }

  return {
    ok: true,
    data: {
      format: data.format || CATALOG_FORMAT,
      version: data.version || 1,
      frameworks: hasFw ? data.frameworks : undefined,
      libraries: hasLib ? data.libraries : undefined
    }
  }
}

export function applyCatalogImport({ frameworks, libraries }, payload, mode = 'merge') {
  const next = { frameworks, libraries }
  let fwDelta = 0
  let libDelta = 0

  if (payload.frameworks) {
    const before = new Set((frameworks || []).map((f) => f.id))
    next.frameworks = mergeFrameworkList(frameworks, payload.frameworks, mode)
    fwDelta = mode === 'replace'
      ? next.frameworks.length
      : next.frameworks.filter((f) => !before.has(f.id)).length
  }
  if (payload.libraries) {
    const beforePkgs = new Set((libraries || []).flatMap((c) => (c.items || []).map((i) => i.pkg)))
    next.libraries = mergeLibraryList(libraries, payload.libraries, mode)
    const afterPkgs = next.libraries.flatMap((c) => (c.items || []).map((i) => i.pkg))
    libDelta = mode === 'replace'
      ? afterPkgs.length
      : afterPkgs.filter((p) => !beforePkgs.has(p)).length
  }

  return { ...next, fwDelta, libDelta }
}

export function CatalogSync({ state, refresh, toast }) {
  const [open, setOpen] = useState(false)
  const [paste, setPaste] = useState('')
  const [mode, setMode] = useState('merge')
  const [busy, setBusy] = useState(false)

  const snapshot = useMemo(
    () => buildCatalogExport({ frameworks: state.frameworks, libraries: state.libraries }),
    [state.frameworks, state.libraries]
  )

  const copy = async () => {
    const text = JSON.stringify(snapshot, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      toast(`Catalogue copié · ${snapshot.counts.libraries} libs, ${snapshot.counts.frameworks} frameworks`)
    } catch {
      setOpen(true)
      setPaste(text)
      toast('Presse-papiers indisponible — JSON affiché pour copie manuelle', true)
    }
  }

  const apply = async () => {
    const parsed = parseCatalogImport(paste)
    if (!parsed.ok) return toast(parsed.error, true)
    setBusy(true)
    try {
      const result = applyCatalogImport(
        { frameworks: state.frameworks, libraries: state.libraries },
        parsed.data,
        mode
      )
      const patch = {}
      if (parsed.data.frameworks) patch.frameworks = result.frameworks
      if (parsed.data.libraries) patch.libraries = result.libraries
      await api.state.patch(patch)
      refresh()
      setOpen(false)
      setPaste('')
      const bits = []
      if (parsed.data.frameworks) {
        bits.push(mode === 'replace' ? `${result.frameworks.length} frameworks` : `${result.fwDelta} framework(s)`)
      }
      if (parsed.data.libraries) {
        bits.push(mode === 'replace' ? 'librairies remplacées' : `${result.libDelta} lib(s) ajoutée(s)`)
      }
      toast(`Catalogue ${mode === 'replace' ? 'remplacé' : 'fusionné'} · ${bits.join(' · ')}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn" onClick={copy} title="Copier frameworks + librairies en JSON">
        <ClipboardCopy size={15} /> Copier JSON
      </button>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <ClipboardPaste size={15} /> Coller JSON
      </button>

      {open && (
        <Modal
          title="Catalogue ↔ JSON"
          subtitle="Copie pour une IA, puis colle sa réponse pour mettre à jour ou ajouter des technologies."
          onClose={busy ? () => {} : () => setOpen(false)}
          width={720}
          footer={
            <>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setOpen(false)}>Fermer</button>
              <button type="button" className="btn" disabled={busy} onClick={copy}>
                <ClipboardCopy size={15} /> Recopier l’export
              </button>
              <button type="button" className="btn primary" disabled={busy || !paste.trim()} onClick={apply}>
                <Braces size={15} /> Appliquer
              </button>
            </>
          }
        >
          <p className="card-desc">
            Format attendu : <code>pdc-catalog</code> v{CATALOG_FORMAT_VERSION}.
            L’IA peut enrichir <code>version</code>, <code>description</code>, <code>docs</code> et ajouter des <code>items</code>.
          </p>
          <div className="row" style={{ marginBottom: 10 }}>
            <button type="button" className={`btn sm${mode === 'merge' ? ' primary' : ''}`} onClick={() => setMode('merge')}>
              Fusionner
            </button>
            <button type="button" className={`btn sm${mode === 'replace' ? ' primary' : ''}`} onClick={() => setMode('replace')}>
              Remplacer
            </button>
            <span className="chip">{snapshot.counts.libraries} libs · {snapshot.counts.frameworks} fw</span>
          </div>
          <Field label="JSON à appliquer" hint={mode === 'merge' ? 'Ajoute / met à jour sans tout effacer.' : 'Écrase la section présente dans le JSON.'}>
            <textarea
              className="textarea mono"
              rows={16}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={SCHEMA_HINT}
              spellCheck={false}
            />
          </Field>
          <details className="catalog-schema">
            <summary>Schéma d’exemple</summary>
            <pre>{SCHEMA_HINT}</pre>
          </details>
        </Modal>
      )}
    </>
  )
}
