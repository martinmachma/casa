import { Fragment } from 'react'
import type { LightState } from '../devices/lights'
import type { Scene } from '../devices/scenes'
import type { ShadeState } from '../devices/shades'
import { itemsTitle, type SmartItem } from '../rooms/roomItems'
import { RoomScenes } from './RoomScenes'
import { SmartCard, SmartRows } from './SmartList'

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
  scenes: Scene[]
  /** Every item in the house: a scene here is on when all it sets is as it says, not just what's in view. */
  sceneIds: string[]
}

/** Between rooms: the floor's scenes over its lights over its shades, each room by room, with what isn't in a room first, as outside. */
export const FloorOverview = ({ items, roomName, scenes, sceneIds, ...rows }: FloorOverviewProps) => {
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
  return (
    <div className="room-cards" data-floor>
      <RoomScenes
        scenes={scenes}
        ids={sceneIds}
        light={rows.light}
        onLight={rows.onLight}
        shade={rows.shade}
        onShade={rows.onShade}
      />
      {rest.length > 0 && <SmartCard title={itemsTitle(rest)}>{byRoom(rest)}</SmartCard>}
      {shades.length > 0 && <SmartCard title="Shades">{byRoom(shades)}</SmartCard>}
    </div>
  )
}
