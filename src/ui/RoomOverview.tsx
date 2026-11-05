import { X } from 'lucide-react'
import type { RefObject } from 'react'
import type { LightState } from '../devices/lights'
import type { ShadeState } from '../devices/shades'
import type { Scene } from '../devices/scenes'
import type { SmartItem } from '../rooms/roomItems'
import { IconButton } from './kit'
import { ItemPins } from './ItemPins'
import { NewSceneButton, RoomScenes } from './RoomScenes'
import { AllLights, SmartRows } from './SmartList'

type RoomOverviewProps = {
  title: string
  items: SmartItem[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
  open: string | undefined
  onOpen: (id: string | undefined) => void
  /** The item whose card is pointed at, picked out in the view like the open one. */
  onHover: (id: string | undefined) => void
  /** The item pointed at, here or in the view; its tag and row are picked out. */
  hovered: string | undefined
  /** The open item's popover, moved over its item every frame. */
  pinRefs: RefObject<Map<string, HTMLElement | null>>
  scenes: Scene[]
  onEditScene: (scene: Scene | undefined) => void
  /** A scene is being put together, in the card's place. */
  sceneOpen: boolean
  /** Out of the room, back to its whole floor. */
  onLeave: () => void
}

/** The room's own view: its name over the middle, what's in it on the right, and a popover by the item picked. */
export const RoomOverview = ({
  title,
  items,
  light,
  onLight,
  shade,
  onShade,
  open,
  onOpen,
  onHover,
  hovered,
  pinRefs,
  scenes,
  onEditScene,
  sceneOpen,
  onLeave,
}: RoomOverviewProps) => {
  const lightIds = items.filter((i) => i.kind === 'light').map((i) => i.id)
  const shades = items.filter((i) => i.kind === 'blind')
  const rest = items.filter((i) => i.kind !== 'blind')
  const rows = { light, onLight, shade, onShade, onOpen, onHover, hovered }
  return (
    <>
      <h2 className="room-name float">
        <span className="room-name-text">{title}</span>
        <IconButton label="Leave room (Esc)" small className="room-name-leave" onClick={onLeave}>
          <X size={14} />
        </IconButton>
      </h2>
      {/* An open item has the view to itself. */}
      <div className="room-cards" hidden={!!open || sceneOpen}>
        <NewSceneButton onClick={() => onEditScene(undefined)} />
        {(rest.length > 0 || !shades.length) && (
          <section className="room-card float">
            <div className="smart-card-body">
              {lightIds.length > 0 && (
                <RoomScenes
                  scenes={scenes}
                  onEdit={onEditScene}
                  lightIds={lightIds}
                  light={light}
                  onLight={onLight}
                  end={<AllLights ids={lightIds} light={light} onLight={onLight} />}
                />
              )}
              {rest.length ? (
                <SmartRows items={rest} {...rows} />
              ) : (
                <p className="hint">No smart items here yet. Place them under Planning → Devices.</p>
              )}
            </div>
          </section>
        )}
        {shades.length > 0 && (
          <section className="room-card float">
            <div className="smart-card-body">
              <SmartRows items={shades} {...rows} />
            </div>
          </section>
        )}
      </div>

      <ItemPins
        items={items}
        light={light}
        onLight={onLight}
        shade={shade}
        onShade={onShade}
        open={open}
        onOpen={onOpen}
        onHover={onHover}
        hovered={hovered}
        pinRefs={pinRefs}
      />
    </>
  )
}
