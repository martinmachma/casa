import { Check } from 'lucide-react'
import type { RefObject } from 'react'
import type { SmartItem } from '../rooms/roomItems'
import { TagLine } from './SmartList'

type ScenePinsProps = {
  items: SmartItem[]
  /** Whether an item is in the scene. */
  picked: (id: string) => boolean
  /** The item open in the scene's list. */
  open: string | undefined
  hovered: string | undefined
  onTick: (item: SmartItem) => void
  onHover: (id: string | undefined) => void
  pinRefs: RefObject<Map<string, HTMLElement | null>>
}

/** While a scene is put together, a box over each item in view that puts it in the scene. */
export const ScenePins = ({ items, picked, open, hovered, onTick, onHover, pinRefs }: ScenePinsProps) => (
  <div className="overlay">
    {items.map((item) => (
      <div
        key={item.id}
        className="room-pin"
        data-active={hovered === item.id || open === item.id || undefined}
        ref={(el) => {
          pinRefs.current.set(`tag:${item.id}`, el)
        }}
      >
        <TagLine />
        <button
          className="scene-tick scene-pin"
          role="checkbox"
          aria-checked={picked(item.id)}
          aria-label={`${picked(item.id) ? 'Remove' : 'Add'} ${item.name}`}
          title={item.name}
          onClick={() => onTick(item)}
          onPointerEnter={() => onHover(item.id)}
          onPointerLeave={() => onHover(undefined)}
        >
          {picked(item.id) && <Check size={14} />}
        </button>
      </div>
    ))}
  </div>
)
