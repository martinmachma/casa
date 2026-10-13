import { supabase } from '../lib/supabase'
import type { Backend, HouseState, Version } from './types'

type VersionRow = {
  id: string
  name: string
  author: string | null
  created_at: string
  based_on: string | null
  data: Partial<HouseState> | null
}

const VERSION_COLUMNS = 'id, name, author, created_at, based_on, data'

const fromRow = (r: VersionRow): Version => ({
  id: r.id,
  name: r.name,
  ...(r.author ? { author: r.author } : {}),
  createdAt: r.created_at,
  ...(r.based_on ? { basedOn: r.based_on } : {}),
  data: { walls: r.data?.walls ?? [], floors: r.data?.floors ?? [], furniture: r.data?.furniture ?? [] },
})

const check = <T>({ data, error }: { data: T; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message)
  return data
}

export const supabaseBackend: Backend = {
  kind: 'supabase',

  loadVersions: async () => {
    const [rows, live] = await Promise.all([
      supabase.from('versions').select(VERSION_COLUMNS).order('created_at', { ascending: false }),
      supabase.from('live_version').select('version_id').maybeSingle(),
    ])
    return {
      versions: ((check(rows) ?? []) as VersionRow[]).map(fromRow),
      liveId: (check(live) as { version_id: string | null } | null)?.version_id ?? undefined,
    }
  },

  saveVersion: async (name, data, basedOn) => {
    const row = check(
      await supabase
        .from('versions')
        .insert({ name, data, based_on: basedOn ?? null })
        .select(VERSION_COLUMNS)
        .single(),
    )
    return fromRow(row as VersionRow)
  },

  deleteVersion: async (id) => {
    check(await supabase.from('versions').delete().eq('id', id))
  },

  setLive: async (id) => {
    check(
      await supabase
        .from('live_version')
        .update({ version_id: id ?? null })
        .eq('id', true),
    )
  },

  // Needs the tables in the `supabase_realtime` publication (see the migrations).
  subscribe: (onChange) => {
    const channel = supabase
      .channel('casa-versions')
      .on('postgres_changes', { event: '*', schema: 'house', table: 'versions' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'house', table: 'live_version' }, onChange)
      .subscribe((status) => {
        // Also fires after a dropped connection comes back (phone asleep, network switch): catch up then.
        if (status === 'SUBSCRIBED') onChange()
      })
    return () => {
      supabase.removeChannel(channel)
    }
  },
}
