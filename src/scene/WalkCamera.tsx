import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { PerspectiveCamera as Camera } from 'three'
import type { FurnitureItem } from '../data/types'
import { fixtureSolids } from '../furniture/collision'
import { insidePolygon } from '../layout/geometry'
import { groundLevel } from '../layout/ground'
import type { Floor, Outdoor, Point, Rect } from '../layout/types'
import { isTyping } from '../ui/isTyping'
import { resolveCollisions, solidObstacles, wallObstacles, type Obstacle } from '../walk/collide'
import { stairHeight, stairRuns, type StairRun } from '../walk/stairs'
import { EYE_HEIGHT, STEP_OVER, WALK_RADIUS as RADIUS, type WalkStart } from '../walk/start'
import { heldStep, type CameraNudge } from './cameraNudge'

const WALK_SPEED = 1.4 // m/s
const TURN_SPEED = 1.6 // rad/s
const LOOK_SPEED = 0.9 // rad/s from the buttons
const POINTER_LOOK = 0.005 // rad per pixel the captured mouse moves or a drag covers
const MAX_PITCH = 1.2
// Steps between paving, lawn and slab are eased rather than jumped.
const STEP_EASE = 12 // 1/s

type WalkCameraProps = {
  floor: Floor
  start: WalkStart | undefined
  floors: Floor[]
  onFloorChange: (index: number) => void
  furniture: FurnitureItem[]
  nudge: RefObject<CameraNudge>
  openDoors: ReadonlySet<string>
  /** The garden round the ground floor, walkable within its outline. */
  outdoor?: Outdoor
  /** An open panel or tool wants a real cursor, so the mouse stays free. */
  cursorNeed: boolean
  /** Tells whether the mouse is captured, so the crosshair can show. */
  onCaptured: (captured: boolean) => void
}

/** Refused without a recent click, or just after Esc; a later click tries again. */
const capture = (el: HTMLElement) => void el.requestPointerLock()?.catch(() => {})

const rectObstacle = (r: Rect): Obstacle => ({
  cx: (r.x0 + r.x1) / 2,
  cy: (r.y0 + r.y1) / 2,
  hu: (r.x1 - r.x0) / 2,
  hv: (r.y1 - r.y0) / 2,
  angle: 0,
})

/**
 * First-person camera at eye height: the captured mouse (or a drag, on a touch screen or in Planning) looks around, WASD/arrow keys or the on-screen buttons to walk.
 * Walls block the way except through open doors and passages; furniture does too.
 */
export const WalkCamera = ({
  floor,
  start: entry,
  floors,
  onFloorChange,
  furniture,
  nudge,
  openDoors,
  outdoor,
  cursorNeed,
  onCaptured,
}: WalkCameraProps) => {
  const camera = useRef<Camera>(null)
  const gl = useThree((s) => s.gl)
  const set = useThree((s) => s.set)
  const invalidate = useThree((s) => s.invalidate)
  const setEvents = useThree((s) => s.setEvents)
  const getState = useThree((s) => s.get)
  const cursorNeeded = useRef(cursorNeed)
  const [start] = useState(
    () => entry ?? { floorIndex: floors.indexOf(floor), at: floor.rooms[0]?.label ?? [0, 0], yaw: 0 },
  )
  const pose = useRef({ x: start.at[0], y: start.at[1], yaw: start.yaw, pitch: 0 })
  /** The surface underfoot when not on a stair: the ground floor's slab, paving or lawn, or an upper floor. */
  const surface = (index: number, p: Point) =>
    index === 0 ? groundLevel(floors[0], outdoor, p) : floors[index].elevation
  const startElevation = surface(start.floorIndex, start.at)
  const walking = useRef({
    floorIndex: start.floorIndex,
    elevation: startElevation,
    stair: undefined as StairRun | undefined,
  })
  // The eye follows the elevation, easing over steps.
  const eye = useRef(startElevation)
  const runs = useMemo(() => stairRuns(floors), [floors])
  const solids = useMemo(() => [...furniture, ...floors.flatMap(fixtureSolids)], [furniture, floors])
  const keys = useRef(new Set<string>())
  const step = useRef(0)
  // Stands in for orbit controls: furniture dragging switches it off so the view holds still meanwhile.
  const look = useMemo(() => ({ enabled: true }), [])

  const fixed = useMemo(
    () => (outdoor ? [...outdoor.sheds, ...(outdoor.blocks ?? [])].map(rectObstacle) : []),
    [outdoor],
  )
  const obstacleCache = useRef<{
    elevation: number
    floors: Floor[]
    solids: typeof solids
    openDoors: ReadonlySet<string>
    fixed: Obstacle[]
    obstacles: Obstacle[]
  }>(undefined)
  const obstaclesAt = (elevation: number): Obstacle[] => {
    const previous = obstacleCache.current
    if (
      previous?.elevation === elevation &&
      previous.floors === floors &&
      previous.solids === solids &&
      previous.openDoors === openDoors &&
      previous.fixed === fixed
    )
      return previous.obstacles
    const obstacles = [
      ...floors.flatMap((f) => wallObstacles(f, openDoors, elevation)),
      ...solidObstacles(solids, floors, elevation + STEP_OVER, elevation + EYE_HEIGHT),
      ...fixed,
    ]
    obstacleCache.current = { elevation, floors, solids, openDoors, fixed, obstacles }
    return obstacles
  }

  useEffect(() => {
    set({ controls: look as never })
    return () => set({ controls: null })
  }, [set, look])

  // With the mouse captured it just turns the view and everything aims through the crosshair at the centre.
  useEffect(() => {
    const el = gl.domElement
    const aim = (dx: number, dy: number) => {
      const p = pose.current
      p.yaw += dx * POINTER_LOOK
      p.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p.pitch - dy * POINTER_LOOK))
      invalidate()
    }
    const compute = getState().events.compute
    setEvents({
      compute: (event, state, previous) => {
        if (document.pointerLockElement !== el) return compute?.(event, state, previous)
        state.pointer.set(0, 0)
        state.raycaster.setFromCamera(state.pointer, state.camera)
      },
    })
    const lockChange = () => onCaptured(document.pointerLockElement === el)
    const lockError = () => onCaptured(false)
    let last: { x: number; y: number; id: number } | undefined
    const down = (e: PointerEvent) => {
      // Esc lets the mouse go; a click on the view takes it back. If that's refused, dragging still looks around.
      if (e.pointerType === 'mouse' && !cursorNeeded.current) capture(el)
      last = { x: e.clientX, y: e.clientY, id: e.pointerId }
    }
    const move = (e: PointerEvent) => {
      if (document.pointerLockElement === el) return aim(e.movementX, e.movementY)
      if (!last || e.pointerId !== last.id) return
      // Grab-the-view, like street-view photos: drag left to turn right.
      if (look.enabled) aim(last.x - e.clientX, last.y - e.clientY)
      last = { x: e.clientX, y: e.clientY, id: e.pointerId }
    }
    const up = () => (last = undefined)
    document.addEventListener('pointerlockchange', lockChange)
    document.addEventListener('pointerlockerror', lockError)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      setEvents({ compute })
      document.removeEventListener('pointerlockchange', lockChange)
      document.removeEventListener('pointerlockerror', lockError)
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (document.pointerLockElement === el) document.exitPointerLock()
      onCaptured(false)
    }
  }, [gl, look, invalidate, setEvents, getState, onCaptured])

  // Capture the mouse on arrival and whenever panels close; give it back when one opens.
  useEffect(() => {
    cursorNeeded.current = cursorNeed
    const el = gl.domElement
    if (cursorNeed) {
      if (document.pointerLockElement === el) document.exitPointerLock()
    } else if (matchMedia('(pointer: fine)').matches) capture(el)
  }, [cursorNeed, gl])

  useEffect(() => {
    const held = keys.current
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey) return
      held.add(e.key.toLowerCase())
    }
    const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase())
    const clear = () => held.clear()
    const focus = (e: FocusEvent) => {
      if (isTyping(e.target) || (e.target instanceof Element && e.target.closest('dialog'))) clear()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    window.addEventListener('focusin', focus)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      window.removeEventListener('focusin', focus)
    }
  }, [])

  useFrame(({ invalidate }, delta) => {
    const cam = camera.current
    if (!cam) return
    const p = pose.current
    const k = keys.current
    const n = nudge.current
    const axis = (plus: boolean, minus: boolean) => (plus ? 1 : 0) - (minus ? 1 : 0)
    const forward = n.forward + axis(k.has('w') || k.has('arrowup'), k.has('s') || k.has('arrowdown'))
    const strafe = n.right + axis(k.has('d'), k.has('a'))
    const turn = n.turn + axis(k.has('arrowright'), k.has('arrowleft'))
    const going = !!(forward || strafe || turn || n.tilt)
    if (going) invalidate()
    step.current = going ? heldStep(delta, step.current) : 0
    const dt = going ? step.current : Math.min(delta, 0.1)

    p.yaw += turn * TURN_SPEED * dt
    p.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p.pitch + n.tilt * LOOK_SPEED * dt))
    if (forward || strafe) {
      // Yaw 0 looks along plan-up (-z); positive yaw turns right.
      const fx = Math.sin(p.yaw)
      const fy = -Math.cos(p.yaw)
      const step = WALK_SPEED * dt
      const moved: Point = [p.x + (fx * forward - fy * strafe) * step, p.y + (fy * forward + fx * strafe) * step]
      const w = walking.current
      const apron = RADIUS + step * 2
      const stair =
        w.stair ??
        runs.find((run) => {
          if (run.lower !== w.floorIndex && run.upper !== w.floorIndex) return false
          const h = stairHeight(run, floors, moved, apron)
          return h !== undefined && Math.abs(h - w.elevation) < STEP_OVER
        })
      const proposedHeight = stair ? stairHeight(stair, floors, moved, apron) : undefined
      const resolved = resolveCollisions(moved, RADIUS, obstaclesAt(proposedHeight ?? w.elevation))
      const height = stair ? stairHeight(stair, floors, resolved, apron) : undefined
      // The footprint is the support surface: don't let a walker step sideways off a flight or into a void.
      const supported =
        stair &&
        height !== undefined &&
        Array.from({ length: 16 }, (_, i) => {
          const angle = (i * Math.PI) / 8
          return (
            stairHeight(
              stair,
              floors,
              [resolved[0] + Math.cos(angle) * RADIUS, resolved[1] + Math.sin(angle) * RADIUS],
              apron + RADIUS,
            ) !== undefined
          )
        }).every(Boolean)
      const atEnd =
        stair &&
        (Math.abs(w.elevation - floors[stair.lower].elevation) < 1e-6 ||
          Math.abs(w.elevation - floors[stair.upper].elevation) < 1e-6)
      const inVoid = (floors[w.floorIndex].voids ?? []).some(
        (v) =>
          resolved[0] > v.x0 - RADIUS &&
          resolved[0] < v.x1 + RADIUS &&
          resolved[1] > v.y0 - RADIUS &&
          resolved[1] < v.y1 + RADIUS,
      )
      // Outside, the garden's outline is the edge of the world.
      const inGarden = !outdoor || insidePolygon(resolved, outdoor.garden)
      if (inGarden && (supported || ((!stair || (atEnd && height === undefined)) && !inVoid))) {
        ;[p.x, p.y] = resolved
        w.stair = supported ? stair : undefined
        w.elevation = supported ? height! : surface(w.floorIndex, resolved)
        if (stair && supported) {
          const next =
            Math.abs(w.elevation - floors[stair.upper].elevation) < 1e-6
              ? stair.upper
              : Math.abs(w.elevation - floors[stair.lower].elevation) < 1e-6
                ? stair.lower
                : w.floorIndex
          if (next !== w.floorIndex) {
            w.floorIndex = next
            onFloorChange(next)
          }
        }
      }
    }

    const target = walking.current.elevation
    if (Math.abs(eye.current - target) > 1e-4) {
      eye.current += (target - eye.current) * Math.min(1, STEP_EASE * dt)
      invalidate()
    } else eye.current = target
    cam.position.set(p.x, eye.current + EYE_HEIGHT, p.y)
    cam.rotation.set(p.pitch, -p.yaw, 0, 'YXZ')
    // Before MotionQuality, so a move's very first frame is already cheap.
  }, -1)

  return <PerspectiveCamera ref={camera} makeDefault fov={70} near={0.05} far={200} />
}
