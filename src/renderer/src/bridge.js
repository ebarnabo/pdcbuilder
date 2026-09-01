/** Accès au pont preload, lu à l’appel — pas à l’import (course ESM Electron). */
export const api = new Proxy({}, {
  get(_target, key) {
    const pdc = window.pdc
    if (!pdc) throw new Error('Pont Electron indisponible.')
    const value = pdc[key]
    return typeof value === 'function' ? value.bind(pdc) : value
  }
})

export function waitForApi(ms = 4000) {
  if (window.pdc) return Promise.resolve(window.pdc)
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = setInterval(() => {
      if (window.pdc) { clearInterval(tick); resolve(window.pdc) }
      else if (Date.now() - start > ms) {
        clearInterval(tick)
        reject(new Error('Le pont Electron n’est pas disponible (preload).'))
      }
    }, 40)
  })
}
