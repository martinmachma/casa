import { useFrame } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { Floor } from '../layout/types'

// Room names are plain DOM over the canvas, moved every frame to follow their spot on the floor.
// (drei's <Html> occasionally left its first instance empty, so this does the projection itself.)

type LabelRefs = RefObject<(HTMLDivElement | null)[]>

type RoomLabelsProps = { floor: Floor; labels: LabelRefs }

/** The DOM half: render next to the <Canvas>. */
export const RoomLabels = ({ floor, labels }: RoomLabelsProps) => (
  <div className="room-labels" aria-hidden>
    {floor.rooms.map((room, i) => (
      <div
        key={room.id}
        className="room-label"
        ref={(el) => {
          labels.current[i] = el
        }}
      >
        {room.name}
      </div>
    ))}
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
