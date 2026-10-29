import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { FurnitureItem } from '../data/types'
import type { Floor } from '../layout/types'
import { roomPose } from '../rooms/roomViews'

const FLIGHT_SECONDS = 1.1
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** The room's camera: it glides in from where the camera was, then turns all round the room, always looking at it. */
export const RoomCamera = ({
  floor,
  roomId,
  furniture,
  from,
}: {
  floor: Floor
  roomId: string
  /** Its tall pieces are kept out of the foreground. */
  furniture: FurnitureItem[]
  from?: { position: Vector3; target: Vector3 }
}) => {
  const size = useThree((s) => s.size)
  // The furniture as it was when the room was picked: moving a piece in it doesn't move the camera.
  const [placed, setPlaced] = useState({ roomId, furniture })
  if (placed.roomId !== roomId) setPlaced({ roomId, furniture })
  const pose = useMemo(
    () => roomPose(floor, roomId, size.width / size.height, placed.furniture),
    [floor, roomId, size, placed.furniture],
  )
  const [firstPosition] = useState(() => pose?.position.toArray())
  const start = useRef(from)
  const t = useRef(from ? 0 : 1)
  // The pose the camera is flying to or resting at; another room picked flies over from wherever it is now.
  const heading = useRef(pose)
  const look = useMemo(() => new Vector3(), [])
  const controls = useRef<OrbitControlsImpl>(null)
  const [flying, setFlying] = useState(!!from)
  const reach = pose ? pose.position.distanceTo(pose.target) : 1
  useFrame(({ camera, invalidate }, delta) => {
    if (!pose) return
    if (heading.current !== pose) {
      const wasFlying = t.current < 1
      start.current = {
        position: camera.position.clone(),
        target: (wasFlying || !controls.current ? look : controls.current.target).clone(),
      }
      heading.current = pose
      t.current = 0
      setFlying(true)
    }
    if (t.current >= 1) return
    // The first frame after the view sat still carries all the time it sat, which would skip the flight.
    t.current = Math.min(1, t.current + Math.min(delta, 1 / 30) / FLIGHT_SECONDS)
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
      <PerspectiveCamera makeDefault fov={45} near={0.1} far={200} position={firstPosition} />
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
