import { expect, it } from 'vitest'
import { house } from '../layout/layout'
import type { FurnitureItem } from './types'
import { EMPTY_STATE } from './types'
import { withBuiltInFixtures } from './builtInFixtures'

const oldFitting = (id: string, model: string, x: number, y: number, floor = 'upper'): FurnitureItem => ({
  id,
  model,
  x,
  y,
  floor,
  name: model,
  width: 0.6,
  depth: 0.6,
  height: 0.8,
  rotation: 0,
  color: '#fff',
})

it('retires the old bathroom and WC fittings while preserving other rooms, floors and furniture', () => {
  const obsolete = [
    oldFitting('shower', 'shower', 5.6, 1.6),
    oldFitting('round', 'showerRound', 5.6, 1.5),
    oldFitting('wc', 'toilet', 5.2, 2.7),
    oldFitting('basin', 'bathroomSink', 4.04, 0.9),
    oldFitting('vanity', 'bathroomCabinetDrawer', 4.04, 0.9),
    oldFitting('ground-wc', 'toilet', 0.5, 6.05, 'ground'),
    oldFitting('ground-basin', 'bathroomSink', 1.4, 5.5, 'ground'),
    oldFitting('ground-vanity', 'bathroomCabinetDrawer', 1.4, 5.5, 'ground'),
  ]
  const keep = [
    oldFitting('downstairs', 'toilet', 5.2, 2.7, 'ground'),
    oldFitting('elsewhere', 'bathroomSink', 1.9, 1.7),
    oldFitting('stool', 'stoolBar', 4.5, 1.7),
  ]
  const state = { ...EMPTY_STATE, furniture: [...obsolete, ...keep] }
  const upgraded = withBuiltInFixtures(state, house.floors)
  expect(upgraded.furniture).toEqual(keep)
  expect(state.furniture).toHaveLength(11) // The stored snapshot is still intact.
})

it('preserves deliberate additions after the upgrade, including after a save and reload', () => {
  const upgraded = withBuiltInFixtures(EMPTY_STATE, house.floors)
  const added = { ...upgraded, furniture: [oldFitting('new-basin', 'bathroomSink', 4.5, 1.5)] }
  const reloaded = JSON.parse(JSON.stringify(added))
  expect(withBuiltInFixtures(reloaded, house.floors)).toBe(reloaded)
  expect(reloaded.furniture).toEqual(added.furniture)
})
