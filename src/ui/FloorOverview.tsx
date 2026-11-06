import { Fragment } from 'react'
import type { LightState } from '../devices/lights'
import type { ShadeState } from '../devices/shades'
import type { SmartItem } from '../rooms/roomItems'
import { RoomScenes } from './RoomScenes'
import { AllLights, SmartRows } from './SmartList'

type FloorOverviewProps = {
  /** The items in view, with the room each is in. */
  items: (SmartItem & { room: string | undefined })[]
  /** A room's name, for the items in it. */
  roomName: (item: SmartItem & { room: string | undefined }) => string | undefined
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
  onOpen: (id: string) => void
  onHover: (id: string | undefined) => void
  hovered: string | undefined
}

/** Between rooms: the floor's lights over its shades, each room by room, with what isn't in a room first, as outside. */
export const FloorOverview = ({ items, roomName, ...rows }: FloorOverviewProps) => {
  const byRoom = (list: FloorOverviewProps['items']) => {
    // In the floor's order, so both cards run the same way.
    const names = [...new Set(items.map(roomName))].filter((n) => list.some((i) => roomName(i) === n))
    return [...names.filter((n) => !n), ...names.filter((n) => n)].map((name) => (
      <Fragment key={name ?? ''}>
        <h4 className="smart-room">{name ?? 'Outside'}</h4>
        <SmartRows items={list.filter((i) => roomName(i) === name)} {...rows} />
      </Fragment>
    ))
  }
  const shades = items.filter((i) => i.kind === 'blind')
  const rest = items.filter((i) => i.kind !== 'blind')
  const lightIds = items.filter((i) => i.kind === 'light').map((i) => i.id)
  return (
    <div className="room-cards" data-floor>
      {rest.length > 0 && (
        <section className="room-card float">
          <div className="smart-card-body">
            {lightIds.length > 0 && (
              <RoomScenes
                scenes={[]}
                ids={lightIds}
                light={rows.light}
                onLight={rows.onLight}
                shade={rows.shade}
                onShade={rows.onShade}
                end={<AllLights ids={lightIds} light={rows.light} onLight={rows.onLight} />}
              />
            )}
            {byRoom(rest)}
          </div>
        </section>
      )}
      {shades.length > 0 && (
        <section className="room-card float">
          <div className="smart-card-body">{byRoom(shades)}</div>
        </section>
      )}
    </div>
  )
}
