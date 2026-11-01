import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { FurnitureItem } from '../data/types'
import type { Floor } from '../layout/types'
import { roomPose } from '../rooms/roomViews'

const FLIGHT_SECONDS = 1.1
/** How far from an opened item the camera comes in to. */
const CLOSE_UP = 2.2
/** Further back from one looked at from a given way (a window's shade), to take in the whole window. */
const CLOSE_UP_FACING = 4.2
const FOV = 45
/** Looking at an item from a given way, how far the camera rises for each metre it stands back. */
const FACING_RISE = 0.15
/** An opened item's card: how far right of the item it starts, and how wide it is. */
const CARD = { left: 98, width: 260 }
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** The room's camera: it glides in from where the camera was, then turns all round the room, always looking at it. */
export const RoomCamera = ({
  floor,
  roomId,
  furniture,
  closeUp,
  from,
  onView,
}: {
  floor: Floor
  roomId: string
  /** Its tall pieces are kept out of the foreground. */
  furniture: FurnitureItem[]
  /** An opened item to come in close to, from the room's side of it (or from `facing`); the camera holds still there. */
  closeUp?: Pin
  from?: { position: Vector3; target: Vector3 }
  /** Where it is and looks each frame, for the house's camera to carry on from after the room. */
  onView?: (position: Vector3, target: Vector3) => void
}) => {
  const size = useThree((s) => s.size)
  // The furniture as it was when the room was picked: moving a piece in it doesn't move the camera.
  const [placed, setPlaced] = useState({ roomId, furniture })
  if (placed.roomId !== roomId) setPlaced({ roomId, furniture })
  const roomView = useMemo(
    () => roomPose(floor, roomId, size.width / size.height, placed.furniture),
    [floor, roomId, size, placed.furniture],
  )
  const [cx, cy, cz] = closeUp?.at ?? []
  const [fx, fz] = closeUp?.facing ?? []
  const pose = useMemo(() => {
    if (!roomView || cx === undefined) return roomView
    const item = new Vector3(cx, cy, cz)
    const back =
      fx === undefined ? roomView.position.clone().sub(item).normalize() : new Vector3(fx, FACING_RISE, fz).normalize()
    const distance = fx === undefined ? CLOSE_UP : CLOSE_UP_FACING
    // Seen from a given way, the item is in the middle, its controls beside it.
    if (fx !== undefined) return { ...roomView, position: item.clone().addScaledVector(back, distance), target: item }
    // The item sits left of its card, which ends up in the middle of the screen.
    const right = new Vector3(0, 1, 0).cross(back).normalize()
    const up = back.clone().cross(right)
    const perPixel = (2 * distance * Math.tan(((FOV / 2) * Math.PI) / 180)) / size.height
    const dx = Math.max(16, (size.width - CARD.width) / 2 - CARD.left) - size.width / 2
    // The line rises 22px to the card's middle.
    const dy = 22
    const target = item.addScaledVector(right, -dx * perPixel).addScaledVector(up, dy * perPixel)
    return { ...roomView, position: target.clone().addScaledVector(back, distance), target }
  }, [roomView, cx, cy, cz, fx, fz, size])
  const [firstPosition] = useState(() => pose?.position.toArray())
  const start = useRef(from)
  const t = useRef(from ? 0 : 1)
  // The pose the camera is flying to or resting at; another room picked flies over from wherever it is now.
  const heading = useRef(pose)
  const look = useMemo(() => new Vector3(), [])
  const controls = useRef<OrbitControlsImpl>(null)
  const [flying, setFlying] = useState(!!from)
  // Off from the render that changes the pose, or the controls would turn the camera to the new target first.
  const [aimed, setAimed] = useState(pose)
  if (aimed !== pose) {
    setAimed(pose)
    setFlying(true)
  }
  const reach = pose ? pose.position.distanceTo(pose.target) : 1
  useFrame(({ camera, invalidate }, delta) => {
    if (!pose) return
    // The controls take the new pose's target as soon as it's set, so the flight starts from where it last looked.
    if (heading.current !== pose) {
      start.current = { position: camera.position.clone(), target: look.clone() }
      heading.current = pose
      t.current = 0
    }
    if (t.current >= 1) {
      if (controls.current) look.copy(controls.current.target)
      onView?.(camera.position, look)
      return
    }
    // The first frame after the view sat still carries all the time it sat, which would skip the flight.
    t.current = Math.min(1, t.current + Math.min(delta, 1 / 30) / FLIGHT_SECONDS)
    const s = start.current
    const k = ease(t.current)
    invalidate()
    camera.position.lerpVectors(s?.position ?? pose.position, pose.position, k)
    look.lerpVectors(s?.target ?? pose.target, pose.target, k)
    camera.lookAt(look)
    onView?.(camera.position, look)
    if (k >= 1) setFlying(false)
  })
  return (
    <>
      <PerspectiveCamera makeDefault fov={FOV} near={0.1} far={200} position={firstPosition} />
      {pose && (
        <OrbitControls
          ref={controls}
          makeDefault
          enabled={!flying && !closeUp}
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
export type Pin = { key: string; at: [number, number, number]; facing?: [number, number] }

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
