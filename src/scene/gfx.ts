// `?gfx=` switches parts of the 3D view off, to find which one a machine can't cope with:
// `?gfx=safe` for all of them, or a list such as `?gfx=noshadows,noao`. Kept for the tab through the login redirect;
// `?gfx=` with nothing after it switches everything back on.
const FLAGS = ['compact', 'noshadows', 'nolights', 'noao', 'noblur'] as const
type Flag = (typeof FLAGS)[number]

const KEY = 'casa-gfx'
const read = () => {
  const param = new URLSearchParams(window.location.search).get('gfx')
  try {
    if (param !== null) sessionStorage.setItem(KEY, param)
    return param ?? sessionStorage.getItem(KEY) ?? ''
  } catch {
    return param ?? ''
  }
}
const requested = new Set(read().split(','))
const off = new Set<Flag>(requested.has('safe') ? FLAGS : FLAGS.filter((f) => requested.has(f)))
if (off.size) console.info('Casa graphics switched off:', [...off].join(', '))

export const gfxOff = (flag: Flag) => off.has(flag)

/** What's switched off, for a label on screen ('' when nothing is). */
export const gfxLabel = off.size ? `Graphics off: ${[...off].join(', ')}` : ''
