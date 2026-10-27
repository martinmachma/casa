import { floorBounds } from '../layout/geometry'
import type { Floor, Roof as RoofLayout } from '../layout/types'
import { COPING, DEFAULT_WALL, ROOF } from './palette'

const SLAB = 0.3
const PARAPET = 0.2
const CAP = 0.04
/** How far the chimney stands above the parapet. */
const STACK = 0.6

const noRaycast = () => null

type Box = { at: [number, number, number]; size: [number, number, number]; color: string }

/** The flat roof over the top floor: the slab, a parapet round its edge and the chimney. */
export const Roof = ({ roof, floor }: { roof: RoofLayout; floor: Floor }) => {
  const { min, max } = floorBounds(floor)
  const w = max[0] - min[0]
  const d = max[1] - min[1]
  const cx = (min[0] + max[0]) / 2
  const cz = (min[1] + max[1]) / 2
  const top = floor.elevation + floor.height
  const deck = top + SLAB
  const rimY = deck + roof.parapet / 2
  // The east and west parapets run the full depth; north and south fit between them.
  const rims: Box[] = [
    { at: [min[0] + PARAPET / 2, rimY, cz], size: [PARAPET, roof.parapet, d], color: DEFAULT_WALL },
    { at: [max[0] - PARAPET / 2, rimY, cz], size: [PARAPET, roof.parapet, d], color: DEFAULT_WALL },
    { at: [cx, rimY, min[1] + PARAPET / 2], size: [w - 2 * PARAPET, roof.parapet, PARAPET], color: DEFAULT_WALL },
    { at: [cx, rimY, max[1] - PARAPET / 2], size: [w - 2 * PARAPET, roof.parapet, PARAPET], color: DEFAULT_WALL },
  ]
  const capY = deck + roof.parapet + CAP / 2
  const caps: Box[] = rims.map((r) => ({
    at: [r.at[0], capY, r.at[2]],
    size: [r.size[0] + 0.04, CAP, r.size[2] + 0.04],
    color: COPING,
  }))
  const boxes: Box[] = [
    { at: [cx, top + SLAB / 2, cz], size: [w, SLAB, d], color: DEFAULT_WALL },
    // The membrane on the deck, between the parapets.
    { at: [cx, deck + 0.01, cz], size: [w - 2 * PARAPET, 0.02, d - 2 * PARAPET], color: ROOF },
    ...rims,
    ...caps,
  ]
  const chimney = roof.chimney
  if (chimney) {
    const stackTop = deck + roof.parapet + STACK
    boxes.push({
      at: [(chimney.x0 + chimney.x1) / 2, (top + stackTop) / 2, (chimney.y0 + chimney.y1) / 2],
      size: [chimney.x1 - chimney.x0, stackTop - top, chimney.y1 - chimney.y0],
      color: DEFAULT_WALL,
    })
  }

  return (
    <group>
      {boxes.map((b, i) => (
        <mesh key={i} position={b.at} receiveShadow raycast={noRaycast}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}
