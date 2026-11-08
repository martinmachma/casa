import { ChevronLeft } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { LightState } from '../devices/lights'
import type { Scene } from '../devices/scenes'
import type { ShadeState } from '../devices/shades'
import type { Floor } from '../layout/types'
import type { Order } from '../lib/order'
import type { SmartItem } from '../rooms/roomItems'
import type { RoomView } from '../rooms/roomViews'
import { FloorLayers } from './FloorLayers'
import { LightControls } from './LightControls'
import { ordinal } from './ordinal'
import { PhoneScenes } from './PhoneScenes'
import { ShadeControls } from './ShadeControls'
import { SmartRows } from './SmartList'

type PhoneHomeProps = {
  floors: Floor[]
  floorIndex: number
  onFloor: (index: number) => void
  /** Looking at the whole house from outside instead of one floor. */
  outside: boolean
  onOutside: () => void
  /** Every room, in this person's order. */
  rooms: RoomView[]
  /** The room being looked at on its own, if any. */
  room: RoomView | undefined
  onRoom: (id: string) => void
  /** Out of the room, back to its whole floor. */
  onLeave: () => void
  /** The rooms with lights, and whether any is on. */
  lit: Map<string, boolean>
  /** The scenes that reach what's in view. */
  scenes: Scene[]
  allScenes: Scene[]
  sceneOrder: Order | undefined
  onSceneOrder: (order: Order) => void
  /** Every item in the house: a scene is on when all it sets is as it says. */
  sceneIds: string[]
  /** What's in the room, for its list. */
  items: SmartItem[]
  /** The item whose controls are open. */
  open: SmartItem | undefined
  /** Space covered at the bottom of the view, so the room and a close-up stay above the sheet. */
  onFocusInset: (pixels: number) => void
  onOpen: (id: string | undefined) => void
  onHover: (id: string | undefined) => void
  hovered: string | undefined
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
}

/** How far a drag on the sheet's handle goes before it raises or lowers the sheet, in CSS pixels. */
const SWIPE = 18

/**
 * Home on a phone: the floors as layers at the right edge, the chosen scenes over a low sheet of the floor's rooms.
 * Swiped up, the sheet has what's in the picked room, and an item's controls in its place when one is open.
 */
export const PhoneHome = ({
  floors,
  floorIndex,
  onFloor,
  outside,
  onOutside,
  rooms,
  room,
  onRoom,
  onLeave,
  lit,
  scenes,
  allScenes,
  sceneOrder,
  onSceneOrder,
  sceneIds,
  items,
  open,
  onFocusInset,
  onOpen,
  onHover,
  hovered,
  light,
  onLight,
  shade,
  onShade,
}: PhoneHomeProps) => {
  const [raisedByHand, setRaised] = useState(false)
  const raised = raisedByHand || !!open
  const [sheetHeight, setSheetHeight] = useState(0)
  const sheet = useRef<HTMLDivElement>(null)
  const cards = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = sheet.current
    const view = el?.parentElement
    if (!el || !view) return
    const measure = () => {
      const covered = view.getBoundingClientRect().bottom - el.getBoundingClientRect().top
      setSheetHeight(covered)
      onFocusInset(covered + 16)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    observer.observe(view)
    measure()
    return () => {
      observer.disconnect()
      onFocusInset(0)
    }
  }, [onFocusInset])

  // The picked room's card is kept in sight.
  useEffect(() => {
    cards.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [room?.id, floorIndex, outside])

  const here = outside ? undefined : floors[floorIndex]
  // From outside, every room, each with its floor.
  const shownRooms = here ? rooms.filter((r) => r.floor === here.id) : rooms
  const floorName = (id: string) => `${ordinal(floors.findIndex((f) => f.id === id) + 1)} floor`
  const describe = (index: number | undefined) => {
    const inIt = index === undefined ? rooms : rooms.filter((r) => r.floor === floors[index].id)
    const on = inIt.filter((r) => lit.get(r.room)).length
    return `${inIt.length} rooms · ${on ? `${on} lit` : 'all dark'}`
  }
  const lower = () => {
    setRaised(false)
    onOpen(undefined)
  }

  // A short drag on the handle raises or lowers the sheet; a tap toggles it.
  const swipe = useRef<{ y: number; done: boolean } | undefined>(undefined)
  const handle = {
    onPointerDown: (e: PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      swipe.current = { y: e.clientY, done: false }
    },
    onPointerMove: (e: PointerEvent) => {
      const s = swipe.current
      if (!s || s.done) return
      const dy = e.clientY - s.y
      if (Math.abs(dy) < SWIPE) return
      s.done = true
      if (dy < 0) setRaised(true)
      else lower()
    },
    onPointerUp: () => {
      if (swipe.current && !swipe.current.done) {
        if (raised) lower()
        else setRaised(true)
      }
      swipe.current = undefined
    },
    onPointerCancel: () => (swipe.current = undefined),
  }

  return (
    <div
      className="phone-home"
      data-raised={raised || undefined}
      style={{ '--sheet': `${sheetHeight}px` } as CSSProperties}
    >
      <FloorLayers
        floors={floors}
        floorIndex={floorIndex}
        outside={outside}
        onFloor={onFloor}
        onOutside={onOutside}
        describe={describe}
      />

      {!raised && (
        <PhoneScenes
          scenes={scenes}
          all={allScenes}
          saved={sceneOrder}
          onSave={onSceneOrder}
          ids={sceneIds}
          light={light}
          onLight={onLight}
          shade={shade}
          onShade={onShade}
        />
      )}

      {raised && <div className="phone-scrim" onClick={lower} />}

      <div ref={sheet} className="phone-rooms float" aria-label="Rooms">
        <div className="phone-grab" aria-label={raised ? 'Lower' : 'Raise'} role="button" {...handle}>
          <i />
        </div>
        <div ref={cards} className="phone-room-cards" data-wrap={(raised && !room) || undefined}>
          {shownRooms.map((r) => (
            <button
              key={r.id}
              className="phone-room-card"
              aria-current={r === room || undefined}
              onClick={() => (r === room ? onLeave() : onRoom(r.id))}
            >
              <b>{r.label}</b>
              <span>
                {lit.get(r.room) && <i className="phone-dot" data-on />}
                {here ? (lit.has(r.room) ? (lit.get(r.room) ? 'On' : 'Off') : '') : floorName(r.floor)}
              </span>
            </button>
          ))}
        </div>

        {raised &&
          room &&
          (open ? (
            <div className="phone-item" role="group" aria-label={open.name}>
              <div className="phone-sheet-head">
                <button className="phone-back" onClick={() => onOpen(undefined)}>
                  <ChevronLeft size={16} />
                  {room.label}
                </button>
              </div>
              <h2>{open.name}</h2>
              {open.kind === 'light' ? (
                <LightControls light={light(open.id)} onChange={(p) => onLight(open.id, p)} />
              ) : open.kind === 'blind' ? (
                <ShadeControls
                  name={open.name}
                  shade={shade(open.id)}
                  onChange={(p) => onShade(open.id, p)}
                  onClose={() => onOpen(undefined)}
                />
              ) : (
                <p className="hint">
                  {open.entity
                    ? `It will show ${open.entity} once Home Assistant is linked.`
                    : 'Give it a Home Assistant entity under Edit to control it here.'}
                </p>
              )}
            </div>
          ) : (
            <div className="phone-items">
              {items.length ? (
                <SmartRows
                  items={items}
                  light={light}
                  onLight={onLight}
                  shade={shade}
                  onShade={onShade}
                  onOpen={onOpen}
                  onHover={onHover}
                  hovered={hovered}
                />
              ) : (
                <p className="hint">Nothing to switch in here yet.</p>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
