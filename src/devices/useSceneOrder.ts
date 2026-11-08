import type { Backend } from '../data/types'
import { useSavedOrder } from '../lib/useSavedOrder'

/** The signed-in person's scenes shown on the phone and their order, kept in their row of house.scene_orders. */
export const useSceneOrder = (backend: Backend) =>
  useSavedOrder(['sceneOrder', backend.kind], backend.loadSceneOrder, backend.saveSceneOrder)
