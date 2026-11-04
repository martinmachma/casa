import { useEffect, useMemo } from 'react'
import { PlaneGeometry } from 'three'
import type { WallPiece } from '../layout/geometry'
import type { Floor, Wall, WallFace, WallSide } from '../layout/types'
import { WC_TILE_HEIGHT, wcWallFinish } from '../layout/wc'
import { BATHROOM_MARBLE, BATHROOM_TRAVERTINE } from './bathroomMaterials'
import { floorBump, floorTexture, type FloorMaterial } from './floorMaterials'
import { WC_STONE } from './wcMaterials'

const noRaycast = () => null
// Beneath painted patches, which stand 0.8 mm off the wall.
const PROUD = 0.0002

type V = [number, number, number]

const TileFace = ({
  at,
  rotation,
  width,
  height,
  u,
  v,
  finish,
}: {
  at: V
  rotation: V
  width: number
  height: number
  u: number
  v: number
  finish: FloorMaterial
}) => {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(width, height)
    const uv = g.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u + uv.getX(i) * width, v + uv.getY(i) * height)
    return g
  }, [width, height, u, v])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh position={at} rotation={rotation} geometry={geometry} receiveShadow raycast={noRaycast}>
      <meshStandardMaterial
        map={floorTexture(finish)}
        bumpMap={floorBump(finish)}
        bumpScale={finish.bumpScale}
        roughness={finish.roughness}
      />
    </mesh>
  )
}

type WallTilesProps = {
  floor: Floor
  wall: Wall
  pieces: WallPiece[]
  thickness: number
  cut: boolean
  painted: (piece: WallPiece, side: WallFace, at?: number) => boolean
}

const WCWallTiles = ({ floor, wall, pieces, thickness, painted }: WallTilesProps) => {
  const face = wcWallFinish(floor, wall)
  if (!face) return null
  const { side } = face
  const direction = side === 'a' ? 1 : -1
  return pieces.map((p, i) => {
    const u0 = Math.max(p.u0, face.u0)
    const u1 = Math.min(p.u1, face.u1)
    if (u1 <= u0 || painted(p, side)) return null
    const top = Math.min(p.y1, WC_TILE_HEIGHT)
    return (
      <group key={i}>
        {top > p.y0 && (
          <TileFace
            at={[(u0 + u1) / 2, (p.y0 + top) / 2, direction * (thickness / 2 + PROUD)]}
            rotation={[0, side === 'a' ? 0 : Math.PI, 0]}
            width={u1 - u0}
            height={top - p.y0}
            u={side === 'a' ? u0 : -u1}
            v={p.y0}
            finish={WC_STONE}
          />
        )}
        {p.y1 > WC_TILE_HEIGHT && (
          <mesh
            position={[(u0 + u1) / 2, (Math.max(p.y0, WC_TILE_HEIGHT) + p.y1) / 2, direction * (thickness / 2 + PROUD)]}
            rotation={[0, side === 'a' ? 0 : Math.PI, 0]}
            receiveShadow
            raycast={noRaycast}
          >
            <planeGeometry args={[u1 - u0, p.y1 - Math.max(p.y0, WC_TILE_HEIGHT)]} />
            <meshStandardMaterial color="#f2f2ef" roughness={0.9} />
          </mesh>
        )}
      </group>
    )
  })
}

/** Fixed bathroom finishes follow the wall's real pieces, openings and cutaway. Saved paint goes over them. */
export const BathroomWallTiles = (props: WallTilesProps) => {
  const { floor, wall, pieces, thickness, painted, cut } = props
  if (floor.id === 'ground') return <WCWallTiles {...props} />
  if (floor.id !== 'upper') return null
  const side: WallSide | undefined = ['u-north', 'u-east', 'u-east-shaft', 'u-wc-frame'].includes(wall.id)
    ? 'a'
    : ['u-205-bath', 'u-bath-south', 'u-bath-shaft'].includes(wall.id)
      ? 'b'
      : undefined
  if (!side) return null
  const finish = ['u-east', 'u-bath-shaft'].includes(wall.id) ? BATHROOM_TRAVERTINE : BATHROOM_MARBLE
  const direction = side === 'a' ? 1 : -1
  return pieces.map((p, i) => {
    // The north wall is shared with Sara's room. Stop exactly at the bathroom's partition and east wall.
    const u0 = wall.id === 'u-north' ? Math.max(p.u0, 3.6075) : p.u0
    const u1 = wall.id === 'u-north' ? Math.min(p.u1, 5.8575) : p.u1
    if (u1 <= u0) return null
    const width = u1 - u0
    const height = p.y1 - p.y0
    const middle = (u0 + u1) / 2
    return (
      <group key={i}>
        {!painted(p, side) && (
          <TileFace
            at={[middle, (p.y0 + p.y1) / 2, direction * (thickness / 2 + PROUD)]}
            rotation={[0, side === 'a' ? 0 : Math.PI, 0]}
            width={width}
            height={height}
            u={side === 'a' ? u0 : -u1}
            v={p.y0}
            finish={finish}
          />
        )}
        {wall.id === 'u-bath-shaft' && !painted(p, 'a') && (
          <TileFace
            at={[middle, (p.y0 + p.y1) / 2, thickness / 2 + PROUD]}
            rotation={[0, 0, 0]}
            width={width}
            height={height}
            u={u0}
            v={p.y0}
            finish={BATHROOM_MARBLE}
          />
        )}
        {/* The WC ledge is a real tiled top; artificial cut faces keep the wall's section colour. */}
        {wall.id === 'u-wc-frame' && !cut && (
          <TileFace
            at={[middle, p.y1 + PROUD, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            width={width}
            height={thickness}
            u={u0}
            v={0}
            finish={finish}
          />
        )}
        {/* The shaft and boxing have visible returns beside the shower and WC. */}
        {['u-east-shaft', 'u-wc-frame', 'u-bath-shaft'].includes(wall.id) &&
          [-1, 1].map(
            (end) =>
              !painted(p, 'end', end < 0 ? u0 : u1) && (
                <TileFace
                  key={end}
                  at={[end < 0 ? u0 - PROUD : u1 + PROUD, (p.y0 + p.y1) / 2, 0]}
                  rotation={[0, (end * Math.PI) / 2, 0]}
                  width={thickness}
                  height={height}
                  u={0}
                  v={p.y0}
                  finish={BATHROOM_MARBLE}
                />
              ),
          )}
      </group>
    )
  })
}
