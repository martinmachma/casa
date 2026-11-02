import { X } from 'lucide-react'
import type { RefObject } from 'react'
import type { LightState } from '../devices/lights'
import type { ShadeState } from '../devices/shades'
import type { Scene } from '../devices/scenes'
import type { SmartItem } from '../rooms/roomItems'
import { IconButton } from './kit'
import { ItemPins } from './ItemPins'
import { RoomScenes } from './RoomScenes'
import { SmartCard, SmartTile } from './SmartList'
import { KIND_GROUPS, lightsSummary } from './smartText'

type RoomOverviewProps = {
  title: string
  items: SmartItem[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
  open: string | undefined
  onOpen: (id: string | undefined) => void
  /** The item whose card is pointed at, picked out in the view like the open one. */
  onHover: (id: string | undefined) => void
  /** The item pointed at, here or in the view; its tag and row are picked out. */
  hovered: string | undefined
  /** The open item's popover, moved over its item every frame. */
  pinRefs: RefObject<Map<string, HTMLElement | null>>
  scenes: Scene[]
  onScenes: (scenes: Scene[]) => void
  /** Out of the room, back to its whole floor. */
  onLeave: () => void
}

/** The room's own view: its name over the middle, what's in it on the right, and a popover by the item picked. */
export const RoomOverview = ({
  title,
  items,
  light,
  onLight,
  shade,
  onShade,
  open,
  onOpen,
  onHover,
  hovered,
  pinRefs,
  scenes,
  onScenes,
  onLeave,
}: RoomOverviewProps) => {
  const lights = items.filter((i) => i.kind === 'light')
  const on = lights.filter((i) => light(i.id).on).length
  const kinds = [...new Set(items.map((i) => i.kind))]
  return (
    <>
      <h2 className="room-name float">
        <span className="room-name-text">{title}</span>
        <IconButton label="Leave room (Esc)" small className="room-name-leave" onClick={onLeave}>
          <X size={14} />
        </IconButton>
      </h2>
      <div className="room-cards" data-compact>
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
            <RoomScenes
              scenes={scenes}
              onScenes={onScenes}
              lightIds={lights.map((i) => i.id)}
              light={light}
              onLight={onLight}
            />
          )}
          {items.length ? (
            kinds.map((kind) => (
              <div key={kind}>
                {kinds.length > 1 && <h4 className="smart-group">{KIND_GROUPS[kind]}</h4>}
                <div className="smart-lights">
                  {items
                    .filter((i) => i.kind === kind)
                    .map((item) => (
                      <SmartTile
                        key={item.id}
                        item={item}
                        light={item.kind === 'light' ? light(item.id) : undefined}
                        shade={item.kind === 'blind' ? shade(item.id) : undefined}
                        pressed={open === item.id}
                        hovered={hovered === item.id}
                        onOpen={() => onOpen(open === item.id ? undefined : item.id)}
                        onHover={(h) => onHover(h ? item.id : undefined)}
                        onLight={(p) => onLight(item.id, p)}
                      />
                    ))}
                </div>
              </div>
            ))
          ) : (
            <p className="hint">No smart items here yet. Place them under Planning → Devices.</p>
          )}
        </SmartCard>
      </div>

      <ItemPins
        items={items}
        light={light}
        onLight={onLight}
        shade={shade}
        onShade={onShade}
        open={open}
        onOpen={onOpen}
        onHover={onHover}
        hovered={hovered}
        pinRefs={pinRefs}
      />
    </>
  )
}
