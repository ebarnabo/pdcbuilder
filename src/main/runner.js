import { spawn } from 'child_process'
import { platform } from 'os'

const isWin = platform() === 'win32'

/** processus longs (serveurs de dev), indexés par id de projet */
const running = new Map()
const lastLog = new Map()

const ANSI_RE = /\u001b\[[0-?]*[ -/]*[@-~]/g
const URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?[^\s"'<>]*/i

function send(win, channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

export function stripAnsi(text) {
  return String(text || '').replace(ANSI_RE, '')
}

function cleanLine(raw) {
  return stripAnsi(raw).replace(/\r/g, '').trimEnd()
}

function extractUrl(text) {
  const clean = stripAnsi(text)
  const m = clean.match(URL_RE)
  if (!m) return null
  return m[0].replace(/[),.]+$/, '')
}

function emitLog(win, projectId, raw, kind = 'out') {
  const line = cleanLine(raw)
  if (!line) return
  const prev = lastLog.get(projectId)
  const at = Date.now()
  // Anti-spam seulement pour les lignes progress répétées à l’identique
  if (prev && prev.line === line && at - prev.at < 80) return
  lastLog.set(projectId, { line, at })
  send(win, 'proc:log', { projectId, line, kind, at })
}

export function log(win, projectId, line, kind = 'out') {
  emitLog(win, projectId, line, kind)
}

/**
 * Découpe stdout/stderr en lignes, y compris les progress Vite/npm qui utilisent `\r`.
 */
function attachStreams(child, win, projectId, { onChunk } = {}) {
  const buffers = { out: '', err: '' }

  const push = (kind, chunk) => {
    const text = chunk.toString()
    onChunk?.(text, kind)
    // \r\n | \n | \r seul (barres de progression)
    let buffer = buffers[kind] + text
    const parts = buffer.split(/\r?\n|\r/)
    buffers[kind] = parts.pop() ?? ''
    for (const part of parts) {
      if (cleanLine(part)) emitLog(win, projectId, part, kind)
    }
  }

  const flush = () => {
    for (const kind of ['out', 'err']) {
      if (cleanLine(buffers[kind])) emitLog(win, projectId, buffers[kind], kind)
      buffers[kind] = ''
    }
  }

  if (child.stdout) child.stdout.on('data', (c) => push('out', c))
  else log(win, projectId, '▸ stdout indisponible', 'meta')
  if (child.stderr) child.stderr.on('data', (c) => push('err', c))
  else log(win, projectId, '▸ stderr indisponible', 'meta')

  return { flush }
}

function spawnEnv(extra = {}) {
  return {
    ...process.env,
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    // Ne pas forcer CI=1 : certains outils réduisent alors leur sortie
    ADBLOCK: '1',
    GH_PROMPT_DISABLED: '1',
    GIT_TERMINAL_PROMPT: '0',
    ...extra
  }
}

/**
 * Exécute une commande et résout à la fin. Diffuse la sortie ligne par ligne.
 */
export function exec(win, projectId, command, cwd, label = '') {
  return new Promise((resolve) => {
    if (label) log(win, projectId, `▸ ${label}`, 'meta')
    log(win, projectId, `$ ${command}`, 'cmd')

    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: spawnEnv({ CI: '1' }),
      detached: !isWin
    })

    let stdout = ''
    let stderr = ''
    const { flush } = attachStreams(child, win, projectId, {
      onChunk: (text, kind) => {
        if (kind === 'out') stdout += text
        else stderr += text
      }
    })

    child.on('error', (e) => {
      flush()
      log(win, projectId, e.message, 'err')
      resolve({ ok: false, code: -1, stdout, stderr: e.message })
    })
    child.on('close', (code) => {
      flush()
      log(win, projectId, code === 0 ? '✓ terminé' : `✕ code ${code}`, code === 0 ? 'ok' : 'err')
      resolve({ ok: code === 0, code, stdout, stderr })
    })
  })
}

export function startDev(win, project, command) {
  stopDev(project.id)
  lastLog.delete(project.id)
  log(win, project.id, `▸ serveur de dev — ${project.name || project.id}`, 'meta')
  log(win, project.id, `▸ cwd ${project.path}`, 'meta')
  log(win, project.id, `$ ${command}`, 'cmd')

  const child = spawn(command, {
    cwd: project.path,
    shell: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: spawnEnv({ BROWSER: 'none' }),
    detached: !isWin
  })

  const entry = { child, url: null, flush: null }
  running.set(project.id, entry)

  const { flush } = attachStreams(child, win, project.id, {
    onChunk: (text) => {
      if (!entry.url) {
        const url = extractUrl(text)
        if (url) {
          entry.url = url
          send(win, 'proc:state', { projectId: project.id, status: 'running', url: entry.url })
          emitLog(win, project.id, `▸ serveur prêt : ${url}`, 'ok')
        }
      }
    }
  })
  entry.flush = flush

  child.on('error', (e) => {
    flush()
    running.delete(project.id)
    log(win, project.id, `▸ échec démarrage : ${e.message}`, 'err')
    send(win, 'proc:state', { projectId: project.id, status: 'error', url: null })
  })

  child.on('close', (code) => {
    flush()
    running.delete(project.id)
    lastLog.delete(project.id)
    log(win, project.id, `▸ serveur arrêté (code ${code ?? '?'})`, code === 0 || code == null ? 'meta' : 'err')
    send(win, 'proc:state', { projectId: project.id, status: 'stopped', url: null })
  })

  send(win, 'proc:state', { projectId: project.id, status: 'starting', url: null })
  return { ok: true }
}

export function stopDev(projectId) {
  const entry = running.get(projectId)
  if (!entry) return { ok: false }
  try { entry.flush?.() } catch { /* ignore */ }
  const pid = entry.child.pid
  try {
    if (isWin) spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
    else process.kill(-pid, 'SIGTERM')
  } catch {
    try { entry.child.kill('SIGKILL') } catch { /* ignore */ }
  }
  running.delete(projectId)
  lastLog.delete(projectId)
  return { ok: true, projectId }
}

export function listRunning() {
  return [...running.entries()].map(([projectId, entry]) => ({
    projectId,
    status: entry.url ? 'running' : 'starting',
    url: entry.url || null
  }))
}

export function devState(projectId) {
  const entry = running.get(projectId)
  return entry ? { status: entry.url ? 'running' : 'starting', url: entry.url || null } : { status: 'stopped', url: null }
}

export function stopAll() {
  const ids = [...running.keys()]
  ids.forEach(stopDev)
  return { ok: true, stopped: ids }
}
