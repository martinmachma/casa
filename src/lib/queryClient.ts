import { QueryClient } from '@tanstack/react-query'

// Realtime channels say when the house changes, so data isn't refetched just for a window coming back into focus.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})
