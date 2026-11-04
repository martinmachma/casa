import { Plus, Search } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { CATALOG, CATALOG_GROUPS, thumbnailUrl, type CatalogGroup } from '../furniture/catalog'
import { DEVICE_KINDS, type DevicePlacement } from '../devices/kinds'
import { DeviceIcon } from './deviceIcons'
import { NumberField } from './NumberField'
import { Section } from './kit'

/** What to add: a catalog model or a plain box, sizes in metres. */
export type NewPiece = { name: string; width: number; depth: number; height: number; model?: string }

// Smart devices that can be put in by hand; the rest (sockets, blinds…) are fixed in the house's layout.
const DEVICES: { kind: DevicePlacement; name: string }[] = [
  { kind: 'light', name: 'Ceiling light' },
  { kind: 'wall-light', name: 'Wall light' },
]
const DEVICES_GROUP = 'Devices'

type FurniturePanelProps = {
  onAdd: (piece: NewPiece) => void
  /** The device kind the next tap places, if one is picked. */
  placing: DevicePlacement | undefined
  onPlacing: (kind: DevicePlacement | undefined) => void
}

/** Furniture creation shown while editing with nothing selected. */
export const FurniturePanel = ({ onAdd, placing, onPlacing }: FurniturePanelProps) => {
  // Sizes are entered in centimetres, stored in metres.
  const [size, setSize] = useState({ name: 'Box', width: 120, depth: 60, height: 75 })
  const [group, setGroup] = useState<CatalogGroup | typeof DEVICES_GROUP>('Living')
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState(false)
  const groups = useRef<HTMLDivElement>(null)
  // Which ends of the group row have more chips past them, so the edge fades there.
  const [more, setMore] = useState({ start: false, end: false })
  const measure = () => {
    const el = groups.current
    if (!el) return
    setMore({ start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
  }
  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // A search looks through every group.
  const q = query.trim().toLowerCase()
  const entries = CATALOG.filter((e) => (q ? e.name.toLowerCase().includes(q) : e.group === group))
  const devices = DEVICES.filter((d) => (q ? d.name.toLowerCase().includes(q) : group === DEVICES_GROUP))

  return (
    <>
      <Section className="section-flush">
        <label className="search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder={`Search ${CATALOG.length} pieces`}
            aria-label="Search furniture"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div
          className="tabs"
          role="tablist"
          aria-label="Group"
          ref={groups}
          onScroll={measure}
          data-more-start={more.start}
          data-more-end={more.end}
        >
          {CATALOG_GROUPS.map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={!q && group === g}
              onClick={() => {
                setGroup(g)
                setQuery('')
              }}
            >
              {g}
              <span className="num">{CATALOG.filter((e) => e.group === g).length}</span>
            </button>
          ))}
          <button
            role="tab"
            aria-selected={!q && group === DEVICES_GROUP}
            onClick={() => {
              setGroup(DEVICES_GROUP)
              setQuery('')
            }}
          >
            {DEVICES_GROUP}
            <span className="num">{DEVICES.length}</span>
          </button>
        </div>
      </Section>

      <Section>
        {custom && (q || group !== DEVICES_GROUP) && (
          <div className="custom-box">
            <label className="field">
              Name
              <input value={size.name} onChange={(e) => setSize({ ...size, name: e.target.value })} />
            </label>
            <div className="row">
              <NumberField label="Width cm" value={size.width} onCommit={(width) => setSize({ ...size, width })} />
              <NumberField label="Depth cm" value={size.depth} onCommit={(depth) => setSize({ ...size, depth })} />
              <NumberField label="Height cm" value={size.height} onCommit={(height) => setSize({ ...size, height })} />
            </div>
            <button
              className="btn btn-primary btn-block"
              onClick={() =>
                onAdd({
                  name: size.name.trim() || 'Box',
                  width: size.width / 100,
                  depth: size.depth / 100,
                  height: size.height / 100,
                })
              }
            >
              <Plus size={16} />
              Add box
            </button>
          </div>
        )}

        {placing && (
          <p className="hint">
            {placing === 'wall-light'
              ? 'Tap a wall where the light should be mounted.'
              : 'Tap the floor where the light should hang from the ceiling.'}
          </p>
        )}

        <div className="catalog">
          {(q || group !== DEVICES_GROUP) && (
            <button className="catalog-item catalog-custom" aria-expanded={custom} onClick={() => setCustom(!custom)}>
              <Plus size={22} />
              <span>Custom box</span>
            </button>
          )}
          {devices.map((d) => (
            <button
              key={d.kind}
              className="catalog-item"
              aria-pressed={placing === d.kind}
              onClick={() => onPlacing(placing === d.kind ? undefined : d.kind)}
            >
              <span className="device-swatch" style={{ background: DEVICE_KINDS.light.color }}>
                <DeviceIcon kind="light" size={18} />
              </span>
              <span>{d.name}</span>
            </button>
          ))}
          {entries.map((e) => (
            <button
              key={e.model}
              className="catalog-item"
              onClick={() =>
                onAdd({
                  name: e.name,
                  model: e.model,
                  width: e.width / 100,
                  depth: e.depth / 100,
                  height: e.height / 100,
                })
              }
            >
              <img src={thumbnailUrl(e.model)} alt="" loading="lazy" />
              <span>{e.name}</span>
              <span className="catalog-size">
                {e.width} × {e.depth}
              </span>
            </button>
          ))}
        </div>
      </Section>
    </>
  )
}
