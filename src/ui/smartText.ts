import type { DeviceKind } from '../data/types'
import type { LightState } from '../devices/lights'
import type { SmartItem } from '../rooms/roomItems'

export const KIND_GROUPS: Record<DeviceKind, string> = {
  light: 'Lights',
  switch: 'Switches',
  socket: 'Sockets',
  sensor: 'Sensors',
  thermostat: 'Thermostats',
  blind: 'Blinds',
  other: 'Other',
}

export const percent = (light: LightState) => `${Math.round(light.brightness * 100)} %`

/** What an item is doing, in a few words. */
export const itemState = (item: SmartItem, light: LightState | undefined) =>
  item.kind !== 'light' || !light
    ? item.entity
      ? 'Not linked yet'
      : 'Not linked'
    : light.on
      ? `On · ${percent(light)}`
      : 'Off'

/** "2 of 3 lights on", "All 3 lights off", "Light on". */
export const lightsSummary = (on: number, total: number) =>
  total === 1 ? (on ? 'Light on' : 'Light off') : on ? `${on} of ${total} lights on` : `All ${total} lights off`
