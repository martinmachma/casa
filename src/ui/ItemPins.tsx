import { X } from 'lucide-react'
import { type RefObject, useEffect, useState } from 'react'
import { DEVICE_KINDS } from '../devices/kinds'
import type { LightState } from '../devices/lights'
import type { ShadeState } from '../devices/shades'
import type { SmartItem } from '../rooms/roomItems'
import { IconButton } from './kit'
import { LightControls } from './LightControls'
import { ShadeControls } from './ShadeControls'
import { SmartTag, TagLine } from './SmartList'

type ItemPinsProps = {
  items: SmartItem[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
  open: string | undefined
  onOpen: (id: string | undefined) => void
  onHover: (id: string | undefined) => void
  hovered: string | undefined
  pinRefs: RefObject<Map<string, HTMLElement | null>>
}

/** Smart item tags and their animated controls, in a room or outside the house. */
export const ItemPins = ({
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
}: ItemPinsProps) => {
  // Cards closing, kept until they've shrunk back into their tags.
  const [leaving, setLeaving] = useState<string[]>([])
  const [last, setLast] = useState(open)
  if (last !== open) {
    setLast(open)
    setLeaving((l) => [...l.filter((i) => i !== open && i !== last), ...(last ? [last] : [])])
  }
  // A click anywhere else closes the open card; the card, the tags and the room's card handle their own clicks,
  // and a drag (turning the view) isn't a click.
  useEffect(() => {
    if (!open) return
    let down: { x: number; y: number; inside: boolean } | undefined
    const onDown = (e: PointerEvent) => {
      const inside = !!(e.target as Element).closest?.('.room-popover, .shade-beside, .smart-tag, .room-cards')
      down = { x: e.clientX, y: e.clientY, inside }
    }
    const onUp = (e: PointerEvent) => {
      if (down && !down.inside && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) onOpen(undefined)
      down = undefined
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
    }
  }, [open, onOpen])
  return (
    <div className="overlay">
      {/* A tag by each item, on a line straight up from it; the open one's tag grows into its card, and
          shrinks back into the tag as it closes. */}
      {items.map((item) => {
        // Controls standing beside their item (a window's shade) take the place of its tag while open.
        if (item.beside) {
          return item.id === open ? (
            <div
              key={item.id}
              className="room-pin"
              ref={(el) => {
                pinRefs.current.set(`beside:${item.id}`, el)
              }}
            >
              <div className="shade-beside" role="dialog" aria-label={item.name}>
                <ShadeControls
                  name={item.name}
                  shade={shade(item.id)}
                  onChange={(p) => onShade(item.id, p)}
                  onClose={() => onOpen(undefined)}
                />
              </div>
            </div>
          ) : (
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
                shade={shade(item.id)}
                onOpen={() => onOpen(item.id)}
                onHover={(h) => onHover(h ? item.id : undefined)}
              />
            </div>
          )
        }
        const carded = item.id === open || leaving.includes(item.id)
        return (
          <div
            key={item.id}
            className="room-pin"
            data-active={hovered === item.id || item.id === open || undefined}
            ref={(el) => {
              pinRefs.current.set(`tag:${item.id}`, el)
            }}
          >
            {carded ? (
              // Longer to the open card, which stands clear of its item; it grows and shrinks with the card.
              <TagLine key={item.id === open ? 'line-open' : 'line-closing'} reach={98} />
            ) : (
              <SmartTag
                item={item}
                light={item.kind === 'light' ? light(item.id) : undefined}
                onOpen={() => onOpen(item.id)}
                onHover={(h) => onHover(h ? item.id : undefined)}
              />
            )}
            {carded && (
              <div
                // Reopened while closing, it grows afresh.
                key={item.id === open ? 'open' : 'closing'}
                className="room-popover float"
                data-closing={item.id !== open || undefined}
                role="dialog"
                aria-label={item.name}
                onAnimationEnd={(e) => {
                  if (e.target === e.currentTarget && item.id !== open)
                    setLeaving((l) => l.filter((i) => i !== item.id))
                }}
              >
                <>
                  <header className="room-card-head">
                    <div>
                      <div className="eyebrow">{item.lamp ? 'Lamp' : DEVICE_KINDS[item.kind].label}</div>
                      <strong>{item.name}</strong>
                    </div>
                    <IconButton label="Close" small onClick={() => onOpen(undefined)}>
                      <X size={16} />
                    </IconButton>
                  </header>
                  {item.kind === 'light' ? (
                    <LightControls light={light(item.id)} onChange={(p) => onLight(item.id, p)} />
                  ) : (
                    <p className="hint">
                      {item.entity
                        ? `It will show ${item.entity} once Home Assistant is linked.`
                        : 'Give it a Home Assistant entity under Planning to control it here.'}
                    </p>
                  )}
                </>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
