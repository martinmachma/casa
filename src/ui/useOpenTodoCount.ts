import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** How many to-dos are still open, kept live. */
export const useOpenTodoCount = () => {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const load = async () => {
      const { count, error } = await supabase
        .from('todos')
        .select('id', { count: 'exact', head: true })
        .eq('done', false)
      if (!error) setCount(count ?? 0)
    }
    void Promise.resolve().then(load)
    const channel = supabase
      .channel('todo-count')
      .on('postgres_changes', { event: '*', schema: 'house', table: 'todos' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  return count
}
