import { X } from 'lucide-react'
import { type RefObject, useEffect, useState } from 'react'
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
  /** Picked out like the open item, without opening a card. */
  picked?: string
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
  picked,
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
  // A tap away closes the desktop card or the phone's picked item; controls and camera gestures keep it open.
  useEffect(() => {
    if (!open && !picked) return
    let down: { x: number; y: number; id: number } | undefined
    const onDown = (e: PointerEvent) => {
      const inside = !!(e.target as Element).closest?.(
        '.room-popover, .shade-beside, .smart-tag, .room-cards, .phone-rooms, .phone-leave',
      )
      down = e.isPrimary && !inside ? { x: e.clientX, y: e.clientY, id: e.pointerId } : undefined
    }
    const cancel = () => {
      down = undefined
    }
    const onMove = (e: PointerEvent) => {
      if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 5) cancel()
    }
    const onUp = (e: PointerEvent) => {
      const tap = down
      cancel()
      if (tap && tap.id === e.pointerId && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 5) onOpen(undefined)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', cancel, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', cancel, true)
    }
  }, [open, picked, onOpen])
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
            data-active={hovered === item.id || item.id === open || item.id === picked || undefined}
            ref={(el) => {
              pinRefs.current.set(`tag:${item.id}`, el)
            }}
          >
            {carded ? (
              // Longer to the open card, which stands clear of its item; it grows and shrinks with the card.
              <TagLine key={item.id === open ? 'line-open' : 'line-closing'} reach={98} />
            ) : (
              <>
                <SmartTag
                  item={item}
                  light={item.kind === 'light' ? light(item.id) : undefined}
                  onOpen={() => onOpen(item.id)}
                  onHover={(h) => onHover(h ? item.id : undefined)}
                />
                <span className="pin-name">{item.name}</span>
              </>
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
                {item.kind === 'light' ? (
                  <LightControls light={light(item.id)} onChange={(p) => onLight(item.id, p)} />
                ) : (
                  <div className="room-card-head">
                    <p className="hint">
                      {item.entity
                        ? `It will show ${item.entity} once Home Assistant is linked.`
                        : 'Give it a Home Assistant entity under Edit to control it here.'}
                    </p>
                    <IconButton label="Close" small onClick={() => onOpen(undefined)}>
                      <X size={16} />
                    </IconButton>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
