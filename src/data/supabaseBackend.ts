import { supabase } from '../lib/supabase'
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
}

const FURNITURE_COLUMNS = 'id, floor, name, width, depth, height, x, y, rotation, color'

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
}
