import { useQuery } from '@tanstack/react-query'
import { useRealtime } from '../lib/useRealtime'
import { supabase } from '../lib/supabase'

/** How many to-dos are still open, kept live. */
export const useOpenTodoCount = () => {
  useRealtime('todo-count', 'todos', ['todos'])
  const { data } = useQuery({
    queryKey: ['todos', 'openCount'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('todos')
        .select('id', { count: 'exact', head: true })
        .eq('done', false)
      if (error) throw new Error(error.message)
      return count ?? 0
    },
  })
  return data ?? 0
}
