import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { LightState } from '../devices/lights'
import type { Scene } from '../devices/scenes'
import type { ShadeState } from '../devices/shades'
import type { Floor } from '../layout/types'
import type { Order } from '../lib/order'
import type { SmartItem } from '../rooms/roomItems'
import type { RoomView } from '../rooms/roomViews'
import { describeFloor } from './describeFloor'
import { FloorLayers } from './FloorLayers'
import { LightControls } from './LightControls'
import { ordinal } from './ordinal'
import { PhoneOrder } from './PhoneOrder'
import { PhoneScenes } from './PhoneScenes'
import { ShadeControls } from './ShadeControls'
import { PhoneTile } from './PhoneTile'

type PhoneHomeProps = {
  floors: Floor[]
  floorIndex: number
  onFloor: (index: number) => void
  /** Looking at the whole house from outside instead of one floor. */
  outside: boolean
  onOutside: () => void
  /** Every room, in this person's order. */
  rooms: RoomView[]
  /** That order, the big rooms then the small ones, to change; undefined until it has loaded. */
  roomOrder: Order | undefined
  onRoomOrder: (order: Order) => void
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
  /** What's in view, for the tiles: the room's items, or the floor's (each with its room) when no room is picked. */
  items: (SmartItem & { room?: string })[]
  /** The item whose controls are open. */
  open: SmartItem | undefined
  /** Space covered at the bottom of the view, so the room and a close-up stay above the sheet. */
  onFocusInset: (pixels: number) => void
  onOpen: (id: string | undefined) => void
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
}

/** Makes the compact floor switch and its expanded stops large enough for a thumb. */
const FLOOR_SCALE = 1.45

/** How far a drag on the sheet's handle goes before it raises or lowers the sheet, in CSS pixels. */
const SWIPE = 18

/**
 * Home on a phone: the floor switch at the right edge, the chosen scenes over a low sheet about the floor: its rooms
 * as chips, then a row of what can be switched on it, or in the picked room. Swiped up, the row becomes a grid, and an
 * item's controls take its place when one is open.
 */
export const PhoneHome = ({
  floors,
  floorIndex,
  onFloor,
  outside,
  onOutside,
  rooms,
  roomOrder,
  onRoomOrder,
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
  light,
  onLight,
  shade,
  onShade,
}: PhoneHomeProps) => {
  const [raisedByHand, setRaised] = useState(false)
  // Putting the rooms in order, in the raised sheet.
  const [ordering, setOrdering] = useState(false)
  // The sheet's heights: low with one row of cards, and as tall as what's in it raised, up to most of the view.
  const [sizes, setSizes] = useState({ low: 0, full: 0, most: 0 })
  const raised = (raisedByHand && Math.min(sizes.full, sizes.most) > sizes.low + 1) || !!open
  // Its height under a finger dragging the handle.
  const [dragged, setDragged] = useState<number>()
  const sheet = useRef<HTMLDivElement>(null)
  const chips = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = sheet.current
    const body = content.current
    const view = el?.parentElement
    if (!el || !body || !view) return
    const measure = () => {
      // Everything round the body: the handle, padding and border.
      const chrome = el.offsetHeight - (body.parentElement?.offsetHeight ?? 0)
      // Measure the grid even while the tiles are shown in a horizontal row.
      const tiles = body.querySelector<HTMLElement>('.phone-tiles')
      let full = body.offsetHeight
      if (tiles) {
        const wrapped = tiles.hasAttribute('data-wrap')
        tiles.setAttribute('data-wrap', '')
        full = tiles.getBoundingClientRect().bottom - body.getBoundingClientRect().top
        if (!wrapped) tiles.removeAttribute('data-wrap')
      }
      // Low, the sheet shows the room chips and one row of tiles (or the empty message).
      const last = body.querySelector<HTMLElement>('.phone-tile, .phone-tiles-hint') ?? chips.current
      const low = last ? last.getBoundingClientRect().bottom - body.getBoundingClientRect().top : 0
      setSizes({ low: chrome + low, full: chrome + full, most: view.clientHeight * 0.64 })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    observer.observe(view)
    const grab = el.querySelector('.phone-grab')
    if (grab) observer.observe(grab)
    measure()
    return () => observer.disconnect()
  }, [items, open, ordering, raised])

  const top = Math.max(sizes.low, Math.min(sizes.full, sizes.most))
  const expandable = top > sizes.low + 1
  const settled = raised ? top : sizes.low
  const height = dragged ?? (sizes.low ? settled : undefined)

  // The room and a close-up are framed above where the sheet comes to rest, not each step of it getting there.
  useLayoutEffect(() => {
    if (settled) onFocusInset(settled + 16)
  }, [settled, onFocusInset])
  useEffect(() => () => onFocusInset(0), [onFocusInset])

  // The picked room's chip is kept in sight.
  useEffect(() => {
    chips.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [room?.id])

  // The chips are the rooms on the floor in view, or every room from outside.
  const floorRooms = outside ? rooms : rooms.filter((r) => r.floor === floors[floorIndex]?.id)
  const roomName = (id: string | undefined) => rooms.find((r) => r.room === id)?.label
  const wrap = raised || dragged !== undefined
  const openItem = (id: string) => {
    setRaised(true)
    onOpen(id)
  }
  const lower = () => {
    setRaised(false)
    setOrdering(false)
    onOpen(undefined)
  }

  // The sheet follows a finger on its handle and settles up or down the way it was going; a tap toggles it.
  const swipe = useRef<{ x: number; y: number; from: number; moved: boolean; grip: boolean } | undefined>(undefined)
  const suppressClick = useRef(false)
  const handle = {
    onPointerDown: (e: PointerEvent) => {
      suppressClick.current = false
      const grip = e.currentTarget.classList.contains('phone-grab')
      if ((!grip && raised) || (!expandable && !raised)) return
      if (grip) e.currentTarget.setPointerCapture(e.pointerId)
      swipe.current = { x: e.clientX, y: e.clientY, from: sheet.current?.offsetHeight ?? settled, moved: false, grip }
    },
    onPointerMove: (e: PointerEvent) => {
      const s = swipe.current
      if (!s) return
      const dy = e.clientY - s.y
      if (!s.moved && Math.abs(dy) < SWIPE / 3) return
      if (!s.moved && !s.grip && Math.abs(e.clientX - s.x) > Math.abs(dy)) {
        swipe.current = undefined
        return
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      s.moved = true
      suppressClick.current = true
      setDragged(Math.max(sizes.low, Math.min(top, s.from - dy)))
    },
    onPointerUp: (e: PointerEvent) => {
      const s = swipe.current
      swipe.current = undefined
      setDragged(undefined)
      if (!s) return
      const dy = e.clientY - s.y
      if (!s.moved && s.grip) {
        if (raised) lower()
        else setRaised(true)
      } else if (dy < -SWIPE) setRaised(true)
      else if (dy > SWIPE) lower()
    },
    onPointerCancel: () => {
      swipe.current = undefined
      setDragged(undefined)
    },
  }

  return (
    <div
      className="phone-home"
      data-raised={raised || undefined}
      data-dragging={dragged !== undefined || undefined}
      style={
        {
          '--sheet': `${height ?? 0}px`,
          '--sheet-raised': dragged === undefined ? Number(raised) : (dragged - sizes.low) / (top - sizes.low || 1),
        } as CSSProperties
      }
    >
      <button
        className="phone-leave float"
        data-shown={!!room || undefined}
        aria-label="Leave the room"
        aria-hidden={!room}
        tabIndex={room ? 0 : -1}
        onClick={onLeave}
      >
        <X size={18} />
      </button>

      <FloorLayers
        floors={floors}
        floorIndex={floorIndex}
        outside={outside}
        onFloor={onFloor}
        onOutside={onOutside}
        describe={describeFloor(floors, rooms, lit)}
        scale={FLOOR_SCALE}
        label={false}
      />

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

      {raised && <div className="phone-scrim" onClick={lower} />}

      <div
        ref={sheet}
        className="phone-rooms float"
        aria-label="Rooms"
        data-dragging={dragged !== undefined || undefined}
        style={{ height }}
      >
        <div
          className="phone-grab"
          data-static={(!expandable && !raised) || undefined}
          aria-label={expandable || raised ? (raised ? 'Lower' : 'Raise') : undefined}
          role={expandable || raised ? 'button' : undefined}
          tabIndex={expandable || raised ? 0 : undefined}
          onKeyDown={(e) => {
            if ((expandable || raised) && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              if (raised) lower()
              else setRaised(true)
            }
          }}
          {...handle}
        >
          {(expandable || raised) && <i />}
        </div>
        <div
          className="phone-sheet-body"
          {...handle}
          onClickCapture={(e) => {
            if (suppressClick.current) {
              e.preventDefault()
              e.stopPropagation()
              suppressClick.current = false
            }
          }}
          onWheel={(e) => {
            if (!raised && expandable && e.deltaY > 0 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) setRaised(true)
          }}
        >
          <div ref={content}>
            <div ref={chips} className="phone-room-chips" aria-label="Rooms">
              {floorRooms.map((r) => (
                <button
                  key={r.id}
                  className="phone-chip"
                  aria-pressed={r === room}
                  onClick={() => (r === room ? onLeave() : onRoom(r.id))}
                >
                  {lit.get(r.room) && <i className="phone-dot" data-on />}
                  {r.label}
                </button>
              ))}
              {!room && raised && roomOrder && (
                <button className="phone-edit" aria-pressed={ordering} onClick={() => setOrdering(!ordering)}>
                  {ordering ? 'Done' : 'Edit'}
                </button>
              )}
            </div>

            {!room && raised && ordering && roomOrder ? (
              <div className="phone-rooms-order">
                <PhoneOrder
                  order={roomOrder}
                  name={(id) => rooms.find((r) => r.id === id)?.label}
                  main="Main rooms"
                  minor="Other spaces"
                  hint="Drag a room up or down to change its place, or below the line with the smaller spaces."
                  onSave={onRoomOrder}
                />
              </div>
            ) : open ? (
              <div className="phone-item" role="group" aria-label={open.name}>
                <div className="phone-sheet-head">
                  <button className="phone-back" onClick={() => onOpen(undefined)}>
                    <ChevronLeft size={16} />
                    {room?.label ?? (outside ? 'All' : `${ordinal(floorIndex + 1)} floor`)}
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
            ) : items.length ? (
              <>
                <div className="phone-tiles" data-wrap={wrap || undefined}>
                  {items.map((item) => (
                    <PhoneTile
                      key={item.id}
                      item={item}
                      place={room ? undefined : roomName(item.room)}
                      light={item.kind === 'light' ? light(item.id) : undefined}
                      shade={item.kind === 'blind' ? shade(item.id) : undefined}
                      onLight={(p) => onLight(item.id, p)}
                      onShade={(p) => onShade(item.id, p)}
                      onOpen={() => openItem(item.id)}
                    />
                  ))}
                </div>
                {raised && (
                  <p className="hint phone-tiles-hint">Tap to switch, use the arrow for brightness or position.</p>
                )}
              </>
            ) : (
              <p className="hint phone-tiles-hint">Nothing to switch {room ? 'in here' : 'here'} yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
