import { Fragment } from 'react'
import type { LightState } from '../devices/lights'
import type { ShadeState } from '../devices/shades'
import type { SmartItem } from '../rooms/roomItems'
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

/** Between rooms: everything on the floor, room by room, with what isn't in a room first. */
export const FloorOverview = ({ items, roomName, ...rows }: FloorOverviewProps) => {
  const names = [...new Set(items.map(roomName))]
  const groups = [...names.filter((n) => !n), ...names.filter((n) => n)].map((name) => ({
    name,
    items: items.filter((i) => roomName(i) === name),
  }))
  const lightIds = items.filter((i) => i.kind === 'light').map((i) => i.id)
  return (
    <div className="room-cards" data-floor>
      <section className="room-card float">
        <div className="smart-card-body">
          {lightIds.length > 0 && (
            <div className="smart-scenes">
              <div className="smart-scene-chips">
                <AllLights ids={lightIds} light={rows.light} onLight={rows.onLight} />
              </div>
            </div>
          )}
          {groups.map(({ name, items }) => (
            <Fragment key={name ?? ''}>
              {name && <h4 className="smart-room">{name}</h4>}
              <SmartRows items={items} {...rows} />
            </Fragment>
          ))}
        </div>
      </section>
    </div>
  )
}
