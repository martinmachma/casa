import { GripVertical } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Order } from '../lib/order'

type PhoneOrderProps = {
  order: Order
  /** The name shown for each id. */
  name: (id: string) => string | undefined
  /** The headings over the ones up front and over the rest. */
  main: string
  minor: string
  hint: string
  onSave: (order: Order) => void
}

/**
 * A phone's list for putting a menu in order: each row dragged by its grip up and down, and across the line between
 * the ones up front and the rest, as the desktop room list does.
 */
export const PhoneOrder = ({ order: saved, name, main, minor, hint, onSave }: PhoneOrderProps) => {
  // The order while a row is being dragged, saved once it's dropped.
  const [moving, setMoving] = useState<Order>()
  const [dragged, setDragged] = useState<string>()
  const list = useRef<HTMLDivElement>(null)
  // The row in hand and where it's got to.
  const held = useRef<{ id: string; order?: Order }>(undefined)
  const order = moving ?? saved

  // Where the pointer is among the other rows decides where the dragged one goes; the line between the ones up front
  // and the rest is a row too. Kept in a ref as well, as a quick drag can end before React has drawn it.
  const drag = (y: number) => {
    const h = held.current
    if (!h || !list.current) return
    const id = h.id
    const now = h.order ?? order
    const flat = [...now.main, '', ...now.minor].filter((r) => r !== id)
    const rows = [...list.current.querySelectorAll<HTMLElement>('[data-slot]')].filter((el) => el.dataset.slot !== id)
    const at = rows.filter((el) => {
      const box = el.getBoundingClientRect()
      return box.top + box.height / 2 < y
    }).length
    flat.splice(at, 0, id)
    const split = flat.indexOf('')
    h.order = { main: flat.slice(0, split), minor: flat.slice(split + 1) }
    setMoving(h.order)
  }
  const drop = (y: number) => {
    drag(y)
    if (held.current?.order) onSave(held.current.order)
    held.current = undefined
    setMoving(undefined)
    setDragged(undefined)
  }

  const slot = (id: string) => {
    const label = name(id)
    if (label === undefined) return null
    return (
      <div key={id} className="phone-order-slot" data-slot={id} data-dragged={dragged === id || undefined}>
        {label}
        <span
          className="phone-order-grip"
          aria-label={`Move ${label}`}
          onPointerDown={(e) => {
            list.current?.setPointerCapture(e.pointerId)
            held.current = { id }
            setDragged(id)
            e.preventDefault()
          }}
        >
          <GripVertical size={16} />
        </span>
      </div>
    )
  }

  return (
    <div
      ref={list}
      className="phone-order"
      onPointerMove={(e) => drag(e.clientY)}
      onPointerUp={(e) => drop(e.clientY)}
      onPointerCancel={(e) => drop(e.clientY)}
    >
      <h3>{main}</h3>
      {order.main.map(slot)}
      <h3 data-slot="">{minor}</h3>
      {order.minor.map(slot)}
      <p className="hint">{hint}</p>
    </div>
  )
}
