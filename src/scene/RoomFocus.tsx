import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { FurnitureItem } from '../data/types'
import type { Floor } from '../layout/types'
import { roomPose } from '../rooms/roomViews'
import { ZOOM_SPEED } from './cameraNudge'
import { blendFocusFraming, focusFraming, type CameraFraming } from './focusFraming'
import { ZoomToSurface } from './ZoomToSurface'

const FLIGHT_SECONDS = 1.1
/** How far from an opened item the camera comes in to. */
const CLOSE_UP = 2.2
/** Further back from one looked at from a given way (a window's shade), to take in the whole window. */
const CLOSE_UP_FACING = 4.2
const FOV = 45
/** Looking at an item from a given way, how far the camera rises for each metre it stands back. */
const FACING_RISE = 0.15
/** How far below a ceiling light the camera comes in to, and how far off straight up it looks. */
const CLOSE_UNDER = 2
const UNDER = 0.9
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** The room's camera: it glides in from where the camera was, then turns all round the room, always looking at it. */
export const RoomCamera = ({
  floor,
  roomId,
  furniture,
  closeUp,
  bottomInset = 0,
  from,
  onView,
}: {
  floor: Floor
  roomId?: string
  /** Its tall pieces are kept out of the foreground. */
  furniture: FurnitureItem[]
  /** An opened item to come in close to, from the way it's best seen; dragging tilts round it. */
  closeUp?: Pin
  /** Bottom of the view covered by the item's controls, in CSS pixels. */
  bottomInset?: number
  from?: { position: Vector3; target: Vector3 }
  /** Where it is and looks each frame, and whether it's still flying, for the house's camera to carry on from. */
  onView?: (position: Vector3, target: Vector3, flying: boolean, framing: CameraFraming) => void
}) => {
  const size = useThree((s) => s.size)
  const inset = closeUp ? bottomInset : 0
  const framing = useMemo(() => focusFraming(size, inset), [size, inset])
  const projection = useRef({
    from: { zoom: 1, offsetY: 0 },
    to: framing,
    current: { zoom: 1, offsetY: 0 },
    t: inset ? 0 : 1,
  })
  // The furniture as it was when the room was picked: moving a piece in it doesn't move the camera.
  const [placed, setPlaced] = useState({ roomId, furniture })
  if (placed.roomId !== roomId) setPlaced({ roomId, furniture })
  const roomView = useMemo(
    () => (roomId ? roomPose(floor, roomId, size, placed.furniture) : undefined),
    [floor, roomId, size, placed.furniture],
  )
  const [cx, cy, cz] = closeUp?.look ?? closeUp?.at ?? []
  const [fx, fz] = closeUp?.facing ?? []
  const mount = closeUp?.mount
  const [origin] = useState(from)
  const pose = useMemo(() => {
    if (cx === undefined) return roomView
    const item = new Vector3(cx, cy, cz)
    // The way the camera came from, level.
    const toward = (roomView?.position ?? origin?.position ?? item.clone().add(new Vector3(0, 1, 2))).clone().sub(item)
    const level = toward.clone().setY(0).normalize()
    // A ceiling light is looked up into from below, tipped a little towards where the camera came from; one seen from
    // a given way (a wall light, a window's shade) square on, a lamp from the side, anything else as the room sees it.
    const back =
      mount === 'ceiling'
        ? level.multiplyScalar(Math.sin(UNDER)).setY(-Math.cos(UNDER))
        : fx !== undefined
          ? new Vector3(fx, FACING_RISE, fz).normalize()
          : mount === 'lamp'
            ? level.setY(FACING_RISE).normalize()
            : toward.normalize()
    const distance = mount === 'ceiling' ? CLOSE_UNDER : closeUp?.look && roomId ? CLOSE_UP_FACING : CLOSE_UP
    // Keep the orbit's pivot on the item; the projection leaves space for its card.
    return { position: item.clone().addScaledVector(back, distance), target: item }
  }, [roomView, roomId, cx, cy, cz, fx, fz, mount, closeUp?.look, origin])
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
  // Close up, dragging only tilts the view up and down round the item, never round behind it.
  const azimuth =
    closeUp && pose ? Math.atan2(pose.position.x - pose.target.x, pose.position.z - pose.target.z) : undefined
  useFrame(({ camera, invalidate }, delta) => {
    if (!pose) return
    const p = projection.current
    if (p.to !== framing) {
      Object.assign(p.from, p.current)
      p.to = framing
      p.t = 0
    }
    if (p.t < 1) {
      p.t = Math.min(1, p.t + Math.min(delta, 1 / 30) / FLIGHT_SECONDS)
      blendFocusFraming(camera, size, p.from, p.to, ease(p.t))
      p.current.zoom = camera.zoom
      p.current.offsetY = camera.view?.offsetY ?? 0
      invalidate()
    }
    // The controls take the new pose's target as soon as it's set, so the flight starts from where it last looked.
    if (heading.current !== pose) {
      start.current = { position: camera.position.clone(), target: look.clone() }
      heading.current = pose
      t.current = 0
    }
    if (t.current >= 1) {
      if (controls.current) look.copy(controls.current.target)
      onView?.(camera.position, look, p.t < 1, p.current)
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
    onView?.(camera.position, look, t.current < 1 || p.t < 1, p.current)
    if (k >= 1) setFlying(false)
    // Ahead of whatever goes by the camera this frame: mounted after it all, this would otherwise run last, and the
    // pins would be placed for one frame with the new camera still at the pose it's flying to.
  }, -1)
  return (
    <>
      <PerspectiveCamera makeDefault fov={FOV} near={0.1} far={200} position={firstPosition} />
      {pose && (
        <OrbitControls
          ref={controls}
          makeDefault
          enabled={!flying}
          target={pose.target.toArray()}
          enablePan={false}
          minPolarAngle={closeUp ? 0.3 : 0.15}
          maxPolarAngle={closeUp ? Math.PI - 0.05 : 1.3}
          minAzimuthAngle={azimuth ?? -Infinity}
          maxAzimuthAngle={azimuth ?? Infinity}
          zoomToCursor
          zoomSpeed={ZOOM_SPEED}
          minDistance={0.2}
          maxDistance={reach * 1.5}
        />
      )}
      {pose && <ZoomToSurface />}
    </>
  )
}

/** A point in the room to pin a DOM element to, such as a smart item's popover. */
export type Pin = {
  key: string
  at: [number, number, number]
  facing?: [number, number]
  /** Where a close-up on it is centred, if not on `at`. */
  look?: [number, number, number]
  /** For a light, how it hangs, which decides the way its close-up looks into it. */
  mount?: 'ceiling' | 'wall' | 'lamp'
}

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
      // New labels start hidden, so a camera switch can't paint them at their unprojected position.
      // Points behind the camera (or outside its depth range) mustn't leave mirrored labels on screen.
      pinEl.style.visibility = v.z >= -1 && v.z <= 1 ? 'visible' : 'hidden'
    }
  })
  return null
}
