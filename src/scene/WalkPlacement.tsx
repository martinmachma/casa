import { useThree } from '@react-three/fiber'
import { useEffect, useState, type RefObject } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { FurnitureItem } from '../data/types'
import { fixtureSolids } from '../furniture/collision'
import { insidePolygon } from '../layout/geometry'
import { groundLevel, onSlab } from '../layout/ground'
import type { Floor, Outdoor, Point } from '../layout/types'
import { outdoorObstacles, solidObstacles, wallObstacles, type Obstacle } from '../walk/collide'
import {
  EYE_HEIGHT,
  nearestWalkPoint,
  onFloorSurface,
  outdoorWalkPoint,
  STEP_OVER,
  type WalkStart,
} from '../walk/start'

export type WalkPlacement = RefObject<
  | {
      start: () => WalkStart | undefined
      point: (x: number, y: number) => WalkStart | undefined
      preview: (x: number, y: number) => boolean
      clear: () => void
    }
  | undefined
>

type Props = {
  placementRef: WalkPlacement
  floors: Floor[]
  outdoor?: Outdoor
  activeFloor: number
  shownCount: number
  furniture: FurnitureItem[]
  openDoors: ReadonlySet<string>
}

/** Bridges the walk button to the live camera, with a floor marker while placing it. */
export const WalkPlacementTracker = ({
  placementRef,
  floors,
  outdoor,
  activeFloor,
  shownCount,
  furniture,
  openDoors,
}: Props) => {
  const getState = useThree((s) => s.get)
  const [target, setTarget] = useState<WalkStart>()
  useEffect(() => {
    const solids = [...furniture, ...floors.flatMap(fixtureSolids)]
    const fixed = outdoorObstacles(outdoor)
    const obstacleCache = new Map<number, Obstacle[]>()
    const obstaclesAt = (elevation: number) => {
      let obstacles = obstacleCache.get(elevation)
      if (!obstacles) {
        obstacles = [
          ...floors.flatMap((f) => wallObstacles(f, openDoors, elevation)),
          ...solidObstacles(solids, floors, elevation + STEP_OVER, elevation + EYE_HEIGHT),
          ...fixed,
        ]
        obstacleCache.set(elevation, obstacles)
      }
      return obstacles
    }
    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const hit = new Vector3()
    const direction = new Vector3()
    const plane = new Plane(new Vector3(0, 1, 0))
    const startAt = (index: number, preferred: Point, outside = false): WalkStart | undefined => {
      const at =
        outside && outdoor
          ? outdoorWalkPoint(floors[0], outdoor, preferred, obstaclesAt(groundLevel(floors[0], outdoor, preferred)))
          : nearestWalkPoint(floors[index], preferred, obstaclesAt(floors[index].elevation))
      if (!at) return
      getState().camera.getWorldDirection(direction)
      const yaw = Math.hypot(direction.x, direction.z) < 0.01 ? 0 : Math.atan2(direction.x, -direction.z)
      return { floorIndex: index, at, yaw, outside }
    }
    const point = (x: number, y: number): WalkStart | undefined => {
      const { camera, gl } = getState()
      const canvas = gl.domElement
      if (document.elementFromPoint(x, y) !== canvas) return
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pointer.set(((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2)
      raycaster.setFromCamera(pointer, camera)
      let closest = Infinity
      let target: WalkStart | undefined
      for (let i = 0; i < shownCount; i++) {
        plane.constant = -floors[i].elevation
        if (!raycaster.ray.intersectPlane(plane, hit) || !onFloorSurface(floors[i], [hit.x, hit.z])) continue
        const distance = raycaster.ray.origin.distanceTo(hit)
        if (distance >= closest) continue
        // Choose the hit slab before resolving the standing point, so an obstructed upper floor never drops downstairs.
        closest = distance
        target = startAt(i, [hit.x, hit.z])
      }
      if (outdoor) {
        const elevations = new Set([
          outdoor.level,
          outdoor.terrace.level,
          ...(outdoor.paving ?? []).map((p) => p.level),
        ])
        for (const elevation of elevations) {
          plane.constant = -elevation
          if (!raycaster.ray.intersectPlane(plane, hit)) continue
          const at: Point = [hit.x, hit.z]
          if (onSlab(floors[0], at) || !insidePolygon(at, outdoor.garden)) continue
          // The higher paving or terrace hides the lawn underneath it.
          if (Math.abs(groundLevel(floors[0], outdoor, at) - elevation) > 1e-6) continue
          const distance = raycaster.ray.origin.distanceTo(hit)
          if (distance >= closest) continue
          closest = distance
          target = startAt(0, at, true)
        }
      }
      return target
    }
    placementRef.current = {
      start: () => {
        const { camera, controls } = getState()
        raycaster.setFromCamera(pointer.set(0, 0), camera)
        plane.constant = -floors[activeFloor].elevation
        const center = raycaster.ray.intersectPlane(plane, hit)
        const orbitTarget = controls && 'target' in controls ? (controls.target as Vector3) : undefined
        const at = center ?? orbitTarget ?? camera.position
        return startAt(activeFloor, [at.x, at.z])
      },
      point,
      preview: (x, y) => {
        const next = point(x, y)
        setTarget(next)
        return !!next
      },
      clear: () => setTarget(undefined),
    }
    return () => {
      placementRef.current = undefined
    }
  }, [placementRef, floors, outdoor, activeFloor, shownCount, furniture, openDoors, getState])

  if (!target) return null
  const elevation =
    target.floorIndex === 0 ? groundLevel(floors[0], outdoor, target.at) : floors[target.floorIndex].elevation
  return (
    <group position={[target.at[0], elevation + 0.04, target.at[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1000} raycast={() => null}>
        <ringGeometry args={[0.2, 0.28, 40]} />
        <meshBasicMaterial color="#718c53" depthTest={false} transparent opacity={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1000} raycast={() => null}>
        <circleGeometry args={[0.19, 40]} />
        <meshBasicMaterial color="#718c53" depthTest={false} transparent opacity={0.3} />
      </mesh>
    </group>
  )
}
