import { Check, ChevronUp, List, X } from 'lucide-react'
import { useState } from 'react'
import type { LightState } from '../devices/lights'
import type { Scene } from '../devices/scenes'
import type { ShadeState } from '../devices/shades'
import type { Floor } from '../layout/types'
import { itemsTitle, type SmartItem } from '../rooms/roomItems'
import type { RoomView } from '../rooms/roomViews'
import { IconButton } from './kit'
import { LightControls } from './LightControls'
import { ordinal } from './ordinal'
import { SceneChips } from './RoomScenes'
import { ShadeControls } from './ShadeControls'
import { SmartRows } from './SmartList'

type PhoneHomeProps = {
  floors: Floor[]
  floorIndex: number
  onFloor: (index: number) => void
  /** Looking at the whole house from outside instead of one floor. */
  outside: boolean
  onOutside: () => void
  /** Every room, in the order they're listed. */
  rooms: RoomView[]
  /** The room being looked at on its own, if any. */
  room: RoomView | undefined
  onRoom: (id: string) => void
  /** Out of the room, back to its whole floor. */
  onLeave: () => void
  /** The rooms with lights, and whether any is on. */
  lit: Map<string, boolean>
  scenes: Scene[]
  /** Every item in the house: a scene is on when all it sets is as it says. */
  sceneIds: string[]
  /** What's in the room, for its list. */
  items: SmartItem[]
  /** The item whose card is open. */
  open: SmartItem | undefined
  onOpen: (id: string | undefined) => void
  onHover: (id: string | undefined) => void
  hovered: string | undefined
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
}

type Menu = 'floor' | 'room' | 'list'

/**
 * Home on a phone: the floor and the room picked from two menus at the bottom, the scenes floating over them, an item's
 * card in their place while it's open, and everything in the room in a sheet.
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
  sceneIds,
  items,
  open,
  onOpen,
  onHover,
  hovered,
  light,
  onLight,
  shade,
  onShade,
}: PhoneHomeProps) => {
  const [menu, setMenu] = useState<Menu>()
  const toggle = (next: Menu) => setMenu(menu === next ? undefined : next)
  const pick = (go: () => void) => () => {
    setMenu(undefined)
    go()
  }
  const floorLit = (floor: Floor) => rooms.some((r) => r.floor === floor.id && lit.get(r.room))
  const here = outside ? undefined : floors[floorIndex]
  // From outside the menu has every room, under its floor.
  const roomFloors = here ? [here] : floors
  const dot = (on: boolean | undefined) => <i className="phone-dot" data-on={on || undefined} />
  const list = room && menu === 'list'

  return (
    <>
      {menu && <div className="phone-scrim" onClick={() => setMenu(undefined)} />}

      {open ? (
        <div className="phone-card float" role="dialog" aria-label={open.name}>
          <div className="phone-card-head">
            <h2>{open.name}</h2>
            <IconButton label="Close" small onClick={() => onOpen(undefined)}>
              <X size={16} />
            </IconButton>
          </div>
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
        <div className="phone-over">
          <SceneChips
            scenes={scenes}
            ids={sceneIds}
            light={light}
            onLight={onLight}
            shade={shade}
            onShade={onShade}
            className="float"
          />
          {room && items.length > 0 && (
            <IconButton label="Everything in the room" className="float phone-list-btn" onClick={() => toggle('list')}>
              <List size={18} />
            </IconButton>
          )}
        </div>
      )}

      {menu === 'floor' && (
        <div className="phone-menu phone-menu-floor float" role="menu" aria-label="Floor">
          <button role="menuitem" aria-current={outside || undefined} onClick={pick(onOutside)}>
            {dot(floors.some(floorLit))}
            <b>Whole house</b>
            {outside && <Check size={16} />}
          </button>
          {floors.map((f, i) => (
            <button key={f.id} role="menuitem" aria-current={f === here || undefined} onClick={pick(() => onFloor(i))}>
              {dot(floorLit(f))}
              <b>{ordinal(i + 1)} floor</b>
              {f === here && <Check size={16} />}
            </button>
          ))}
        </div>
      )}

      {menu === 'room' && (
        <div className="phone-menu phone-menu-room float" role="menu" aria-label="Room">
          {here && (
            <button role="menuitem" aria-current={!room || undefined} onClick={pick(onLeave)}>
              {dot(false)}
              <b>All of the {ordinal(floorIndex + 1)} floor</b>
              {!room && <Check size={16} />}
            </button>
          )}
          {roomFloors.map((f) => (
            <div key={f.id} className="phone-menu-group">
              {!here && <h3>{ordinal(floors.indexOf(f) + 1)} floor</h3>}
              {rooms
                .filter((r) => r.floor === f.id)
                .map((r) => (
                  <button
                    key={r.id}
                    role="menuitem"
                    aria-current={r === room || undefined}
                    onClick={pick(() => onRoom(r.id))}
                  >
                    {dot(lit.get(r.room))}
                    <b>{r.label}</b>
                    {r === room && <Check size={16} />}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {list && (
        <div className="phone-sheet" role="dialog" aria-label={itemsTitle(items)}>
          <div className="phone-card-head">
            <h2>{room.label}</h2>
            <IconButton label="Close" small onClick={() => setMenu(undefined)}>
              <X size={16} />
            </IconButton>
          </div>
          <SmartRows
            items={items}
            light={light}
            onLight={onLight}
            shade={shade}
            onShade={onShade}
            onOpen={(id) => pick(() => onOpen(id))()}
            onHover={onHover}
            hovered={hovered}
          />
        </div>
      )}

      <nav className="phone-bar" aria-label="Where">
        <button className="float" aria-expanded={menu === 'floor'} onClick={() => toggle('floor')}>
          <span>{here ? ordinal(floorIndex + 1) : 'House'}</span>
          <ChevronUp size={16} />
        </button>
        <button className="float grow" aria-expanded={menu === 'room'} onClick={() => toggle('room')}>
          <span>{room?.label ?? 'All rooms'}</span>
          <ChevronUp size={16} />
        </button>
      </nav>
    </>
  )
}
