import { useFrame } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import { Vector3 } from 'three'
import { roomLabel } from '../layout/roomName'
import type { Floor } from '../layout/types'

// Room numbers are plain DOM over the canvas, moved every frame to follow their spot on the floor.
// (drei's <Html> occasionally left its first instance empty, so this does the projection itself.)
// The names live in the legend; hovering either one lights up both.

type LabelRefs = RefObject<(HTMLDivElement | null)[]>

type RoomLabelsProps = { floor: Floor; labels: LabelRefs }

type RoomLabelsDomProps = RoomLabelsProps & {
  /** Names we gave rooms, replacing the plan's. */
  names: Map<string, string>
  hovered: string | undefined
  onHover: (roomId: string | undefined) => void
  /** Only while editing. */
  onPick: ((roomId: string) => void) | undefined
}

/** The DOM half: render next to the <Canvas>. */
export const RoomLabels = ({ floor, labels, names, hovered, onHover, onPick }: RoomLabelsDomProps) => (
  <div className="overlay room-labels" data-clickable={onPick ? '' : undefined}>
    {floor.rooms.map((room, i) => {
      const { number, name } = roomLabel(room, names)
      return (
        <div
          key={room.id}
          className="room-label"
          data-active={hovered === room.id ? '' : undefined}
          title={name}
          ref={(el) => {
            labels.current[i] = el
          }}
          onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(room.id)}
          onPointerLeave={() => onHover(undefined)}
          onClick={() => onPick?.(room.id)}
        >
          {number ?? name}
        </div>
      )
    })}
  </div>
)

/** The scene half: render inside the <Canvas>. */
export const RoomLabelProjector = ({ floor, labels }: RoomLabelsProps) => {
  const v = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    floor.rooms.forEach((room, i) => {
      const el = labels.current[i]
      if (!el) return
      v.set(room.label[0], floor.elevation + 0.02, room.label[1]).project(camera)
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
      el.style.visibility = v.z < 1 ? 'visible' : 'hidden'
    })
  })
  return null
}
