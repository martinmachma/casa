import { useEffect, useMemo } from 'react'
import { FrontSide, MeshBasicMaterial } from 'three'
import type { Floor, Roof } from '../layout/types'
import { houseSolid } from './houseGeometry'

// Render the nearest solid surface into shadows, without drawing or covering anything on screen.
const shadowOnly = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, shadowSide: FrontSide })

/**
 * The whole house casting its shadow, whichever floor is shown and whichever walls are cut away.
 * It's invisible and unpickable; the visible walls, slabs and roof leave the shadow to it.
 */
export const HouseShadow = ({
  floors,
  roof,
  openDoors,
  groundLevel,
}: {
  floors: Floor[]
  roof: Roof | undefined
  groundLevel?: number
  openDoors: ReadonlySet<string>
}) => {
  const geometry = useMemo(
    () => houseSolid(floors, roof, openDoors, groundLevel),
    [floors, roof, openDoors, groundLevel],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} material={shadowOnly} userData={{ shadowOnly: true }} castShadow raycast={() => null} />
  )
}
