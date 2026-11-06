import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { CATALOG, CATALOG_GROUPS, thumbnailUrl, type CatalogGroup } from '../furniture/catalog'
import { NumberField } from './NumberField'
import { IconButton, Section } from './kit'

/** What to add: a catalog model or a plain box, sizes in metres. */
export type NewPiece = { name: string; width: number; depth: number; height: number; model?: string }

/** What the panel's chips pick: a group of the catalog, or the house's lights. */
export type PanelGroup = CatalogGroup | 'Lights'

type FurniturePanelProps = {
  onAdd: (piece: NewPiece) => void
  group: PanelGroup
  onGroup: (group: PanelGroup) => void
  /** The Lights group's own contents. */
  lights: ReactNode
  /** The lights matching a search. */
  foundLights: (query: string) => ReactNode
}

/** The catalog and the lights, shown in Interior with nothing selected. */
export const FurniturePanel = ({ onAdd, group, onGroup, lights, foundLights }: FurniturePanelProps) => {
  // Sizes are entered in centimetres, stored in metres.
  const [size, setSize] = useState({ name: 'Box', width: 120, depth: 60, height: 75 })
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState(false)
  const groups = useRef<HTMLDivElement>(null)
  // Which ends of the group row have more chips past them, so the edge fades and shows an arrow there.
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
  const slide = (direction: 1 | -1) =>
    groups.current?.scrollBy({ left: (direction * groups.current.clientWidth) / 2, behavior: 'smooth' })

  // A search looks through every group.
  const q = query.trim().toLowerCase()
  const entries = CATALOG.filter((e) => (q ? e.name.toLowerCase().includes(q) : e.group === group))

  return (
    <>
      <Section className="catalog-head">
        <label className="search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder="Search furniture and lights"
            aria-label="Search furniture and lights"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="tabs-wrap">
          <div
            className="tabs"
            role="tablist"
            aria-label="Group"
            ref={groups}
            onScroll={measure}
            data-more-start={more.start}
            data-more-end={more.end}
          >
            {(['Lights', ...CATALOG_GROUPS] as const).map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={!q && group === g}
                onClick={() => {
                  onGroup(g)
                  setQuery('')
                }}
              >
                {g}
                {g !== 'Lights' && <span className="num">{CATALOG.filter((e) => e.group === g).length}</span>}
              </button>
            ))}
          </div>
          {more.start && (
            <IconButton label="Earlier groups" className="side-arrow side-arrow-back" onClick={() => slide(-1)}>
              <ChevronLeft size={16} />
            </IconButton>
          )}
          {more.end && (
            <IconButton label="Later groups" className="side-arrow" onClick={() => slide(1)}>
              <ChevronRight size={16} />
            </IconButton>
          )}
        </div>
      </Section>

      <div className="catalog-body">
        {!q && group === 'Lights' ? (
          lights
        ) : (
          <Section>
            {custom && (
              <div className="custom-box">
                <label className="field">
                  Name
                  <input value={size.name} onChange={(e) => setSize({ ...size, name: e.target.value })} />
                </label>
                <div className="row">
                  <NumberField label="Width cm" value={size.width} onCommit={(width) => setSize({ ...size, width })} />
                  <NumberField label="Depth cm" value={size.depth} onCommit={(depth) => setSize({ ...size, depth })} />
                  <NumberField
                    label="Height cm"
                    value={size.height}
                    onCommit={(height) => setSize({ ...size, height })}
                  />
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

            <div className="catalog">
              <button className="catalog-item catalog-custom" aria-expanded={custom} onClick={() => setCustom(!custom)}>
                <Plus size={22} />
                <span>Custom box</span>
              </button>
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
        )}
        {q && foundLights(q)}
      </div>
    </>
  )
}
