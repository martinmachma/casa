// The app was called Casa; what a browser saved under `casa.` moves to `nest.` once, before anything reads it.
// Imported first in main.tsx. Can go once every device has opened Nest at least once.
try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('casa.')) continue
    const renamed = `nest.${key.slice('casa.'.length)}`
    const value = localStorage.getItem(key)
    if (value !== null && localStorage.getItem(renamed) === null) localStorage.setItem(renamed, value)
    localStorage.removeItem(key)
  }
} catch {
  // Storage blocked: nothing to carry over.
}
