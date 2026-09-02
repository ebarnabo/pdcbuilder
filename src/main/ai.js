/**
 * Passerelle IA : Ollama, LM Studio, tout endpoint compatible OpenAI
 * (Groq, xAI/Grok, OpenRouter, Together…) et Anthropic.
 * Le streaming est renvoyé au renderer par événements.
 */

export const PROVIDERS = {
  ollama: {
    label: 'Ollama (local)', baseUrl: 'http://localhost:11434', kind: 'ollama', needsKey: false,
    scores: {
      perf: { n: 3, note: 'Ça dépend de ta machine. Un petit modèle reste fluide.' },
      free: { n: 5, note: 'Gratuit, hors ligne, aucune clé.' },
      paid: { n: 2, note: 'Pas de facture API. Tu paies le GPU / le courant.' },
      exit: { n: 1, note: 'Jamais de plafond vendor. La limite, c’est le hardware.' }
    }
  },
  lmstudio: {
    label: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', kind: 'openai', needsKey: false,
    scores: {
      perf: { n: 3, note: 'Comme Ollama : lié à ta carte graphique.' },
      free: { n: 5, note: 'App gratuite, modèles locaux.' },
      paid: { n: 2, note: 'Pas d’API payante. Hardware only.' },
      exit: { n: 1, note: 'Tu restes en local.' }
    }
  },
  anthropic: {
    label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com', kind: 'anthropic', needsKey: true,
    scores: {
      perf: { n: 5, note: 'Très bon sur le code long et les specs.' },
      free: { n: 2, note: 'Crédit d’essai mince. Ensuite, c’est payant.' },
      paid: { n: 5, note: 'API à l’usage. Fort, prévisible.' },
      exit: { n: 5, note: 'Le free part en quelques essais.' }
    }
  },
  xai: {
    label: 'Grok (xAI)', baseUrl: 'https://api.x.ai/v1', kind: 'openai', needsKey: true,
    scores: {
      perf: { n: 4, note: 'Rapide. Qualité selon le modèle.' },
      free: { n: 2, note: 'Peu ou pas de free API.' },
      paid: { n: 4, note: 'À l’usage, souvent moins cher qu’OpenAI.' },
      exit: { n: 4, note: 'Tu paies dès les premiers appels sérieux.' }
    }
  },
  openai: {
    label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', kind: 'openai', needsKey: true,
    scores: {
      perf: { n: 5, note: 'Référence. GPT fort, écosystème large.' },
      free: { n: 2, note: 'Crédit de départ, vite consommé.' },
      paid: { n: 5, note: 'À l’usage, jusqu’à l’entreprise.' },
      exit: { n: 5, note: 'Le free ne tient pas un vrai flux de code.' }
    }
  },
  openrouter: {
    label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', kind: 'openai', needsKey: true,
    scores: {
      perf: { n: 4, note: 'Variable : tu choisis le modèle derrière.' },
      free: { n: 3, note: 'Quelques modèles :free. Le reste est payant.' },
      paid: { n: 4, note: 'Crédit unique, tous les fournisseurs.' },
      exit: { n: 3, note: 'Les :free suffisent à tester. La prod passe au crédit.' }
    }
  },
  custom: {
    label: 'Endpoint compatible OpenAI', baseUrl: 'http://localhost:8080/v1', kind: 'openai', needsKey: false,
    scores: {
      perf: { n: 3, note: 'Ça dépend de ce que tu branches.' },
      free: { n: 4, note: 'Souvent un serveur à toi.' },
      paid: { n: 3, note: 'Selon l’hôte derrière l’URL.' },
      exit: { n: 2, note: 'Toi qui fixes les limites.' }
    }
  }
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
