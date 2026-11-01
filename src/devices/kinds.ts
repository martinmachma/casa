import type { DeviceKind } from '../data/types'

type KindInfo = {
  label: string
  /** Default height above the floor, metres; `ceiling` hangs it from the ceiling instead of a wall. */
  height: number | 'ceiling'
  color: string
}

export const DEVICE_KINDS: Record<DeviceKind, KindInfo> = {
  light: { label: 'Light', height: 'ceiling', color: '#e8b64c' },
  switch: { label: 'Switch', height: 1.1, color: '#f4f1ec' },
  socket: { label: 'Socket', height: 0.3, color: '#e6e2db' },
  sensor: { label: 'Sensor', height: 2.2, color: '#6fa3b5' },
  thermostat: { label: 'Thermostat', height: 1.5, color: '#c8664a' },
  blind: { label: 'Blind', height: 2.3, color: '#8a8d90' },
  data: { label: 'Data outlet', height: 0.25, color: '#438caa' },
  tv: { label: 'TV outlet', height: 0.25, color: '#7963ab' },
  connection: { label: 'Connection point', height: 1.1, color: '#dba348' },
  panel: { label: 'Distribution board', height: 1.5, color: '#89959e' },
  fan: { label: 'Extractor fan', height: 2.3, color: '#66a49b' },
  bell: { label: 'Doorbell', height: 1.1, color: '#ba9571' },
  earth: { label: 'Earth connection', height: 0.25, color: '#8d9b4b' },
  other: { label: 'Other', height: 1.1, color: '#a597b5' },
}

export const onCeiling = (kind: DeviceKind) => DEVICE_KINDS[kind].height === 'ceiling'

/** The kind's usual height above the floor, the ceiling being the floor's wall height. */
export const defaultHeight = (kind: DeviceKind, ceiling: number) => {
  const h = DEVICE_KINDS[kind].height
  return h === 'ceiling' ? ceiling : h
}
