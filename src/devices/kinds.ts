import type { Device, DeviceKind } from '../data/types'

/** Lights can be added on a ceiling or a wall; both remain the same smart device kind. */
export type DevicePlacement = DeviceKind | 'wall-light'

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

export const onCeiling = (kind: DevicePlacement) => kind !== 'wall-light' && DEVICE_KINDS[kind].height === 'ceiling'

/** The kind's usual height above the floor, the ceiling being the floor's wall height. */
export const defaultHeight = (kind: DevicePlacement, ceiling: number) => {
  if (kind === 'wall-light') return Math.min(2.2, ceiling - 0.15)
  const h = DEVICE_KINDS[kind].height
  return h === 'ceiling' ? ceiling : h
}

/** A numbered name for a light put in by hand ("Wall light 2"), counted apart from the electrical plan's lights. */
export const newDeviceName = (device: Pick<Device, 'kind' | 'wall'>, devices: Device[]) => {
  const label =
    device.kind === 'light' ? (device.wall ? 'Wall light' : 'Ceiling light') : DEVICE_KINDS[device.kind].label
  const taken = new Set(devices.map((d) => d.name))
  let n = devices.filter((d) => !d.plan && d.kind === device.kind && !d.wall === !device.wall).length + 1
  while (taken.has(`${label} ${n}`)) n++
  return `${label} ${n}`
}
