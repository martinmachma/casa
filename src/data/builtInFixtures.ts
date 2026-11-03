import { floorRegions, roomAt } from '../layout/rooms'
import type { Floor } from '../layout/types'
import type { HouseState } from './types'

/**
 * Retire catalog fittings superseded by fixed equipment when an older version or draft is opened.
 * Snapshots remain untouched in storage. The marker travels with new saves, so later deliberate additions stay editable.
 */
export const withBuiltInFixtures = (state: HouseState, floors: Floor[]): HouseState => {
  const applied = new Set(state.builtInFixtures)
  const pending = floors.flatMap((floor) =>
    (floor.fixtures ?? [])
      .filter((fixture) => fixture.replaces && !applied.has(fixture.id))
      .map((fixture) => ({ floor, fixture })),
  )
  if (!pending.length) return state
  const furniture = state.furniture.filter(
    (item) =>
      !pending.some(
        ({ floor, fixture }) =>
          item.floor === floor.id &&
          !!item.model &&
          fixture.replaces!.models.includes(item.model) &&
          roomAt(floorRegions(floor), item.x, item.y) === fixture.replaces!.room,
      ),
  )
  return { ...state, furniture, builtInFixtures: [...applied, ...pending.map(({ fixture }) => fixture.id)] }
}
