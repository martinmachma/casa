import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Floor } from '../layout/types'
import { roomPose } from '../rooms/roomViews'

const FLIGHT_SECONDS = 1.1
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** The room's camera: it glides in from where the camera was, then turns all round the room, always looking at it. */
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
          minPolarAngle={0.15}
          maxPolarAngle={1.3}
          minDistance={reach * 0.5}
          maxDistance={reach * 1.5}
        />
      )}
    </>
  )
}

/** A point in the room to pin a DOM element to, such as a smart item's popover. */
export type Pin = { key: string; at: [number, number, number] }

type FocusProjectorProps = {
  pins: Pin[]
  pinRefs: RefObject<Map<string, HTMLElement | null>>
}

/** Keeps the pinned elements over their items as the camera moves. */
export const FocusProjector = ({ pins, pinRefs }: FocusProjectorProps) => {
  const v = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    // The camera may have just been moved this frame, before the render brings its matrices up to date.
    camera.updateMatrixWorld()
    for (const pin of pins) {
      const pinEl = pinRefs.current.get(pin.key)
      if (!pinEl) continue
      v.set(...pin.at).project(camera)
      pinEl.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
    }
  })
  return null
}
