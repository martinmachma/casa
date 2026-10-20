import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type { PerspectiveCamera as Camera } from 'three'
import type { FurnitureItem } from '../data/types'
import { floorRegions, roomAt } from '../layout/rooms'
import type { Floor, Point } from '../layout/types'
import { isTyping } from '../ui/isTyping'
import { resolveCollisions, wallObstacles, type Obstacle } from '../walk/collide'
import { stairHeight, stairRuns, type StairRun } from '../walk/stairs'
import type { CameraNudge } from './cameraNudge'

const EYE_HEIGHT = 1.6
const RADIUS = 0.22
const WALK_SPEED = 1.4 // m/s
const TURN_SPEED = 1.6 // rad/s
const LOOK_SPEED = 0.9 // rad/s from the buttons
const DRAG_LOOK = 0.005 // rad per pixel dragged
const MAX_PITCH = 1.2
// Furniture lower than this (rugs) can be walked over.
const STEP_OVER = 0.15
const START_BACKOFF = 0.9

type WalkCameraProps = {
  floor: Floor
  floors: Floor[]
  onFloorChange: (index: number) => void
  furniture: FurnitureItem[]
  nudge: RefObject<CameraNudge>
  openDoors: ReadonlySet<string>
}

/** Where to stand at first: at one end of the biggest room, looking down its length. */
const startingPoint = (floor: Floor): { at: Point; yaw: number } => {
  const regions = floorRegions(floor)
  const biggest = [...regions.values()].sort((a, b) => b.area - a.area)[0]
  if (!biggest) return { at: [0, 0], yaw: 0 }
  const x0 = Math.min(...biggest.cells.map((c) => c.x0))
  const x1 = Math.max(...biggest.cells.map((c) => c.x1))
  const y0 = Math.min(...biggest.cells.map((c) => c.y0))
  const y1 = Math.max(...biggest.cells.map((c) => c.y1))
  const tall = y1 - y0 >= x1 - x0
  // Back against the south (or west) end, facing north (or east).
  const at: Point = tall ? [(x0 + x1) / 2, y1 - START_BACKOFF] : [x0 + START_BACKOFF, (y0 + y1) / 2]
  if (roomAt(regions, ...at) === biggest.roomId) return { at, yaw: tall ? 0 : Math.PI / 2 }
  const cell = biggest.cells[0]
  return { at: [(cell.x0 + cell.x1) / 2, (cell.y0 + cell.y1) / 2], yaw: 0 }
}

/**
 * First-person camera at eye height: drag to look around, WASD/arrow keys or the on-screen buttons to walk.
 * Walls block the way except through open doors and passages; furniture does too.
 */
export const WalkCamera = ({ floor, floors, onFloorChange, furniture, nudge, openDoors }: WalkCameraProps) => {
  const camera = useRef<Camera>(null)
  const gl = useThree((s) => s.gl)
  const set = useThree((s) => s.set)
  const start = useMemo(() => startingPoint(floor), [floor])
  const pose = useRef({ x: start.at[0], y: start.at[1], yaw: start.yaw, pitch: 0 })
  const walking = useRef({
    floorIndex: floors.indexOf(floor),
    elevation: floor.elevation,
    stair: undefined as StairRun | undefined,
  })
  const runs = useMemo(() => stairRuns(floors), [floors])
  const keys = useRef(new Set<string>())
  // Stands in for orbit controls: furniture dragging switches it off so the view holds still meanwhile.
  const look = useMemo(() => ({ enabled: true }), [])

  const obstaclesAt = (elevation: number): Obstacle[] => [
    ...floors.flatMap((f) => wallObstacles(f, openDoors, elevation)),
    ...furniture
      .filter((item) => {
        const base = floors.find((f) => f.id === item.floor)?.elevation
        return base !== undefined && base < elevation + EYE_HEIGHT && base + item.height > elevation + STEP_OVER
      })
      .map((f) => ({ cx: f.x, cy: f.y, hu: f.width / 2, hv: f.depth / 2, angle: f.rotation })),
  ]

  useEffect(() => {
    set({ controls: look as never })
    return () => set({ controls: null })
  }, [set, look])

  // Drag anywhere on the canvas to look around.
  useEffect(() => {
    const el = gl.domElement
    let last: { x: number; y: number; id: number } | undefined
    const down = (e: PointerEvent) => (last = { x: e.clientX, y: e.clientY, id: e.pointerId })
    const move = (e: PointerEvent) => {
      if (!last || e.pointerId !== last.id) return
      if (look.enabled) {
        const p = pose.current
        // Grab-the-view, like street-view photos: drag left to turn right.
        p.yaw -= (e.clientX - last.x) * DRAG_LOOK
        p.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p.pitch + (e.clientY - last.y) * DRAG_LOOK))
      }
      last = { x: e.clientX, y: e.clientY, id: e.pointerId }
    }
    const up = () => (last = undefined)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl, look])

  useEffect(() => {
    const held = keys.current
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey) return
      held.add(e.key.toLowerCase())
    }
    const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase())
    const clear = () => held.clear()
    const focus = (e: FocusEvent) => {
      if (isTyping(e.target)) clear()
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

  useFrame((_, delta) => {
    const cam = camera.current
    if (!cam) return
    const dt = Math.min(delta, 0.1)
    const p = pose.current
    const k = keys.current
    const n = nudge.current
    const axis = (plus: boolean, minus: boolean) => (plus ? 1 : 0) - (minus ? 1 : 0)
    const forward = n.forward + axis(k.has('w') || k.has('arrowup'), k.has('s') || k.has('arrowdown'))
    const strafe = n.right + axis(k.has('d'), k.has('a'))
    const turn = n.turn + axis(k.has('arrowright'), k.has('arrowleft'))

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
      if (supported || ((!stair || (atEnd && height === undefined)) && !inVoid)) {
        ;[p.x, p.y] = resolved
        w.stair = supported ? stair : undefined
        w.elevation = supported ? height! : floors[w.floorIndex].elevation
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

    cam.position.set(p.x, walking.current.elevation + EYE_HEIGHT, p.y)
    cam.rotation.set(p.pitch, -p.yaw, 0, 'YXZ')
  })

  return <PerspectiveCamera ref={camera} makeDefault fov={70} near={0.05} far={200} />
}
