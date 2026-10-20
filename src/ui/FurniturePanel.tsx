import { Plus } from 'lucide-react'
import { useState } from 'react'
import { CATALOG, CATALOG_GROUPS, thumbnailUrl, type CatalogGroup } from '../furniture/catalog'
import { NumberField } from './NumberField'
import { Section, Switch } from './kit'

/** What to add: a catalog model or a plain box, sizes in metres. */
export type NewPiece = { name: string; width: number; depth: number; height: number; model?: string }

type FurniturePanelProps = {
  snap: boolean
  onSnap: (snap: boolean) => void
  onAdd: (piece: NewPiece) => void
}

/** Furniture creation and snapping controls shown while editing with nothing selected. */
export const FurniturePanel = ({ snap, onSnap, onAdd }: FurniturePanelProps) => {
  // Sizes are entered in centimetres, stored in metres.
  const [size, setSize] = useState({ name: 'Box', width: 120, depth: 60, height: 75 })
  const [group, setGroup] = useState<CatalogGroup | 'Box'>('Living')

  return (
    <>
      <Section title="Snapping">
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
