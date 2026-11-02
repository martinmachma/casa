import type { RefObject } from 'react'
import type { LightState } from '../devices/lights'
import type { ShadeState } from '../devices/shades'
import type { SmartItem } from '../rooms/roomItems'
import { SmartTag } from './SmartList'

type HouseTagsProps = {
  /** The smart items on the floor in view, with the room each is in. */
  items: (SmartItem & { room: string | undefined })[]
  light: (id: string) => LightState
  shade: (id: string) => ShadeState
  /** Opens an item's card, temporarily focusing its room. */
  onOpen: (room: string, item: string) => void
  onHover: (id: string | undefined) => void
  hovered: string | undefined
  /** Each tag, moved over its item every frame. */
  pinRefs: RefObject<Map<string, HTMLElement | null>>
}

/** A tag by each smart item on the floor, between rooms; picking one opens the item's card. */
export const HouseTags = ({ items, light, shade, onOpen, onHover, hovered, pinRefs }: HouseTagsProps) => (
  <div className="overlay">
    {items.map((item) => (
      <div
        key={item.id}
        className="room-pin"
        data-active={hovered === item.id || undefined}
        ref={(el) => {
          pinRefs.current.set(`tag:${item.id}`, el)
        }}
      >
        <SmartTag
          item={item}
          light={item.kind === 'light' ? light(item.id) : undefined}
          shade={item.kind === 'blind' ? shade(item.id) : undefined}
          onOpen={() => item.room && onOpen(item.room, item.id)}
          onHover={(h) => onHover(h ? item.id : undefined)}
        />
      </div>
    ))}
  </div>
)
