import { spawn } from 'child_process'
import { homedir, platform } from 'os'

const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

const WINGET_FLAGS = '--accept-package-agreements --accept-source-agreements --disable-interactivity'

function run(command, cwd = homedir()) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => { stdout += String(d) })
    child.stderr?.on('data', (d) => { stderr += String(d) })
    child.on('close', (code) => resolve({ ok: code === 0, stdout, stderr }))
  })
}

async function hasCommand(name) {
  const probe = isWin ? `where ${name}` : `command -v ${name}`
  const r = await run(probe)
  return r.ok
}

async function readVersion(bin, flag = '--version') {
  const r = await run(`${bin} ${flag}`)
  if (!r.ok && !(r.stdout || r.stderr)) return null
  const line = (r.stdout || r.stderr || '').trim().split(/\r?\n/).find(Boolean)
  if (!line) return null
  if (/introuvable|not found|microsoft store|windowsapps|disabled by your|no pythons found/i.test(line)) {
    return null
  }
  const m = line.match(/(\d+\.\d+(?:\.\d+)?)/)
  return m ? m[1] : null
}

function isRealPythonPath(path) {
  if (!path) return false
  if (/WindowsApps/i.test(path)) return false
  if (/introuvable|microsoft store/i.test(path)) return false
  return true
}

function isMinor(v) {
  return /^\d+\.\d+$/.test(String(v || ''))
}

function wingetInstall(id) {
  return `winget install -e --id ${id} ${WINGET_FLAGS}`
}

function wingetUninstall(id) {
  return `winget uninstall -e --id ${id} --disable-interactivity`
}

function wingetUpgrade(id) {
  return `winget upgrade -e --id ${id} ${WINGET_FLAGS}`
}

function brewInstall(formula) {
  return `brew install ${formula}`
}

function brewUninstall(formula) {
  return `brew uninstall ${formula}`
}

function brewUpgrade(formula) {
  return `brew upgrade ${formula}`
}

function pickCmd(map) {
  if (!map) return null
  if (isWin) return map.win || null
  if (isMac) return map.mac || null
  return map.linux || null
}

/** Versions majeures Python proposées à l’install (winget / brew). */
export const PYTHON_TARGETS = [
  { minor: '3.11', name: 'Python 3.11', winget: 'Python.Python.3.11', brew: 'python@3.11' },
  { minor: '3.12', name: 'Python 3.12', winget: 'Python.Python.3.12', brew: 'python@3.12' },
  { minor: '3.13', name: 'Python 3.13', winget: 'Python.Python.3.13', brew: 'python@3.13' },
  { minor: '3.14', name: 'Python 3.14', winget: 'Python.Python.3.14', brew: 'python@3.14' }
]

export const TOOLS = [
  {
    id: 'git',
    name: 'Git',
    group: 'vcs',
    tag: 'Contrôle de version',
    blurb: 'Indispensable pour cloner, commit et push depuis l’atelier.',
    detect: 'git',
    install: { win: wingetInstall('Git.Git'), mac: brewInstall('git'), linux: 'sudo apt-get install -y git' },
    uninstall: { win: wingetUninstall('Git.Git'), mac: brewUninstall('git') },
    update: { win: wingetUpgrade('Git.Git'), mac: brewUpgrade('git') }
  },
  {
    id: 'gh',
    name: 'GitHub CLI',
    group: 'vcs',
    tag: 'Repos GitHub',
    blurb: 'Auth, création de dépôts et sync des repos depuis PDC Builder.',
    detect: 'gh',
    install: { win: wingetInstall('GitHub.cli'), mac: brewInstall('gh'), linux: null },
    uninstall: { win: wingetUninstall('GitHub.cli'), mac: brewUninstall('gh') },
    update: { win: wingetUpgrade('GitHub.cli'), mac: brewUpgrade('gh') }
  },
  {
    id: 'node',
    name: 'Node.js LTS',
    group: 'runtime',
    tag: 'Runtime JS',
    blurb: 'Base des projets web (npm inclus). Préférer LTS pour la stabilité.',
    detect: 'node',
    install: {
      win: wingetInstall('OpenJS.NodeJS.LTS'),
      mac: brewInstall('node'),
      linux: null
    },
    uninstall: {
      win: wingetUninstall('OpenJS.NodeJS.LTS'),
      mac: brewUninstall('node')
    },
    update: {
      win: wingetUpgrade('OpenJS.NodeJS.LTS'),
      mac: brewUpgrade('node')
    }
  },
  {
    id: 'uv',
    name: 'uv',
    group: 'python',
    tag: 'Python · paquets',
    blurb: 'Installateur Python ultra-rapide (Astral). Remplace pip/venv au quotidien.',
    detect: 'uv',
    install: {
      win: wingetInstall('astral-sh.uv'),
      mac: brewInstall('uv'),
      linux: 'curl -LsSf https://astral.sh/uv/install.sh | sh'
    },
    uninstall: {
      win: wingetUninstall('astral-sh.uv'),
      mac: brewUninstall('uv')
    },
    update: {
      win: wingetUpgrade('astral-sh.uv'),
      mac: brewUpgrade('uv'),
      linux: 'uv self update'
    }
  },
  {
    id: 'pipx',
    name: 'pipx',
    group: 'python',
    tag: 'Apps Python isolées',
    blurb: 'Installe des CLI Python (ruff, poetry…) dans des venv isolés.',
    detect: 'pipx',
    install: {
      win: 'python -m pip install --user pipx && python -m pipx ensurepath',
      mac: brewInstall('pipx'),
      linux: 'python3 -m pip install --user pipx && python3 -m pipx ensurepath'
    },
    uninstall: {
      win: 'python -m pip uninstall -y pipx',
      mac: brewUninstall('pipx'),
      linux: 'python3 -m pip uninstall -y pipx'
    },
    update: {
      win: 'python -m pip install --user -U pipx',
      mac: brewUpgrade('pipx'),
      linux: 'python3 -m pip install --user -U pipx'
    }
  },
  {
    id: 'ruff',
    name: 'Ruff',
    group: 'python',
    tag: 'Lint · format',
    blurb: 'Linter et formateur Python ultra-rapide. Utile dès qu’il y a du Python dans le dépôt.',
    detect: 'ruff',
    install: {
      win: wingetInstall('Astral.Ruff'),
      mac: brewInstall('ruff'),
      linux: 'curl -LsSf https://astral.sh/ruff/install.sh | sh'
    },
    uninstall: {
      win: wingetUninstall('Astral.Ruff'),
      mac: brewUninstall('ruff')
    },
    update: {
      win: wingetUpgrade('Astral.Ruff'),
      mac: brewUpgrade('ruff')
    }
  },
  {
    id: 'go',
    name: 'Go',
    group: 'runtime',
    tag: 'Langage',
    blurb: 'SDK Go pour backends, CLIs et outils modernes.',
    detect: 'go',
    versionFlag: 'version',
    install: { win: wingetInstall('GoLang.Go'), mac: brewInstall('go'), linux: null },
    uninstall: { win: wingetUninstall('GoLang.Go'), mac: brewUninstall('go') },
    update: { win: wingetUpgrade('GoLang.Go'), mac: brewUpgrade('go') }
  },
  {
    id: 'rust',
    name: 'Rust',
    group: 'runtime',
    tag: 'Langage',
    blurb: 'Compilateur Rust (via rustup). Nécessaire pour certains outils natifs.',
    detect: 'rustc',
    install: {
      win: wingetInstall('Rustlang.Rustup'),
      mac: 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y',
      linux: 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y'
    },
    uninstall: {
      win: wingetUninstall('Rustlang.Rustup'),
      mac: 'rustup self uninstall -y',
      linux: 'rustup self uninstall -y'
    },
    update: {
      win: 'rustup update',
      mac: 'rustup update',
      linux: 'rustup update'
    }
  }
]

function pythonId(minor) {
  return `python-${minor}`
}

function parsePyList(text) {
  const rows = []
  const lines = String(text || '').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || /^Installed/i.test(line)) continue

    const verMatch = line.match(/^-V?:?(\d+\.\d+(?:\.\d+)?)/i)
      || line.match(/^-(\d+\.\d+(?:\.\d+)?)(?:-\w+)?/)
      || line.match(/^(\d+\.\d+(?:\.\d+)?)\b/)
    if (!verMatch) continue

    const full = verMatch[1]
    const minor = full.split('.').slice(0, 2).join('.')
    if (!isMinor(minor)) continue

    const tokens = line.split(/\s+/).filter(Boolean)
    const path = tokens.find((t) => /^[A-Za-z]:\\/.test(t) || t.startsWith('/')) || ''
    if (!isRealPythonPath(path)) continue

    rows.push({
      minor,
      version: full,
      path,
      default: tokens.includes('*') || /\*\s+\S/.test(line)
    })
  }
  return rows
}

async function detectInstalledPythons() {
  const found = []
  const seen = new Set()

  const push = (row) => {
    if (!row?.minor || !isMinor(row.minor) || !isRealPythonPath(row.path)) return
    const key = `${row.minor}|${row.path.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(row)
  }

  if (isWin && await hasCommand('py')) {
    for (const flag of ['-0p', '--list-paths']) {
      const r = await run(`py ${flag}`)
      for (const row of parsePyList(r.stdout || r.stderr)) push(row)
      if (found.length) break
    }
  }

  for (const bin of isWin ? ['python', 'python3'] : ['python3', 'python']) {
    if (!(await hasCommand(bin))) continue
    const version = await readVersion(bin)
    if (!version) continue
    const which = await run(isWin ? `where ${bin}` : `command -v ${bin}`)
    const path = (which.stdout || '').trim().split(/\r?\n/).find(Boolean) || bin
    const minor = version.split('.').slice(0, 2).join('.')
    push({ minor, version, path, default: found.length === 0 })
  }

  return found.sort((a, b) => String(b.minor).localeCompare(String(a.minor), undefined, { numeric: true }))
}

async function platformInstaller() {
  if (isWin) {
    const ok = await hasCommand('winget')
    return { id: 'winget', ok, label: 'winget' }
  }
  if (isMac) {
    const ok = await hasCommand('brew')
    return { id: 'brew', ok, label: 'Homebrew' }
  }
  return { id: 'shell', ok: true, label: 'shell' }
}

function pythonToolMeta(target, installedRow) {
  const id = pythonId(target.minor)
  return {
    id,
    name: target.name,
    group: 'python-sdk',
    tag: 'SDK Python',
    blurb: installedRow
      ? `Installé${installedRow.default ? ' · défaut (py)' : ''} — ${installedRow.path}`
      : 'Interpréteur CPython officiel, avec pip.',
    kind: 'python',
    minor: target.minor,
    installed: Boolean(installedRow),
    version: installedRow?.version || null,
    path: installedRow?.path || null,
    isDefault: Boolean(installedRow?.default),
    canInstall: Boolean(pickCmd({
      win: target.winget ? wingetInstall(target.winget) : null,
      mac: target.brew ? brewInstall(target.brew) : null,
      linux: null
    })),
    canUninstall: Boolean(installedRow && pickCmd({
      win: target.winget ? wingetUninstall(target.winget) : null,
      mac: target.brew ? brewUninstall(target.brew) : null,
      linux: null
    })),
    canUpdate: Boolean(installedRow && pickCmd({
      win: target.winget ? wingetUpgrade(target.winget) : null,
      mac: target.brew ? brewUpgrade(target.brew) : null,
      linux: null
    }))
  }
}

async function toolStatus(tool) {
  const installed = await hasCommand(tool.detect)
  const version = installed
    ? await readVersion(tool.detect, tool.versionFlag || '--version')
    : null
  return {
    id: tool.id,
    name: tool.name,
    group: tool.group,
    tag: tool.tag,
    blurb: tool.blurb,
    kind: 'tool',
    installed,
    version,
    path: null,
    isDefault: false,
    canInstall: Boolean(!installed && pickCmd(tool.install)),
    canUninstall: Boolean(installed && pickCmd(tool.uninstall)),
    canUpdate: Boolean(installed && pickCmd(tool.update))
  }
}

export async function status() {
  const installer = await platformInstaller()
  const pythons = await detectInstalledPythons()
  const byMinor = new Map()
  for (const row of pythons) {
    const prev = byMinor.get(row.minor)
    if (!prev || (row.default && !prev.default) || (row.version?.length > (prev.version?.length || 0) && !prev.default)) {
      byMinor.set(row.minor, row)
    }
  }

  const pythonTools = PYTHON_TARGETS.map((t) => pythonToolMeta(t, byMinor.get(t.minor)))

  // Versions installées hors catalogue (ex. 3.9) — affichage lecture seule + désinstall si winget match
  for (const [minor, row] of byMinor) {
    if (PYTHON_TARGETS.some((t) => t.minor === minor)) continue
    pythonTools.push({
      id: pythonId(minor),
      name: `Python ${minor}`,
      group: 'python-sdk',
      tag: 'SDK Python',
      blurb: `Détecté hors catalogue — ${row.path}`,
      kind: 'python',
      minor,
      installed: true,
      version: row.version,
      path: row.path,
      isDefault: Boolean(row.default),
      canInstall: false,
      canUninstall: Boolean(pickCmd({
        win: wingetUninstall(`Python.Python.${minor}`),
        mac: null,
        linux: null
      })),
      canUpdate: false
    })
  }

  pythonTools.sort((a, b) => String(b.minor).localeCompare(String(a.minor), undefined, { numeric: true }))

  const tools = await Promise.all(TOOLS.map(toolStatus))

  return {
    platform: platform(),
    installer,
    pythons,
    python: pythonTools,
    tools,
    groups: [
      { id: 'python-sdk', label: 'SDK Python', hint: 'Plusieurs versions peuvent coexister. Sur Windows, le lanceur py choisit la version.' },
      { id: 'python', label: 'Outils Python', hint: 'Utilitaires autour de Python (paquets, lint).' },
      { id: 'runtime', label: 'Runtimes', hint: 'Environnements pour JS, Go, Rust…' },
      { id: 'vcs', label: 'Git & GitHub', hint: 'Outils déjà utilisés par l’atelier pour les dépôts.' }
    ]
  }
}

function resolveTool(id) {
  if (String(id).startsWith('python-')) {
    const minor = String(id).replace(/^python-/, '')
    const target = PYTHON_TARGETS.find((t) => t.minor === minor) || {
      minor,
      name: `Python ${minor}`,
      winget: `Python.Python.${minor}`,
      brew: null
    }
    return {
      id,
      name: target.name,
      install: {
        win: target.winget ? wingetInstall(target.winget) : null,
        mac: target.brew ? brewInstall(target.brew) : null,
        linux: null
      },
      uninstall: {
        win: target.winget ? wingetUninstall(target.winget) : null,
        mac: target.brew ? brewUninstall(target.brew) : null,
        linux: null
      },
      update: {
        win: target.winget ? wingetUpgrade(target.winget) : null,
        mac: target.brew ? brewUpgrade(target.brew) : null,
        linux: null
      }
    }
  }
  return TOOLS.find((t) => t.id === id) || null
}

export function installCommand(id) {
  const t = resolveTool(id)
  if (!t) return null
  return pickCmd(t.install)
}

export function uninstallCommand(id) {
  const t = resolveTool(id)
  if (!t) return null
  return pickCmd(t.uninstall)
}

export function updateCommand(id) {
  const t = resolveTool(id)
  if (!t) return null
  return pickCmd(t.update)
}

export function labelFor(id) {
  const t = resolveTool(id)
  return t?.name || id
}
