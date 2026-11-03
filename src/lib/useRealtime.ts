import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from './supabase'

/** Refetches `queryKey` whenever a row of `table` changes anywhere (the table must be in `supabase_realtime`). */
export const useRealtime = (channel: string, table: string, queryKey: QueryKey) => {
  const client = useQueryClient()
  const key = JSON.stringify(queryKey)
  useEffect(() => {
    const queryKey = JSON.parse(key) as QueryKey
    const sub = supabase
      .channel(channel)
      .on('postgres_changes', { event: '*', schema: 'house', table }, () => client.invalidateQueries({ queryKey }))
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
    }
  }, [client, channel, table, key])
}
