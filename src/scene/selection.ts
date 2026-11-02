import type { WallFace } from '../layout/types'

export type Selection =
  /** A part of a wall side or end; with `area`, one painted area on it. */
  | { kind: 'wall'; wallId: string; side: WallFace; part: number; area?: string }
  /** One piece, or several picked with Shift/⌘ to move, turn, copy or remove together. */
  | { kind: 'furniture'; ids: string[] }
  | { kind: 'device'; id: string }
  /** A ceiling light (device id) or lamp (furniture id) picked while looking round, to switch and set. */
  | { kind: 'light'; id: string }

export type CameraMode = 'top' | 'orbit' | 'walk'

/** What a tap in the 3D view does: nothing while just looking, select, drag and place while editing, or measure. */
export type Interaction = 'view' | 'edit' | 'measure'
