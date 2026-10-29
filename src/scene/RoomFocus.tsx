import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState, type RefObject } from 'react'
import { Spherical, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Floor, Point } from '../layout/types'
import { wallThickness } from '../layout/geometry'
import { floorRegions } from '../layout/rooms'
import { hull, roomEdges, roomPose } from '../rooms/roomViews'
import { STUB_HEIGHT } from './CutawayWall'

const FLIGHT_SECONDS = 1.1
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** The room's camera: it glides in from where the camera was, then turns a little round the room but never away from it. */
export const RoomCamera = ({
  floor,
  roomId,
  from,
}: {
  floor: Floor
  roomId: string
  from?: { position: Vector3; target: Vector3 }
}) => {
  const size = useThree((s) => s.size)
  const pose = useMemo(() => roomPose(floor, roomId, size.width / size.height), [floor, roomId, size])
  const start = useRef(from)
  const t = useRef(from ? 0 : 1)
  const look = useMemo(() => new Vector3(), [])
  const controls = useRef<OrbitControlsImpl>(null)
  const [flying, setFlying] = useState(!!from)
  const reach = pose ? pose.position.distanceTo(pose.target) : 1
  // Seen from the south, a little above: up to about 40° round either way, steeper or flatter, nearer or further.
  const pitch = pose ? new Spherical().setFromVector3(pose.position.clone().sub(pose.target)).phi : 0.6
  useFrame(({ camera, invalidate }, delta) => {
    if (!pose || !flying) return
    t.current = Math.min(1, t.current + delta / FLIGHT_SECONDS)
    const s = start.current
    const k = ease(t.current)
    invalidate()
    camera.position.lerpVectors(s?.position ?? pose.position, pose.position, k)
    look.lerpVectors(s?.target ?? pose.target, pose.target, k)
    camera.lookAt(look)
    if (k >= 1) setFlying(false)
  })
  return (
    <>
      <PerspectiveCamera makeDefault fov={45} near={0.1} far={200} position={pose?.position.toArray()} />
      {pose && (
        <OrbitControls
          ref={controls}
          makeDefault
          enabled={!flying}
          target={pose.target.toArray()}
          enablePan={false}
          minAzimuthAngle={-0.7}
          maxAzimuthAngle={0.7}
          minPolarAngle={Math.max(0.15, pitch - 0.4)}
          maxPolarAngle={Math.min(1.25, pitch + 0.35)}
          minDistance={reach * 0.7}
          maxDistance={reach * 1.25}
        />
      )}
    </>
  )
}

/** A point in the room to pin a DOM element to, such as a smart item's popover. */
export type Pin = { key: string; at: [number, number, number] }

type FocusProjectorProps = {
  floor: Floor
  roomId: string
  /** Gets a mask leaving the room clear, so the blur covers only the rest. */
  mask: RefObject<HTMLDivElement | null>
  /** The near walls are cut down, so only their stubs belong to the room. */
  cutaway: boolean
  pins: Pin[]
  pinRefs: RefObject<Map<string, HTMLElement | null>>
}

/** Keeps the blur off the room and the pinned elements over their items as the camera moves. */
export const FocusProjector = ({ floor, roomId, mask, cutaway, pins, pinRefs }: FocusProjectorProps) => {
  // The room as solids: its floor cells, and a box for the wall along each side of its outline.
  // On screen each solid is the hull of its corners, and the room is all of them together.
  const room = useMemo(() => {
    const low = floor.elevation
    const cells = floorRegions(floor).get(roomId)?.cells ?? []
    const floors = cells.map((c) =>
      [
        [c.x0, c.y0],
        [c.x1, c.y0],
        [c.x1, c.y1],
        [c.x0, c.y1],
      ].map(([x, z]) => new Vector3(x, low, z)),
    )
    const walls = roomEdges(floor, roomId).map(({ from, to, out }) => {
      const t = edgeThickness(floor, from, to, out)
      // Run on past the ends by the thickness, to close the corners.
      const along = [Math.abs(out[1]) * t, Math.abs(out[0]) * t]
      const a: Point = [Math.min(from[0], to[0]) - along[0], Math.min(from[1], to[1]) - along[1]]
      const b: Point = [Math.max(from[0], to[0]) + along[0], Math.max(from[1], to[1]) + along[1]]
      const foot: Point[] = [a, b, [b[0] + out[0] * t, b[1] + out[1] * t], [a[0] + out[0] * t, a[1] + out[1] * t]]
      return { from, out, foot }
    })
    return { floors, walls }
  }, [floor, roomId])
  // The room as solids: its floor cells, and a box for the wall along each side of its outline.
  // On screen each solid is the hull of its corners, and the room is all of them together.
  const solids = (eye: Vector3) => {
    const low = floor.elevation
    const walls = room.walls.map(({ from, out, foot }) => {
      // Seen from outside, the wall stands between the camera and the room: cut down to its stub.
      const facing = (eye.x - from[0]) * out[0] + (eye.z - from[1]) * out[1] > 0
      const high = low + (cutaway && facing ? Math.min(STUB_HEIGHT, floor.height) : floor.height)
      return [low, high].flatMap((y) => foot.map(([x, z]) => new Vector3(x, y, z)))
    })
    return [...room.floors, ...walls]
  }
  const v = useMemo(() => new Vector3(), [])
  const shown = useRef('')
  useFrame(({ camera, size }) => {
    // The camera may have just been moved this frame, before the render brings its matrices up to date.
    camera.updateMatrixWorld()
    const screen = (p: Vector3): Point => {
      v.copy(p).project(camera)
      return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height]
    }
    const el = mask.current
    if (el && room.floors.length) {
      const r = (n: number) => n.toFixed(1)
      const holes = solids(camera.position)
        .map(
          (solid) =>
            `M${hull(solid.map(screen))
              .map(([x, y]) => `${r(x)} ${r(y)}`)
              .join('L')}Z`,
        )
        .join('')
      // Painted shapes add up where they overlap, which a clip path's fill rules can't do; the SVG's
      // own mask turns the painting into the see-through holes the CSS mask needs.
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">` +
        `<mask id="m"><rect width="100%" height="100%" fill="white"/><path d="${holes}" fill="black"/></mask>` +
        `<rect width="100%" height="100%" mask="url(#m)"/></svg>`
      const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
      if (shown.current !== holes) {
        shown.current = holes
        el.style.setProperty('mask-image', url)
        el.style.setProperty('-webkit-mask-image', url)
      }
    }
    for (const pin of pins) {
      const pinEl = pinRefs.current.get(pin.key)
      if (!pinEl) continue
      const [x, y] = screen(v.set(...pin.at))
      pinEl.style.transform = `translate(${x}px, ${y}px)`
    }
  })
  return null
}

/** How thick the wall along a side of a room is: the one whose face runs along it. */
const edgeThickness = (floor: Floor, from: Point, to: Point, out: Point) => {
  const axis = out[0] ? 0 : 1
  const line = from[axis]
  const lo = Math.min(from[1 - axis], to[1 - axis])
  const hi = Math.max(from[1 - axis], to[1 - axis])
  const wall = floor.walls.find((w) => {
    if (Math.abs(w.from[axis] - w.to[axis]) > 1e-6) return false
    const t = wallThickness(w, floor)
    const span = [Math.min(w.from[1 - axis], w.to[1 - axis]), Math.max(w.from[1 - axis], w.to[1 - axis])]
    return Math.abs(w.from[axis] - (line + (out[axis] * t) / 2)) < 0.02 && span[0] < hi && span[1] > lo
  })
  return wall ? wallThickness(wall, floor) : floor.wallThickness
}
