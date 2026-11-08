import { ChevronLeft, X } from 'lucide-react'
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
  // The sheet's heights: low with one row of cards, and as tall as what's in it raised, up to most of the view.
  const [sizes, setSizes] = useState({ low: 0, full: 0, most: 0 })
  // Its height under a finger dragging the handle.
  const [dragged, setDragged] = useState<number>()
  const sheet = useRef<HTMLDivElement>(null)
  const cards = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = sheet.current
    const body = content.current
    const view = el?.parentElement
    if (!el || !body || !view) return
    const measure = () => {
      // Everything round the body: the handle, padding and border.
      const chrome = el.offsetHeight - (body.parentElement?.offsetHeight ?? 0)
      const card = cards.current?.querySelector<HTMLElement>('.phone-room-card')?.offsetHeight ?? 0
      setSizes({ low: chrome + card, full: chrome + body.offsetHeight, most: view.clientHeight * 0.64 })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    observer.observe(view)
    measure()
    return () => observer.disconnect()
  }, [])

  const top = Math.max(sizes.low, Math.min(sizes.full, sizes.most))
  const settled = raised ? top : sizes.low
  const height = dragged ?? (sizes.low ? settled : undefined)

  // The room and a close-up are framed above where the sheet comes to rest, not each step of it getting there.
  useEffect(() => {
    if (settled) onFocusInset(settled + 16)
  }, [settled, onFocusInset])
  useEffect(() => () => onFocusInset(0), [onFocusInset])

  // The picked room's card is kept in sight.
  useEffect(() => {
    cards.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [room?.id])

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

  // The sheet follows a finger on its handle and settles up or down the way it was going; a tap toggles it.
  const swipe = useRef<{ y: number; from: number; moved: boolean } | undefined>(undefined)
  const handle = {
    onPointerDown: (e: PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      swipe.current = { y: e.clientY, from: sheet.current?.offsetHeight ?? settled, moved: false }
    },
    onPointerMove: (e: PointerEvent) => {
      const s = swipe.current
      if (!s) return
      const dy = e.clientY - s.y
      if (!s.moved && Math.abs(dy) < SWIPE / 3) return
      s.moved = true
      setDragged(Math.max(sizes.low, Math.min(sizes.most, s.from - dy)))
    },
    onPointerUp: (e: PointerEvent) => {
      const s = swipe.current
      swipe.current = undefined
      setDragged(undefined)
      if (!s) return
      const dy = e.clientY - s.y
      if (!s.moved) {
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
      style={{ '--sheet': `${settled}px` } as CSSProperties}
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
        describe={describe}
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
        <div className="phone-grab" aria-label={raised ? 'Lower' : 'Raise'} role="button" {...handle}>
          <i />
        </div>
        <div className="phone-sheet-body">
          <div ref={content}>
            <div
              ref={cards}
              className="phone-room-cards"
              data-wrap={(!room && (raised || dragged !== undefined)) || undefined}
            >
              {rooms.map((r) => (
                <button
                  key={r.id}
                  className="phone-room-card"
                  aria-current={r === room || undefined}
                  aria-label={r === room ? `Leave ${r.label}` : undefined}
                  onClick={() => (r === room ? onLeave() : onRoom(r.id))}
                >
                  {r === room && <X className="phone-room-leave" size={14} />}
                  <b>{r.label}</b>
                  <span>
                    {lit.get(r.room) && <i className="phone-dot" data-on />}
                    {floors.length > 1 && floorName(r.floor)}
                    {floors.length > 1 && lit.has(r.room) && ' · '}
                    {lit.has(r.room) && (lit.get(r.room) ? 'On' : 'Off')}
                  </span>
                </button>
              ))}
            </div>

            {room &&
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
      </div>
    </div>
  )
}
