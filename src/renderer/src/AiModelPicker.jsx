import { useEffect, useRef, useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { api } from './bridge.js'

/**
 * Sélecteur de modèle dans la topbar — visible seulement si le provider
 * répond avec au moins un modèle (IA « qui marche »).
 */
export default function AiModelPicker({ ai, providers, onPick, toast }) {
  const [models, setModels] = useState([])
  const [checking, setChecking] = useState(false)
  const [ok, setOk] = useState(false)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    let cancelled = false
    let timer

    const load = async (silent = true) => {
      const meta = providers?.[ai?.provider]
      if (!ai?.provider || !ai?.baseUrl) {
        if (!cancelled) { setModels([]); setOk(false) }
        return
      }
      if (meta?.needsKey && !String(ai.apiKey || '').trim()) {
        if (!cancelled) { setModels([]); setOk(false) }
        return
      }
      if (!silent) setChecking(true)
      try {
        const r = await api.ai.models({
          provider: ai.provider,
          baseUrl: ai.baseUrl,
          apiKey: ai.apiKey
        })
        if (cancelled) return
        if (Array.isArray(r) && r.length) {
          const list = ai.model && !r.includes(ai.model) ? [ai.model, ...r] : r
          setModels(list)
          setOk(true)
          if (!ai.model) onPickRef.current?.(r[0])
        } else {
          setModels([])
          setOk(false)
          if (!silent && r?.error) toast?.(r.error, true)
        }
      } catch (e) {
        if (!cancelled) {
          setModels([])
          setOk(false)
          if (!silent) toast?.(e.message || 'Modèles introuvables', true)
        }
      } finally {
        if (!cancelled && !silent) setChecking(false)
      }
    }

    load(true)
    timer = setInterval(() => load(true), 45_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [ai?.provider, ai?.baseUrl, ai?.apiKey, ai?.model, providers, toast])

  if (!ok || !models.length) return null

  const label = providers?.[ai.provider]?.label || ai.provider
  const value = models.includes(ai.model) ? ai.model : models[0]

  return (
    <div className="topbar-ai" title={`${label} · ${models.length} modèle${models.length > 1 ? 's' : ''}`}>
      <Sparkles size={14} strokeWidth={1.8} aria-hidden />
      <select
        className="topbar-ai-select"
        value={value}
        aria-label="Modèle d’IA"
        onChange={(e) => onPick?.(e.target.value)}
      >
        {models.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <button
        type="button"
        className="topbar-ai-refresh"
        aria-label="Actualiser les modèles"
        disabled={checking}
        onClick={async () => {
          setChecking(true)
          try {
            const r = await api.ai.models({
              provider: ai.provider,
              baseUrl: ai.baseUrl,
              apiKey: ai.apiKey
            })
            if (Array.isArray(r) && r.length) {
              setModels(ai.model && !r.includes(ai.model) ? [ai.model, ...r] : r)
              setOk(true)
              toast?.(`${r.length} modèle${r.length > 1 ? 's' : ''} · ${label}`)
            } else {
              setModels([])
              setOk(false)
              toast?.(r?.error || 'Aucun modèle', true)
            }
          } catch (e) {
            toast?.(e.message, true)
          } finally {
            setChecking(false)
          }
        }}
      >
        <RefreshCw size={12} className={checking ? 'spin' : ''} />
      </button>
    </div>
  )
}
