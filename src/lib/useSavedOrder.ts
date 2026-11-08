import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { Order } from './order'

/** The signed-in person's order of a menu, loaded and saved through the backend. */
export const useSavedOrder = (
  queryKey: QueryKey,
  load: () => Promise<Order | undefined>,
  save: (order: Order) => Promise<void>,
) => {
  const client = useQueryClient()
  const query = useQuery({ queryKey, queryFn: async () => (await load()) ?? null })
  const mutation = useMutation({
    mutationFn: save,
    onError: () => client.invalidateQueries({ queryKey }),
  })
  return {
    /** False until the order has come in (or failed to, when the default order stands). */
    ready: !query.isPending,
    order: query.data ?? undefined,
    // Shown straight away, so a moved entry doesn't jump back while it saves.
    save: (order: Order) => {
      client.setQueryData(queryKey, order)
      mutation.mutate(order)
    },
  }
}
