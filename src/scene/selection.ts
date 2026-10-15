import type { WallSide } from '../layout/types'

export type Selection =
  | { kind: 'wall'; wallId: string; side: WallSide }
  | { kind: 'furniture'; id: string }
  | { kind: 'room'; roomId: string }
  | { kind: 'device'; id: string }

export type CameraMode = 'top' | 'orbit' | 'walk'

/**
 * What a tap in the 3D view does: nothing while just looking, select and drag while editing, measure, or place and
 * drag smart-home devices.
 */
export type Interaction = 'view' | 'edit' | 'measure' | 'devices'
