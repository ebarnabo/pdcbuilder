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
  if (prev && prev.line === line && at - prev.at < 150) return
  lastLog.set(projectId, { line, at })
  send(win, 'proc:log', { projectId, line, kind, at })
}

export function log(win, projectId, line, kind = 'out') {
  emitLog(win, projectId, line, kind)
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
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        CI: '1',
        ADBLOCK: '1',
        GH_PROMPT_DISABLED: '1',
        GIT_TERMINAL_PROMPT: '0'
      },
      detached: !isWin
    })

    let stdout = ''
    let stderr = ''
    const pipe = (stream, kind) => {
      let buffer = ''
      stream.on('data', (chunk) => {
        const text = chunk.toString()
        if (kind === 'out') stdout += text
        else stderr += text
        buffer += text
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        lines.filter((l) => cleanLine(l)).forEach((l) => emitLog(win, projectId, l, kind))
      })
      stream.on('end', () => { if (cleanLine(buffer)) emitLog(win, projectId, buffer, kind) })
    }
    pipe(child.stdout, 'out')
    pipe(child.stderr, 'err')

    child.on('error', (e) => {
      log(win, projectId, e.message, 'err')
      resolve({ ok: false, code: -1, stdout, stderr: e.message })
    })
    child.on('close', (code) => {
      log(win, projectId, code === 0 ? '✓ terminé' : `✕ code ${code}`, code === 0 ? 'ok' : 'err')
      resolve({ ok: code === 0, code, stdout, stderr })
    })
  })
}

export function startDev(win, project, command) {
  stopDev(project.id)
  lastLog.delete(project.id)
  log(win, project.id, `▸ serveur de dev`, 'meta')
  log(win, project.id, `$ ${command}`, 'cmd')

  const child = spawn(command, {
    cwd: project.path,
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      CI: '1',
      BROWSER: 'none'
    },
    detached: !isWin
  })

  const entry = { child, url: null }
  running.set(project.id, entry)

  const scan = (chunk, kind) => {
    const text = chunk.toString()
    text.split(/\r?\n/).filter((l) => cleanLine(l)).forEach((l) => emitLog(win, project.id, l, kind))
    if (!entry.url) {
      const url = extractUrl(text)
      if (url) {
        entry.url = url
        send(win, 'proc:state', { projectId: project.id, status: 'running', url: entry.url })
        emitLog(win, project.id, `▸ serveur prêt : ${url}`, 'ok')
      }
    }
  }
  child.stdout.on('data', (c) => scan(c, 'out'))
  child.stderr.on('data', (c) => scan(c, 'err'))

  child.on('close', (code) => {
    running.delete(project.id)
    lastLog.delete(project.id)
    log(win, project.id, `serveur arrêté (code ${code})`, code === 0 ? 'meta' : 'err')
    send(win, 'proc:state', { projectId: project.id, status: 'stopped', url: null })
  })

  send(win, 'proc:state', { projectId: project.id, status: 'starting', url: null })
  return { ok: true }
}

export function stopDev(projectId) {
  const entry = running.get(projectId)
  if (!entry) return { ok: false }
  const pid = entry.child.pid
  try {
    if (isWin) spawn('taskkill', ['/pid', String(pid), '/T', '/F'])
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
