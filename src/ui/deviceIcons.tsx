import { Blinds, CircleHelp, Lightbulb, Plug, Radar, Thermometer, ToggleLeft } from 'lucide-react'
import type { DeviceKind } from '../data/types'

const ICONS = {
  light: Lightbulb,
  switch: ToggleLeft,
  socket: Plug,
  sensor: Radar,
  thermostat: Thermometer,
  blind: Blinds,
  other: CircleHelp,
}

export const DeviceIcon = ({ kind, size = 16 }: { kind: DeviceKind; size?: number }) => {
  const Icon = ICONS[kind]
  return <Icon size={size} />
}
