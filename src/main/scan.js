/**
 * Découverte de projets web sur le disque (package.json).
 */
import { join, basename } from 'path'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'

const SKIP = new Set([
  'node_modules', 'dist', 'build', '.git', '.next', '.nuxt', '.output',
  '.turbo', '.vite', 'coverage', '.cache', 'out', 'release', 'vendor',
  'target', '__pycache__', '.svn', '.hg'
])

function isDir(path) {
  try { return statSync(path).isDirectory() } catch { return false }
}

function readPkg(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
}

function walk(dir, depth, maxDepth, found) {
  if (depth > maxDepth || found.length >= 200) return
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) }
  catch { return }

  const hasPkg = entries.some((e) => e.isFile() && e.name === 'package.json')
  if (hasPkg) {
    const pkg = readPkg(dir)
    if (pkg) {
      found.push({
        path: dir,
        name: pkg.name && !pkg.name.startsWith('@') ? String(pkg.name).split('/').pop() : basename(dir),
        description: pkg.description || '',
        hasGit: existsSync(join(dir, '.git'))
      })
    }
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue
    walk(join(dir, entry.name), depth + 1, maxDepth, found)
  }
}

/** Scanne une ou plusieurs racines. Profondeur limitée pour rester rapide. */
export function findProjects(roots = [], { maxDepth = 3 } = {}) {
  const found = []
  const seen = new Set()
  for (const root of roots) {
    if (!root || !existsSync(root) || !isDir(root)) continue
    const batch = []
    walk(root, 0, maxDepth, batch)
    for (const item of batch) {
      const key = item.path.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      found.push(item)
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}
