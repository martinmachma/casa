import {
  Archive,
  Bath,
  Bed,
  BedDouble,
  Check,
  DoorOpen,
  Footprints,
  Pencil,
  Sofa,
  Square,
  Toilet,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { arrangeRooms, moveRoom, readRoomOrder, saveRoomOrder, type RoomZone } from '../rooms/roomOrder'
import type { RoomView } from '../rooms/roomViews'

type RoomNavProps = {
  rooms: RoomView[]
  /** The room being looked at on its own, if any. */
  room: string | undefined
  onRoom: (id: string) => void
}

// A room's icon, from what the plan calls it.
const ROOM_ICONS: [RegExp, LucideIcon][] = [
  [/living|kitchen|lounge/i, Sofa],
  [/bed/i, BedDouble],
  [/bath|shower/i, Bath],
  [/wc|toilet/i, Toilet],
  [/stair/i, Footprints],
  [/hall|landing|entr/i, DoorOpen],
  [/storage|boiler|utility/i, Archive],
  [/room/i, Bed],
]
const roomIcon = (planName: string) => {
  const Icon = ROOM_ICONS.find(([test]) => test.test(planName))?.[1] ?? Square
  return <Icon size={18} />
}

const LONG_PRESS = 500

/** The room being dragged, and where the pointer holds it. */
type Drag = { id: string; zone: RoomZone; x: number; y: number; offsetX: number; offsetY: number; width: number }

/**
 * The rooms down the left of the view: the rooms lived in as a list, halls and storage as small links under it. In
 * editing (the pencil, or a long press) everything shakes where it is and can be dragged: up and down the list, or
 * between the list and the small links to make a room big or small.
 */
export const RoomNav = ({ rooms, room, onRoom }: RoomNavProps) => {
  const [saved, setSaved] = useState(readRoomOrder)
  const order = useMemo(() => arrangeRooms(rooms, saved), [rooms, saved])
  const byId = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])
  const [editing, setEditing] = useState(false)
  const [drag, setDrag] = useState<Drag>()
  const navRef = useRef<HTMLElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  // The order as the pointer handlers last saw or made it, between renders.
  const orderRef = useRef(order)
  useLayoutEffect(() => {
    orderRef.current = order
  }, [order])
  // A press that turned into a long press or a drag isn't also a click.
  const swallowClick = useRef(false)

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  useEffect(() => {
    if (!drag) return
    document.documentElement.dataset.roomDrag = ''
    return () => delete document.documentElement.dataset.roomDrag
  }, [drag])

  // The others slide into their new places as the dragged room moves past them.
  const places = useRef(new Map<string, { x: number; y: number }>())
  useLayoutEffect(() => {
    const next = new Map<string, { x: number; y: number }>()
    navRef.current?.querySelectorAll<HTMLElement>('[data-room]').forEach((el) => {
      const id = el.dataset.room!
      const at = { x: el.offsetLeft, y: el.offsetTop }
      const was = places.current.get(id)
      if (drag && was && id !== drag.id && (was.x !== at.x || was.y !== at.y))
        el.animate([{ transform: `translate(${was.x - at.x}px, ${was.y - at.y}px)` }, { transform: 'none' }], {
          duration: 160,
          easing: 'ease-out',
        })
      next.set(id, at)
    })
    places.current = next
  })

  /**
   * Where a room dropped at this point would go: among the small links once the pointer is below the list, and after
   * every other room whose middle it has passed (in the links, also every one on a row above). A room only swaps
   * places once the pointer crosses its neighbour's middle, and the swap moves that middle away again, so it holds still.
   */
  const dropAt = (id: string, x: number, y: number): { zone: RoomZone; index: number } | undefined => {
    const nav = navRef.current
    if (!nav) return
    // The pointer in the nav's own layout, which offsetTop and offsetLeft measure and sliding rooms don't change.
    const box = nav.getBoundingClientRect()
    const px = x - box.left - nav.clientLeft + nav.scrollLeft
    const py = y - box.top - nav.clientTop + nav.scrollTop
    const minor = nav.querySelector<HTMLElement>('[data-zone="minor"]')
    const zone: RoomZone = minor && py > minor.offsetTop ? 'minor' : 'main'
    const others = [...nav.querySelectorAll<HTMLElement>(`[data-zone="${zone}"] [data-room]`)].filter(
      (el) => el.dataset.room !== id,
    )
    const passed = (el: HTMLElement) =>
      zone === 'main'
        ? py > el.offsetTop + el.offsetHeight / 2
        : py > el.offsetTop + el.offsetHeight || (py >= el.offsetTop && px > el.offsetLeft + el.offsetWidth / 2)
    return { zone, index: others.filter(passed).length }
  }

  const press = (id: string, zone: RoomZone) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    const el = e.currentTarget
    const start = { x: e.clientX, y: e.clientY }
    let dragging = false
    let wasEditing = editing
    swallowClick.current = false
    const timer = wasEditing
      ? undefined
      : window.setTimeout(() => {
          wasEditing = true
          swallowClick.current = true
          setEditing(true)
        }, LONG_PRESS)

    const move = (m: PointerEvent) => {
      if (m.pointerId !== e.pointerId) return
      const far = Math.hypot(m.clientX - start.x, m.clientY - start.y) > 5
      if (!wasEditing) {
        if (far) window.clearTimeout(timer)
        return
      }
      if (!dragging && far) {
        dragging = true
        swallowClick.current = true
        const box = el.getBoundingClientRect()
        setDrag({
          id,
          zone,
          x: m.clientX,
          y: m.clientY,
          offsetX: start.x - box.left,
          offsetY: start.y - box.top,
          width: box.width,
        })
      }
      if (!dragging) return
      m.preventDefault()
      const ghost = ghostRef.current
      if (ghost) ghost.style.translate = `${m.clientX}px ${m.clientY}px`
      const to = dropAt(id, m.clientX, m.clientY)
      if (!to) return
      const now = orderRef.current
      const next = moveRoom(now, id, to.zone, to.index)
      if (next.main.join() !== now.main.join() || next.minor.join() !== now.minor.join()) {
        orderRef.current = next
        setSaved(next)
        setDrag((d) => d && { ...d, zone: to.zone })
      }
    }
    const end = (u: PointerEvent) => {
      if (u.pointerId !== e.pointerId) return
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (dragging) {
        saveRoomOrder(orderRef.current)
        setDrag(undefined)
      }
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const click = (id: string) => {
    if (swallowClick.current) {
      swallowClick.current = false
      return
    }
    if (!editing) onRoom(id)
  }

  const item = (id: string, zone: RoomZone) => {
    const r = byId.get(id)!
    return (
      <button
        key={id}
        data-room={id}
        className={zone === 'main' ? 'room-row' : 'room-other'}
        data-dragging={drag?.id === id || undefined}
        aria-current={room === id ? 'page' : undefined}
        onPointerDown={press(id, zone)}
        onClick={() => click(id)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {zone === 'main' && roomIcon(r.planName)}
        <span className="room-row-label">{r.label}</span>
      </button>
    )
  }

  const dragged = drag && byId.get(drag.id)
  return (
    <nav ref={navRef} className="room-nav float" aria-label="Rooms" data-editing={editing || undefined}>
      <button
        className="room-edit"
        aria-label={editing ? 'Done' : 'Edit rooms'}
        title={editing ? 'Done' : 'Edit rooms'}
        aria-pressed={editing}
        onClick={() => setEditing(!editing)}
      >
        {editing ? (
          <span className="room-edit-done">
            <Check size={12} strokeWidth={3} />
          </span>
        ) : (
          <Pencil size={14} />
        )}
      </button>
      <div className="room-list" data-zone="main">
        {order.main.map((id) => item(id, 'main'))}
      </div>
      {(order.minor.length > 0 || editing) && (
        <div className="room-others" role="group" aria-label="Other spaces" data-zone="minor">
          {order.minor.map((id) => item(id, 'minor'))}
        </div>
      )}
      {drag &&
        dragged &&
        createPortal(
          <div
            ref={ghostRef}
            className="room-ghost float"
            style={{
              width: drag.zone === 'main' ? drag.width : undefined,
              translate: `${drag.x}px ${drag.y}px`,
              margin: `${-drag.offsetY}px 0 0 ${-drag.offsetX}px`,
            }}
          >
            <span className={drag.zone === 'main' ? 'room-row' : 'room-other'}>
              {drag.zone === 'main' && roomIcon(dragged.planName)}
              <span className="room-row-label">{dragged.label}</span>
            </span>
          </div>,
          document.body,
        )}
    </nav>
  )
}
