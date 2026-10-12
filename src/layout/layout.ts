import raw from './house.json'
import { validateLayout } from './geometry'
import type { HouseLayout } from './types'

export const house = raw as HouseLayout
validateLayout(house)
