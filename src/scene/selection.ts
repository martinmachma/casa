import type { WallSide } from '../layout/types'

export type Selection =
  | { kind: 'wall'; wallId: string; side: WallSide }
  | { kind: 'furniture'; id: string }
  | { kind: 'room'; roomId: string }

export type CameraMode = 'top' | 'orbit' | 'walk'

/** What a tap in the 3D view does: nothing while just looking, select and drag while editing, or measure. */
export type Interaction = 'view' | 'edit' | 'measure'
