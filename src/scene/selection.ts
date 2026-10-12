import type { WallSide } from '../layout/types'

export type Selection =
  | { kind: 'wall'; wallId: string; side: WallSide }
  | { kind: 'furniture'; id: string }
  | { kind: 'room'; roomId: string }

export type CameraMode = 'top' | 'orbit' | 'walk'
