import { supabase } from '../lib/supabase'
import type { WallSide } from '../layout/types'
import type { Backend, FurnitureItem, NewFurnitureItem } from './types'

type FurnitureRow = {
  id: string
  floor: string
  name: string
  width: number | string
  depth: number | string
  height: number | string
  x: number | string
  y: number | string
  rotation: number | string
  color: string
  model: string | null
}

type WallRow = { scheme_id: string; wall_id: string; side: WallSide; color: string }
type RoomFloorRow = { scheme_id: string; room_id: string; material: string }

const FURNITURE_COLUMNS = 'id, floor, name, width, depth, height, x, y, rotation, color, model'

const fromRow = (r: FurnitureRow): FurnitureItem => ({
  id: r.id,
  floor: r.floor,
  name: r.name,
  width: Number(r.width),
  depth: Number(r.depth),
  height: Number(r.height),
  x: Number(r.x),
  y: Number(r.y),
  rotation: Number(r.rotation),
  color: r.color,
  ...(r.model ? { model: r.model } : {}),
})

const toRow = (item: NewFurnitureItem) => ({
  floor: item.floor,
  name: item.name,
  width: item.width,
  depth: item.depth,
  height: item.height,
  x: item.x,
  y: item.y,
  rotation: item.rotation,
  color: item.color,
  model: item.model ?? null,
})

const check = <T>({ data, error }: { data: T; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message)
  return data
}

let activeScheme: Promise<string> | undefined

/** The active colour scheme's id, creating a "Default" one on first use. */
const activeSchemeId = (): Promise<string> => {
  activeScheme ??= (async () => {
    const found = check(await supabase.from('color_schemes').select('id').eq('is_active', true).limit(1).maybeSingle())
    if (found) return found.id as string
    const created = check(
      await supabase.from('color_schemes').insert({ name: 'Default', is_active: true }).select('id').single(),
    )
    return (created as { id: string }).id
  })()
  activeScheme.catch(() => (activeScheme = undefined))
  return activeScheme
}

export const supabaseBackend: Backend = {
  kind: 'supabase',

  loadWallColors: async () => {
    const schemeId = await activeSchemeId()
    const rows = check(await supabase.from('walls').select('wall_id, side, color').eq('scheme_id', schemeId))
    return (rows ?? []).map((r) => ({ wallId: r.wall_id, side: r.side, color: r.color }))
  },

  saveWallColor: async ({ wallId, side, color }) => {
    const schemeId = await activeSchemeId()
    check(
      await supabase
        .from('walls')
        .upsert({ scheme_id: schemeId, wall_id: wallId, side, color }, { onConflict: 'scheme_id,wall_id,side' }),
    )
  },

  clearWallColor: async (wallId, side) => {
    const schemeId = await activeSchemeId()
    check(await supabase.from('walls').delete().match({ scheme_id: schemeId, wall_id: wallId, side }))
  },

  loadRoomFloors: async () => {
    const schemeId = await activeSchemeId()
    const rows = check(await supabase.from('room_floors').select('room_id, material').eq('scheme_id', schemeId))
    return (rows ?? []).map((r) => ({ roomId: r.room_id, material: r.material }))
  },

  saveRoomFloor: async ({ roomId, material }) => {
    const schemeId = await activeSchemeId()
    check(
      await supabase
        .from('room_floors')
        .upsert({ scheme_id: schemeId, room_id: roomId, material }, { onConflict: 'scheme_id,room_id' }),
    )
  },

  clearRoomFloor: async (roomId) => {
    const schemeId = await activeSchemeId()
    check(await supabase.from('room_floors').delete().match({ scheme_id: schemeId, room_id: roomId }))
  },

  loadFurniture: async () => {
    const rows = check(await supabase.from('furniture_items').select(FURNITURE_COLUMNS).order('created_at'))
    return ((rows ?? []) as FurnitureRow[]).map(fromRow)
  },

  insertFurniture: async (item) => {
    const row = check(await supabase.from('furniture_items').insert(toRow(item)).select(FURNITURE_COLUMNS).single())
    return fromRow(row as FurnitureRow)
  },

  updateFurniture: async (item) => {
    check(await supabase.from('furniture_items').update(toRow(item)).eq('id', item.id))
  },

  deleteFurniture: async (id) => {
    check(await supabase.from('furniture_items').delete().eq('id', id))
  },

  // Needs the tables in the `supabase_realtime` publication (see the migrations).
  subscribe: (onChange, onResync) => {
    const channel = supabase
      .channel('casa-house')
      .on('postgres_changes', { event: '*', schema: 'house', table: 'walls' }, async (payload) => {
        const deleted = payload.eventType === 'DELETE'
        const row = (deleted ? payload.old : payload.new) as Partial<WallRow>
        if (!row.wall_id || !row.side || row.scheme_id !== (await activeSchemeId())) return
        onChange({ kind: 'wall', wallId: row.wall_id, side: row.side, color: deleted ? undefined : row.color })
      })
      .on('postgres_changes', { event: '*', schema: 'house', table: 'room_floors' }, async (payload) => {
        const deleted = payload.eventType === 'DELETE'
        const row = (deleted ? payload.old : payload.new) as Partial<RoomFloorRow>
        if (!row.room_id || row.scheme_id !== (await activeSchemeId())) return
        onChange({ kind: 'room-floor', roomId: row.room_id, material: deleted ? undefined : row.material })
      })
      .on('postgres_changes', { event: '*', schema: 'house', table: 'furniture_items' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (id) onChange({ kind: 'furniture-deleted', id })
        } else onChange({ kind: 'furniture', item: fromRow(payload.new as FurnitureRow) })
      })
      .subscribe((status) => {
        // Also fires after a dropped connection comes back (phone asleep, network switch): catch up then.
        if (status === 'SUBSCRIBED') onResync()
      })
    return () => {
      supabase.removeChannel(channel)
    }
  },
}
