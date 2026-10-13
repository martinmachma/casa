import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { FurnitureItem } from '../data/types'
import { CATALOG, CATALOG_GROUPS, thumbnailUrl, type CatalogGroup } from '../furniture/catalog'
import { NumberField } from './NumberField'
import { Section, Switch } from './kit'

/** What to add: a catalog model or a plain box, sizes in metres. */
export type NewPiece = { name: string; width: number; depth: number; height: number; model?: string }

type FurniturePanelProps = {
  items: FurnitureItem[]
  snap: boolean
  onSnap: (snap: boolean) => void
  onAdd: (piece: NewPiece) => void
  onSelect: (id: string) => void
}

const cm = (m: number) => Math.round(m * 100)

/** What the right panel shows while editing with nothing selected: what's on the floor, and what can be added. */
export const FurniturePanel = ({ items, snap, onSnap, onAdd, onSelect }: FurniturePanelProps) => {
  // Sizes are entered in centimetres, stored in metres.
  const [size, setSize] = useState({ name: 'Box', width: 120, depth: 60, height: 75 })
  const [group, setGroup] = useState<CatalogGroup | 'Box'>('Living')

  return (
    <>
      <Section>
        <p className="hint">Tap a wall to paint it, a floor to change its finish, or add furniture below.</p>
      </Section>

      <Section title="On this floor" aside={<span className="muted num">{items.length}</span>}>
        {items.length > 0 ? (
          <ul className="item-list">
            {items.map((item) => (
              <li key={item.id}>
                <button onClick={() => onSelect(item.id)}>
                  <span className="dot" style={{ background: item.color }} />
                  <span className="item-name">{item.name}</span>
                  <span className="item-size">
                    {cm(item.width)}×{cm(item.depth)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Nothing here yet. Pick a piece below and it appears in the biggest room.</p>
        )}
        <Switch label="Snap to walls while dragging" checked={snap} onChange={onSnap} />
      </Section>

      <Section title="Add furniture">
        <div className="tabs" role="tablist" aria-label="Add">
          {[...CATALOG_GROUPS, 'Box' as const].map((g) => (
            <button key={g} role="tab" aria-selected={group === g} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>

        {group === 'Box' ? (
          <>
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
          </>
        ) : (
          <div className="catalog">
            {CATALOG.filter((e) => e.group === group).map((e) => (
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
              </button>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
