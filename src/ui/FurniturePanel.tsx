import { Lightbulb, Plus, Search, Sofa } from 'lucide-react'
import { useState } from 'react'
import { CATALOG, CATALOG_GROUPS, thumbnailUrl, type CatalogGroup } from '../furniture/catalog'
import type { Interaction } from '../scene/selection'
import { NumberField } from './NumberField'
import { Section, Segmented } from './kit'

/** What to add: a catalog model or a plain box, sizes in metres. */
export type NewPiece = { name: string; width: number; depth: number; height: number; model?: string }

/** Furniture or devices: what the panel adds while nothing is selected. */
export const PlanTabs = ({ value, onChange }: { value: Interaction; onChange: (tool: Interaction) => void }) => (
  <Section>
    <Segmented
      label="Add"
      block
      className="plan-tabs"
      value={value}
      onChange={onChange}
      options={[
        { value: 'edit', label: 'Furniture', icon: <Sofa size={16} /> },
        { value: 'devices', label: 'Devices (L)', icon: <Lightbulb size={16} /> },
      ]}
    />
  </Section>
)

type FurniturePanelProps = {
  onTool: (tool: Interaction) => void
  onAdd: (piece: NewPiece) => void
}

/** Furniture creation shown while editing with nothing selected. */
export const FurniturePanel = ({ onTool, onAdd }: FurniturePanelProps) => {
  // Sizes are entered in centimetres, stored in metres.
  const [size, setSize] = useState({ name: 'Box', width: 120, depth: 60, height: 75 })
  const [group, setGroup] = useState<CatalogGroup>('Living')
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState(false)

  // A search looks through every group.
  const q = query.trim().toLowerCase()
  const entries = CATALOG.filter((e) => (q ? e.name.toLowerCase().includes(q) : e.group === group))

  return (
    <>
      <PlanTabs value="edit" onChange={onTool} />

      <Section>
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
        <div className="tabs" role="tablist" aria-label="Group">
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
            </button>
          ))}
        </div>
      </Section>

      <Section title={q ? 'Results' : group} aside={<span className="muted num">{entries.length}</span>}>
        <div className="catalog">
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
          <button className="catalog-item catalog-custom" aria-expanded={custom} onClick={() => setCustom(!custom)}>
            <Plus size={22} />
            <span>Custom box</span>
          </button>
        </div>

        {custom && (
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
      </Section>
    </>
  )
}
