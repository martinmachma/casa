import { FrontSide } from 'three'
import { memo, useMemo } from 'react'
import type { Floor, Point } from '../layout/types'
import { floorBump, floorTexture, STAIR_FLOOR } from './floorMaterials'
import { RAILING } from './palette'
import { prismGeometry } from './prism'

// Each step is a solid block this deep under its tread, so the flights read as a stepped slab with room beneath.
const STEP_DEPTH = 0.2
const RAIL_HEIGHT = 1.0
const RAIL_BAR = 0.04

const noRaycast = () => null

/** A step block with its texture turned so the boards run along the tread's longest edge. */
const stepGeometry = (polygon: Point[], depth: number) => {
  const g = prismGeometry(polygon, depth)
  let angle = 0
  let longest = 0
  polygon.forEach(([x0, y0], i) => {
    const [x1, y1] = polygon[(i + 1) % polygon.length]
    const length = Math.hypot(x1 - x0, y1 - y0)
    if (length > longest) {
      longest = length
      angle = Math.atan2(y1 - y0, x1 - x0)
    }
  })
  const uv = g.getAttribute('uv')
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    uv.setXY(i, u * cos - v * sin, u * sin + v * cos)
  }
  return g
}

type StairsProps = {
  floor: Floor
  next: Floor
  /** Leaves out the steps rising above this height over the floor (into the floor above, when it isn't shown). */
  cut?: number
}

/** The floor's stairs, rising evenly from its surface to the next floor's. */
export const Stairs = memo(({ floor, next, cut = Infinity }: StairsProps) => {
  const steps = floor.stairs?.steps
  const rise = steps ? (next.elevation - floor.elevation) / steps.length : 0
  const geometries = useMemo(
    () =>
      (steps ?? [])
        .filter((_, i) => (i + 1) * rise <= cut + 1e-6)
        .map((s, i) => stepGeometry(s, Math.min(STEP_DEPTH, (i + 1) * rise))),
    [steps, rise, cut],
  )
  return (
    <group>
      {geometries.map((g, i) => (
        <mesh
          key={i}
          geometry={g}
          position={[0, floor.elevation + (i + 1) * rise, 0]}
          castShadow
          receiveShadow
          raycast={noRaycast}
          userData={{ rooms: floor.stairs?.rooms }}
        >
          <meshStandardMaterial
            shadowSide={FrontSide}
            map={floorTexture(STAIR_FLOOR)}
            bumpMap={floorBump(STAIR_FLOOR)}
            bumpScale={STAIR_FLOOR.bumpScale}
            roughness={STAIR_FLOOR.roughness}
          />
        </mesh>
      ))}
    </group>
  )
})

/** Handrails with a glass infill along the floor's railings. */
export const Railings = memo(({ floor }: { floor: Floor }) => (
  <group position={[0, floor.elevation, 0]}>
    {(floor.railings ?? []).flatMap((line, li) =>
      line.slice(1).map((to, k) => {
        const from = line[k]
        const length = Math.hypot(to[0] - from[0], to[1] - from[1])
        const angle = Math.atan2(to[1] - from[1], to[0] - from[0])
        return (
          <group
            key={`${li}-${k}`}
            position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]}
            rotation={[0, -angle, 0]}
          >
            <mesh position={[0, RAIL_HEIGHT - RAIL_BAR / 2, 0]} castShadow raycast={noRaycast}>
              <boxGeometry args={[length, RAIL_BAR, RAIL_BAR]} />
              <meshStandardMaterial shadowSide={FrontSide} color={RAILING} metalness={0.4} roughness={0.4} />
            </mesh>
            <mesh position={[0, (RAIL_HEIGHT - RAIL_BAR) / 2, 0]} raycast={noRaycast}>
              <boxGeometry args={[length, RAIL_HEIGHT - RAIL_BAR, 0.012]} />
              <meshStandardMaterial
                shadowSide={FrontSide}
                color="#cfe0e6"
                transparent
                opacity={0.3}
                depthWrite={false}
              />
            </mesh>
          </group>
        )
      }),
    )}
  </group>
))
