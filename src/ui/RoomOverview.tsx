import { X } from 'lucide-react'
import { type RefObject } from 'react'
import { DEVICE_KINDS } from '../devices/kinds'
import type { LightState } from '../devices/lights'
import type { SmartItem } from '../rooms/roomItems'
import { IconButton } from './kit'
import { LightControls } from './LightControls'
import { SmartCard, SmartRow, SmartTag, TagLine } from './SmartList'
import { itemState, KIND_GROUPS, lightsSummary } from './smartText'

type RoomOverviewProps = {
  title: string
  items: SmartItem[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  open: string | undefined
  onOpen: (id: string | undefined) => void
  /** The item whose card is pointed at, picked out in the view like the open one. */
  onHover: (id: string | undefined) => void
  /** The item pointed at, here or in the view; its tag shows its name. */
  hovered: string | undefined
  /** The open item's popover, moved over its item every frame. */
  pinRefs: RefObject<Map<string, HTMLElement | null>>
}

// Every light in the room at once, as a chip under the card's title.
const SCENES: { label: string; set: Pick<LightState, 'brightness' | 'kelvin'> }[] = [
  { label: 'Bright', set: { brightness: 1, kelvin: 4000 } },
  { label: 'Relax', set: { brightness: 0.4, kelvin: 2700 } },
]

/** The room's own view: its name over the middle, what's in it on the right, and a popover by the item picked. */
export const RoomOverview = ({
  title,
  items,
  light,
  onLight,
  open,
  onOpen,
  onHover,
  hovered,
  pinRefs,
}: RoomOverviewProps) => {
  const picked = items.find((i) => i.id === open)
  const lights = items.filter((i) => i.kind === 'light')
  const on = lights.filter((i) => light(i.id).on).length
  const kinds = [...new Set(items.map((i) => i.kind))]
  const inScene = (set: (typeof SCENES)[number]['set']) =>
    lights.every((i) => {
      const s = light(i.id)
      return s.on && s.mode === 'white' && s.brightness === set.brightness && s.kelvin === set.kelvin
    })
  return (
    <>
      <h2 className="room-name">{title}</h2>
      <div className="room-cards">
        <SmartCard
          title="In this room"
          summary={lights.length ? lightsSummary(on, lights.length) : `${items.length} smart items`}
          allLights={
            lights.length
              ? { on: on > 0, onChange: (to) => lights.forEach((i) => onLight(i.id, { on: to })) }
              : undefined
          }
        >
          {lights.length > 0 && (
            <div className="smart-scenes" role="group" aria-label="Scenes">
              {SCENES.map((scene) => (
                <button
                  key={scene.label}
                  className="chip"
                  aria-pressed={inScene(scene.set)}
                  onClick={() => lights.forEach((i) => onLight(i.id, { on: true, mode: 'white', ...scene.set }))}
                >
                  {scene.label}
                </button>
              ))}
            </div>
          )}
          {items.length ? (
            kinds.map((kind) => (
              <div key={kind}>
                <h4 className="smart-group">{KIND_GROUPS[kind]}</h4>
                <ul className="smart-list">
                  {items
                    .filter((i) => i.kind === kind)
                    .map((item) => {
                      const s = item.kind === 'light' ? light(item.id) : undefined
                      return (
                        <SmartRow
                          key={item.id}
                          item={item}
                          sub={(item.lamp ? 'Lamp · ' : '') + itemState(item, s)}
                          light={s}
                          pressed={open === item.id}
                          hovered={hovered === item.id}
                          onOpen={() => onOpen(open === item.id ? undefined : item.id)}
                          onHover={(h) => onHover(h ? item.id : undefined)}
                          onLight={(p) => onLight(item.id, p)}
                        />
                      )
                    })}
                </ul>
              </div>
            ))
          ) : (
            <p className="hint">No smart items here yet. Place them under Planning → Devices.</p>
          )}
        </SmartCard>
      </div>

      <div className="overlay">
        {/* A tag by each item, on a bent line that stops short of it; the open one's tag grows into its card. */}
        {items.map((item) => (
          <div
            key={item.id}
            className="room-pin"
            data-active={hovered === item.id || open === item.id || undefined}
            ref={(el) => {
              pinRefs.current.set(`tag:${item.id}`, el)
            }}
          >
            {item.id === picked?.id ? (
              <TagLine />
            ) : (
              <SmartTag
                item={item}
                light={item.kind === 'light' ? light(item.id) : undefined}
                onOpen={() => onOpen(item.id)}
                onHover={(h) => onHover(h ? item.id : undefined)}
              />
            )}
          </div>
        ))}
        {picked && (
          <div
            className="room-pin"
            data-active
            ref={(el) => {
              pinRefs.current.set(`card:${picked.id}`, el)
            }}
          >
            <div className="room-popover float" role="dialog" aria-label={picked.name}>
              <header className="room-card-head">
                <div>
                  <div className="eyebrow">{picked.lamp ? 'Lamp' : DEVICE_KINDS[picked.kind].label}</div>
                  <strong>{picked.name}</strong>
                </div>
                <IconButton label="Close" small onClick={() => onOpen(undefined)}>
                  <X size={16} />
                </IconButton>
              </header>
              {picked.kind === 'light' ? (
                <LightControls
                  light={light(picked.id)}
                  entity={picked.entity}
                  onChange={(p) => onLight(picked.id, p)}
                />
              ) : (
                <p className="hint">
                  {picked.entity
                    ? `It will show ${picked.entity} once Home Assistant is linked.`
                    : 'Give it a Home Assistant entity under Planning to control it here.'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
