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
const raw = read()
const requested = new Set(raw.split(','))
const off = new Set<Flag>(requested.has('safe') ? FLAGS : FLAGS.filter((f) => requested.has(f)))
if (off.size) console.info('Casa graphics switched off:', [...off].join(', '))

export const gfxOff = (flag: Flag) => off.has(flag)

/** Leaves the house out altogether, to tell whether the 3D view is what freezes a machine at all. */
export const gfxNoHouse = requested.has('nohouse')

/** For a label on screen whenever ?gfx= is given ('' otherwise); the build shows a page an old service worker kept. */
export const gfxLabel = raw
  ? [`Build ${__BUILD__}`, gfxNoHouse && 'house left out', off.size && `graphics off: ${[...off].join(', ')}`]
      .filter(Boolean)
      .join(' · ')
  : ''
