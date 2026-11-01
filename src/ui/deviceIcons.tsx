import {
  Bell,
  Blinds,
  Cable,
  CircleHelp,
  EthernetPort,
  Fan,
  Lightbulb,
  PanelTop,
  Plug,
  Radar,
  Thermometer,
  ToggleLeft,
  Tv,
  UtilityPole,
} from 'lucide-react'
import type { DeviceKind } from '../data/types'

const ICONS = {
  light: Lightbulb,
  switch: ToggleLeft,
  socket: Plug,
  sensor: Radar,
  thermostat: Thermometer,
  blind: Blinds,
  data: EthernetPort,
  tv: Tv,
  connection: Cable,
  panel: PanelTop,
  fan: Fan,
  bell: Bell,
  earth: UtilityPole,
  other: CircleHelp,
}

export const DeviceIcon = ({ kind, size = 16 }: { kind: DeviceKind; size?: number }) => {
  const Icon = ICONS[kind]
  return <Icon size={size} />
}
