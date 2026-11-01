import { X } from 'lucide-react'
import { type RefObject, useEffect, useState } from 'react'
import { DEVICE_KINDS } from '../devices/kinds'
import type { LightState } from '../devices/lights'
import type { Scene } from '../devices/scenes'
import type { SmartItem } from '../rooms/roomItems'
import { IconButton } from './kit'
import { LightControls } from './LightControls'
import { RoomScenes } from './RoomScenes'
import { SmartCard, SmartTag, SmartTile, TagLine } from './SmartList'
import { KIND_GROUPS, lightsSummary } from './smartText'

type RoomOverviewProps = {
  title: string
  items: SmartItem[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
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
}

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
  scenes,
  onScenes,
}: RoomOverviewProps) => {
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
      const inside = !!(e.target as Element).closest?.('.room-popover, .smart-tag, .room-cards')
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
  const lights = items.filter((i) => i.kind === 'light')
  const on = lights.filter((i) => light(i.id).on).length
  const kinds = [...new Set(items.map((i) => i.kind))]
  return (
    <>
      <h2 className="room-name">{title}</h2>
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

      <div className="overlay">
        {/* A tag by each item, on a bent line that stops short of it; the open one's tag grows into its card, and
            shrinks back into the tag as it closes. */}
        {items.map((item) => {
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
                <TagLine key={item.id === open ? 'line-open' : 'line-closing'} reach={80} />
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
                    <LightControls light={light(item.id)} entity={item.entity} onChange={(p) => onLight(item.id, p)} />
                  ) : (
                    <p className="hint">
                      {item.entity
                        ? `It will show ${item.entity} once Home Assistant is linked.`
                        : 'Give it a Home Assistant entity under Planning to control it here.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
