import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Backend } from '../data/types'
import type { RoomOrder } from './roomOrder'

/** The signed-in person's order of the room menu, kept in their row of house.room_orders. */
export const useRoomOrder = (backend: Backend) => {
  const client = useQueryClient()
  const queryKey = ['roomOrder', backend.kind]
  const query = useQuery({ queryKey, queryFn: async () => (await backend.loadRoomOrder()) ?? null })
  const mutation = useMutation({
    mutationFn: backend.saveRoomOrder,
    onError: () => client.invalidateQueries({ queryKey }),
  })
  return {
    /** False until the order has come in (or failed to, when the plan's order stands). */
    ready: !query.isPending,
    order: query.data ?? undefined,
    // Shown straight away, so a dropped room doesn't jump back while it saves.
    save: (order: RoomOrder) => {
      client.setQueryData(queryKey, order)
      mutation.mutate(order)
    },
  }
}
