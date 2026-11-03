import { ChevronRight } from 'lucide-react'
import type { LightState } from '../devices/lights'
import type { SmartItem } from '../rooms/roomItems'
import { SmartCard, SmartRow } from './SmartList'
import { lightsSummary, percent } from './smartText'

type HouseOverviewProps = {
  /** Every smart item in the house, with the room it's in. */
  items: (SmartItem & { room: string | undefined })[]
  /** The rooms in menu order, under their names. */
  rooms: { id: string; label: string }[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  /** Opens a room, with an item's popover open in it. */
  onOpen: (room: string, item?: string) => void
}

/** The whole house at a glance: the lights that are on, and each room with smart items in it. */
export const HouseOverview = ({ items, rooms, light, onLight, onOpen }: HouseOverviewProps) => {
  const lights = items.filter((i) => i.kind === 'light')
  const lit = lights.filter((i) => light(i.id).on)
  const litRooms = new Set(lit.map((i) => i.room)).size
  const label = (room: string | undefined) => rooms.find((r) => r.id === room)?.label
  const withItems = rooms
    .map((r) => ({ ...r, items: items.filter((i) => i.room === r.id) }))
    .filter((r) => r.items.length)
  if (!items.length) return null
  return (
    <div className="room-cards">
      <SmartCard
        title="Whole house"
        summary={
          lit.length
            ? `${lit.length} ${lit.length === 1 ? 'light' : 'lights'} on in ${litRooms} ${litRooms === 1 ? 'room' : 'rooms'}`
            : lightsSummary(0, lights.length)
        }
        allLights={
          lights.length
            ? { on: lit.length > 0, onChange: (to) => lights.forEach((i) => onLight(i.id, { on: to })) }
            : undefined
        }
      >
        {lit.length > 0 && (
          <>
            <h4 className="smart-group">On now</h4>
            <ul className="smart-list">
              {lit.map((item) => (
                <SmartRow
                  key={item.id}
                  item={item}
                  sub={[label(item.room), percent(light(item.id))].filter(Boolean).join(' · ')}
                  light={light(item.id)}
                  onOpen={() => item.room && onOpen(item.room, item.id)}
                  onLight={(p) => onLight(item.id, p)}
                />
              ))}
            </ul>
          </>
        )}
        <h4 className="smart-group">By room</h4>
        <ul className="smart-list">
          {withItems.map((room) => {
            const roomLights = room.items.filter((i) => i.kind === 'light')
            const on = roomLights.filter((i) => light(i.id).on).length
            return (
              <li key={room.id}>
                <button className="smart-room" onClick={() => onOpen(room.id)}>
                  <span className="smart-item-name">{room.label}</span>
                  <span className="muted">
                    {room.items.length} {room.items.length === 1 ? 'item' : 'items'}
                    {roomLights.length > 0 && (on ? ` · ${on} on` : ' · off')}
                  </span>
                  <ChevronRight size={16} aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      </SmartCard>
    </div>
  )
}
