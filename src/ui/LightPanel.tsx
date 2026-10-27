import type { LightState } from '../devices/lights'
import { LightControls } from './LightControls'
import { PanelHead } from './kit'

type LightPanelProps = {
  /** Ceiling light or lamp. */
  kind: string
  name: string
  room: string | undefined
  entity: string | undefined
  light: LightState
  onChange: (patch: Partial<LightState>) => void
  onClose: () => void
}

/** The right panel while looking round with a light picked: switch it and set its brightness and colour. */
export const LightPanel = ({ kind, name, room, entity, light, onChange, onClose }: LightPanelProps) => (
  <>
    <PanelHead eyebrow={kind} title={name} sub={room} onClose={onClose} />
    <LightControls light={light} entity={entity} onChange={onChange} />
  </>
)
