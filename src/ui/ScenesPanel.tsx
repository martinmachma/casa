import { ChevronRight, Moon, Play, Plus } from 'lucide-react'
import { sceneCount, sceneHas, type Scene, sceneSummary } from '../devices/scenes'
import type { PlacedItem } from '../rooms/roomItems'
import { IconButton, Section } from './kit'

/** The rooms a scene reaches, the first two by name. */
const roomsText = (names: (string | undefined)[]) => {
  const rooms = [...new Set(names.filter(Boolean))]
  return rooms.length > 2 ? `${rooms.slice(0, 2).join(', ')} +${rooms.length - 2}` : rooms.join(', ')
}

type NightButtonProps = { night: boolean; onNight: () => void }

/** Shows the house after dark, where a scene's lights can be seen, until it's pressed again. */
export const NightButton = ({ night, onNight }: NightButtonProps) => (
  <IconButton
    label={night ? 'Back to the light before' : 'See it at night'}
    small
    aria-pressed={night}
    onClick={onNight}
  >
    <Moon size={15} />
  </IconButton>
)

type ScenesPanelProps = NightButtonProps & {
  scenes: Scene[]
  /** What a scene can set, in the house as it is. */
  items: PlacedItem[]
  roomName: (item: PlacedItem) => string | undefined
  /** Opens a scene in the editor; none for a new one. */
  onOpen: (scene: Scene | undefined) => void
  /** The scene pointed at, shown in the view. */
  onPreview: (id: string | undefined) => void
  /** Runs a scene from the phone's list, including those hidden from its quick row. */
  onApply?: (scene: Scene) => void
}

/** The house's scenes, each showing in the view while pointed at. */
export const ScenesPanel = ({
  scenes,
  items,
  roomName,
  onOpen,
  onPreview,
  onApply,
  night,
  onNight,
}: ScenesPanelProps) => (
  <>
    <Section title="Scenes" aside={<NightButton night={night} onNight={onNight} />}>
      {scenes.length > 0 ? (
        <ul className="scene-list">
          {scenes.map((scene) => {
            const rooms = roomsText(items.filter((i) => sceneHas(scene, i.id)).map(roomName))
            return (
              <li key={scene.id} className={onApply ? 'phone-editor-scene' : undefined}>
                <button
                  className="scene-list-item"
                  onClick={() => onOpen(scene)}
                  onPointerEnter={() => onPreview(scene.id)}
                  onPointerLeave={() => onPreview(undefined)}
                >
                  <span className="scene-list-text">
                    <span className="smart-row-name">{scene.name}</span>
                    <span className="muted">
                      {sceneSummary(sceneCount(scene, items))}
                      {rooms && ` · ${rooms}`}
                    </span>
                  </span>
                  <ChevronRight size={16} aria-hidden />
                </button>
                {onApply && (
                  <IconButton label={`Run ${scene.name}`} onClick={() => onApply(scene)}>
                    <Play size={16} />
                  </IconButton>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="hint">No scenes yet. A scene sets any lights and shades in the house with one tap.</p>
      )}
    </Section>
    <div className="panel-foot">
      <button className="btn btn-block" onClick={() => onOpen(undefined)}>
        <Plus size={16} />
        New scene
      </button>
    </div>
  </>
)
