import type { WallFace } from '../layout/types'

export type Selection =
  | { kind: 'wall'; wallId: string; side: WallFace; part: number }
  /** One piece, or several picked with Shift/⌘ to move, turn, copy or remove together. */
  | { kind: 'furniture'; ids: string[] }
  | { kind: 'room'; roomId: string }
  | { kind: 'device'; id: string }
  /** A ceiling light (device id) or lamp (furniture id) picked while looking round, to switch and set. */
  | { kind: 'light'; id: string }

export type CameraMode = 'top' | 'orbit' | 'walk'

/**
 * What a tap in the 3D view does: nothing while just looking, select and drag while editing, measure, or place and
 * drag smart-home devices.
 */
export type Interaction = 'view' | 'edit' | 'measure' | 'devices'
