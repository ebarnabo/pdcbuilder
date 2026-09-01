import { spawn } from 'child_process'
import { platform } from 'os'

const isWin = platform() === 'win32'

/** processus longs (serveurs de dev), indexés par id de projet */
const running = new Map()

function send(win, channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

export function log(win, projectId, line, kind = 'out') {
  send(win, 'proc:log', { projectId, line: String(line), kind, at: Date.now() })
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
      env: { ...process.env, FORCE_COLOR: '0', CI: '1', ADBLOCK: '1', GH_PROMPT_DISABLED: '1' },
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
        lines.filter(Boolean).forEach((l) => log(win, projectId, l, kind))
      })
      stream.on('end', () => { if (buffer.trim()) log(win, projectId, buffer, kind) })
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

const URL_RE = /(https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+[^\s"']*)/i

export function startDev(win, project, command) {
  stopDev(project.id)
  log(win, project.id, `▸ serveur de dev`, 'meta')
  log(win, project.id, `$ ${command}`, 'cmd')

  const child = spawn(command, {
    cwd: project.path,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '0', BROWSER: 'none' },
    detached: !isWin
  })

  const entry = { child, url: null }
  running.set(project.id, entry)

  const scan = (chunk, kind) => {
    const text = chunk.toString()
    text.split(/\r?\n/).filter(Boolean).forEach((l) => log(win, project.id, l, kind))
    if (!entry.url) {
      const m = text.match(URL_RE)
      if (m) {
        entry.url = m[1].replace(/[),.]+$/, '')
        send(win, 'proc:state', { projectId: project.id, status: 'running', url: entry.url })
      }
    }
  }
  child.stdout.on('data', (c) => scan(c, 'out'))
  child.stderr.on('data', (c) => scan(c, 'err'))

  child.on('close', (code) => {
    running.delete(project.id)
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
  return { ok: true }
}

export function devState(projectId) {
  const entry = running.get(projectId)
  return entry ? { status: 'running', url: entry.url } : { status: 'stopped', url: null }
}

export function stopAll() {
  ;[...running.keys()].forEach(stopDev)
}
