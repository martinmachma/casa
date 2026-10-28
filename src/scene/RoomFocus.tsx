import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { Floor, Point } from '../layout/types'
import { hull, roomPose } from '../rooms/roomViews'

const FLIGHT_SECONDS = 1.1
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** A fixed camera on the room: it glides in from where the camera was, then stays put. */
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
  useFrame(({ camera, invalidate }, delta) => {
    if (!pose) return
    t.current = Math.min(1, t.current + delta / FLIGHT_SECONDS)
    const s = start.current
    const k = ease(t.current)
    if (s && k < 1) {
      invalidate()
      camera.position.lerpVectors(s.position, pose.position, k)
      look.lerpVectors(s.target, pose.target, k)
    } else {
      camera.position.copy(pose.position)
      look.copy(pose.target)
    }
    camera.lookAt(look)
  })
  return <PerspectiveCamera makeDefault fov={45} near={0.1} far={200} position={pose?.position.toArray()} />
}

/** A point in the room to pin a DOM element to, such as a smart item's popover. */
export type Pin = { key: string; at: [number, number, number] }

type FocusProjectorProps = {
  floor: Floor
  roomId: string
  /** Gets a clip path leaving the room's outline clear, so the blur covers only the rest. */
  mask: RefObject<HTMLDivElement | null>
  pins: Pin[]
  pinRefs: RefObject<Map<string, HTMLElement | null>>
}

/** Keeps the blur's hole over the room and the pinned elements over their items as the camera moves. */
export const FocusProjector = ({ floor, roomId, mask, pins, pinRefs }: FocusProjectorProps) => {
  const corners = useMemo(() => {
    const pose = roomPose(floor, roomId, 1)
    if (!pose) return []
    const { min, max } = pose.box
    const ys = [floor.elevation, floor.elevation + floor.height]
    return ys.flatMap((y) => [min, [max[0], min[1]], max, [min[0], max[1]]].map(([x, z]) => new Vector3(x, y, z)))
  }, [floor, roomId])
  const v = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    const screen = (p: Vector3): Point => {
      v.copy(p).project(camera)
      return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height]
    }
    const el = mask.current
    if (el && corners.length) {
      const hole = hull(corners.map(screen))
      const r = (n: number) => n.toFixed(1)
      el.style.setProperty(
        'clip-path',
        `path(evenodd, "M0 0H${size.width}V${size.height}H0Z M${hole.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}Z")`,
      )
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
