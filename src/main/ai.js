/**
 * Passerelle IA : Ollama, LM Studio, tout endpoint compatible OpenAI
 * (Groq, xAI/Grok, OpenRouter, Together…) et Anthropic.
 * Le streaming est renvoyé au renderer par événements.
 */

export const PROVIDERS = {
  ollama: { label: 'Ollama (local)', baseUrl: 'http://localhost:11434', kind: 'ollama', needsKey: false },
  lmstudio: { label: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', kind: 'openai', needsKey: false },
  anthropic: { label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com', kind: 'anthropic', needsKey: true },
  xai: { label: 'Grok (xAI)', baseUrl: 'https://api.x.ai/v1', kind: 'openai', needsKey: true },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', kind: 'openai', needsKey: true },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', kind: 'openai', needsKey: true },
  custom: { label: 'Endpoint compatible OpenAI', baseUrl: 'http://localhost:8080/v1', kind: 'openai', needsKey: false }
}

const kindOf = (p) => PROVIDERS[p]?.kind ?? 'openai'
const trim = (u) => String(u || '').replace(/\/+$/, '')

export async function listModels(cfg) {
  const kind = kindOf(cfg.provider)
  try {
    if (kind === 'ollama') {
      const r = await fetch(`${trim(cfg.baseUrl)}/api/tags`)
      const j = await r.json()
      return (j.models || []).map((m) => m.name)
    }
    if (kind === 'anthropic') {
      const r = await fetch(`${trim(cfg.baseUrl)}/v1/models`, {
        headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' }
      })
      const j = await r.json()
      return (j.data || []).map((m) => m.id)
    }
    const r = await fetch(`${trim(cfg.baseUrl)}/models`, {
      headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}
    })
    const j = await r.json()
    return (j.data || []).map((m) => m.id)
  } catch (e) {
    throw new Error(`Modèles introuvables : ${e.message}`)
  }
}

async function* sseLines(res) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) yield line.trim()
  }
  if (buf.trim()) yield buf.trim()
}

/**
 * @param {object} cfg  { provider, baseUrl, apiKey, model, temperature }
 * @param {Array}  messages [{role, content}]
 * @param {string} system
 * @param {(delta:string)=>void} onDelta
 * @param {AbortSignal} signal
 */
export async function chat(cfg, messages, system, onDelta, signal) {
  const kind = kindOf(cfg.provider)
  const base = trim(cfg.baseUrl)

  if (kind === 'ollama') {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        options: { temperature: cfg.temperature ?? 0.4 },
        messages: [{ role: 'system', content: system }, ...messages]
      })
    })
    if (!res.ok) throw new Error(`Ollama ${res.status} — ${await res.text()}`)
    for await (const line of sseLines(res)) {
      try {
        const j = JSON.parse(line)
        if (j.message?.content) onDelta(j.message.content)
      } catch { /* ligne partielle */ }
    }
    return
  }

  if (kind === 'anthropic') {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 4096,
        temperature: cfg.temperature ?? 0.4,
        system,
        stream: true,
        messages
      })
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status} — ${await res.text()}`)
    for await (const line of sseLines(res)) {
      if (!line.startsWith('data:')) continue
      try {
        const j = JSON.parse(line.slice(5).trim())
        if (j.type === 'content_block_delta' && j.delta?.text) onDelta(j.delta.text)
      } catch { /* ignore */ }
    }
    return
  }

  // OpenAI compatible : LM Studio, xAI, OpenRouter, llama.cpp…
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: cfg.model,
      stream: true,
      temperature: cfg.temperature ?? 0.4,
      messages: [{ role: 'system', content: system }, ...messages]
    })
  })
  if (!res.ok) throw new Error(`${cfg.provider} ${res.status} — ${await res.text()}`)
  for await (const line of sseLines(res)) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (data === '[DONE]') break
    try {
      const j = JSON.parse(data)
      const d = j.choices?.[0]?.delta?.content
      if (d) onDelta(d)
    } catch { /* ignore */ }
  }
}
