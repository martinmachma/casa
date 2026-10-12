import { useState } from 'react'
import type { FurnitureItem } from '../data/types'
import { CATALOG, CATALOG_GROUPS, thumbnailUrl, type CatalogGroup } from '../furniture/catalog'
import { NumberField } from './NumberField'

/** What to add: a catalog model or a plain box, sizes in metres. */
export type NewPiece = { name: string; width: number; depth: number; height: number; model?: string }

type FurniturePanelProps = {
  floorName: string
  items: FurnitureItem[]
  snap: boolean
  onSnap: (snap: boolean) => void
  onAdd: (piece: NewPiece) => void
  onSelect: (id: string) => void
  onClose: () => void
}

const cm = (m: number) => Math.round(m * 100)

export const FurniturePanel = ({ floorName, items, snap, onSnap, onAdd, onSelect, onClose }: FurniturePanelProps) => {
  // Sizes are entered in centimetres, stored in metres.
  const [size, setSize] = useState({ name: 'Box', width: 120, depth: 60, height: 75 })
  const [group, setGroup] = useState<CatalogGroup | 'Box'>('Living')

  return (
    <section className="panel" aria-label="Furniture">
      <div className="panel-head">
        <h2>Furniture · {floorName}</h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {items.length > 0 ? (
        <ul className="item-list">
          {items.map((item) => (
            <li key={item.id}>
              <button onClick={() => onSelect(item.id)}>
                <span className="dot" style={{ background: item.color }} />
                <span>{item.name}</span>
                <span className="spacer" />
                <span className="muted">
                  {cm(item.width)}×{cm(item.depth)}×{cm(item.height)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Nothing on this floor yet. Tap a piece below to add it.</p>
      )}

      <div className="tabs" role="tablist" aria-label="Add">
        {[...CATALOG_GROUPS, 'Box' as const].map((g) => (
          <button key={g} role="tab" aria-selected={group === g} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>

      {group === 'Box' ? (
        <>
          <div className="row">
            <label className="field">
              Name
              <input value={size.name} onChange={(e) => setSize({ ...size, name: e.target.value })} />
            </label>
          </div>
          <div className="row">
            <NumberField label="Width cm" value={size.width} onCommit={(width) => setSize({ ...size, width })} />
            <NumberField label="Depth cm" value={size.depth} onCommit={(depth) => setSize({ ...size, depth })} />
            <NumberField label="Height cm" value={size.height} onCommit={(height) => setSize({ ...size, height })} />
          </div>
          <button
            className="btn btn-primary"
            onClick={() =>
              onAdd({
                name: size.name.trim() || 'Box',
                width: size.width / 100,
                depth: size.depth / 100,
                height: size.height / 100,
              })
            }
          >
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

      <label className="check">
        <input type="checkbox" checked={snap} onChange={(e) => onSnap(e.target.checked)} />
        Snap to walls while dragging
      </label>
    </section>
  )
}
