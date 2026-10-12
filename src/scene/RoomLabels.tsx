import { useFrame } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { RoomRegion } from '../layout/rooms'
import type { Floor } from '../layout/types'

// Room names are plain DOM over the canvas, moved every frame to follow their spot on the floor.
// (drei's <Html> occasionally left its first instance empty, so this does the projection itself.)

type LabelRefs = RefObject<(HTMLDivElement | null)[]>

type RoomLabelsProps = { floor: Floor; labels: LabelRefs }

const formatArea = (m2: number) => `${m2.toFixed(1)} m²`

/** The DOM half: render next to the <Canvas>. */
/** "3.62 × 5.10 m" for a rectangular room; L-shaped and other rooms have no single width and depth. */
const roomSize = (region: RoomRegion) => {
  const w = Math.max(...region.cells.map((c) => c.x1)) - Math.min(...region.cells.map((c) => c.x0))
  const d = Math.max(...region.cells.map((c) => c.y1)) - Math.min(...region.cells.map((c) => c.y0))
  return Math.abs(w * d - region.area) < 0.01 * region.area ? `${w.toFixed(2)} × ${d.toFixed(2)} m` : undefined
}

type RoomLabelsDomProps = RoomLabelsProps & { regions: Map<string, RoomRegion>; showSizes: boolean }

export const RoomLabels = ({ floor, labels, regions, showSizes }: RoomLabelsDomProps) => (
  <div className="room-labels" aria-hidden>
    {floor.rooms.map((room, i) => (
      <div
        key={room.id}
        className="room-label"
        ref={(el) => {
          labels.current[i] = el
        }}
      >
        <span className="room-name">{room.name}</span>
        {regions.has(room.id) && <span className="room-area">{formatArea(regions.get(room.id)!.area)}</span>}
        {showSizes && regions.has(room.id) && (
          <span className="room-area">
            {[roomSize(regions.get(room.id)!), `${floor.height.toFixed(2)} m high`].filter(Boolean).join(' · ')}
          </span>
        )}
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
