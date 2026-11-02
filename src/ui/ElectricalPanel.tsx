import type { Device } from '../data/types'
import type { ReactNode } from 'react'
import { ELECTRICAL_ROUTES } from '../devices/electrical'
import { DEVICE_KINDS } from '../devices/kinds'
import { deviceRoom } from '../devices/place'
import { floorRegions } from '../layout/rooms'
import { roomLabel } from '../layout/roomName'
import type { Floor } from '../layout/types'
import { DeviceIcon } from './deviceIcons'
import { PanelHead, Section } from './kit'

export const ElectricalPanel = ({
  floor,
  devices,
  outside,
  roomNames,
  onSelect,
  onClose,
}: {
  floor: Floor
  devices: Device[]
  outside: boolean
  roomNames: Map<string, string>
  onSelect: (id: string) => void
  onClose: () => void
}) => {
  const regions = floorRegions(floor)
  const groups = outside
    ? [
        { name: 'Exterior', devices: devices.filter((d) => d.plan?.area === 'outside') },
        { name: 'Roof', devices: devices.filter((d) => d.plan?.area === 'roof') },
      ]
    : floor.rooms.map((room) => ({
        name: roomLabel(room, roomNames).name,
        devices: devices.filter(
          (d) => d.floor === floor.id && d.plan?.area === 'inside' && deviceRoom(d, floor, regions) === room.id,
        ),
      }))
  const count = groups.reduce((n, g) => n + g.devices.length, 0)
  return (
    <>
      <PanelHead
        eyebrow="Electrical plan"
        title={outside ? 'Exterior & roof' : floor.name}
        sub={`${count} fixed electrical points`}
        onClose={onClose}
      />
      <Section>
        <p className="hint">
          Power, TV, double RJ45 outlets, switches and service connections from the electrical drawings. Pick a point
          for details.
        </p>
        <p className="hint">
          Positions are approximate. The plan assumes sockets at 25 cm and switches at 110 cm; appliance and other
          heights need confirmation.
        </p>
        <div className="electrical-legend">
          <span style={{ color: '#ba7c31' }}>● Power</span>
          <span style={{ color: '#438caa' }}>● Data</span>
          <span style={{ color: '#7963ab' }}>● TV</span>
          <span style={{ color: '#8d9b4b' }}>● Earth</span>
        </div>
      </Section>
      {groups
        .filter((g) => g.devices.length)
        .map((group) => (
          <Section key={group.name}>
            <h3 className="smart-group">
              {group.name} · {group.devices.length}
            </h3>
            <ul className="electrical-list">
              {group.devices.map((d) => (
                <li key={d.id}>
                  <button className="smart-item" onClick={() => onSelect(d.id)}>
                    <span className="smart-tile">
                      <DeviceIcon kind={d.kind} />
                    </span>
                    <span className="smart-item-text">
                      <span>{d.name}</span>
                      <span className="muted">{d.plan?.symbol}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ))}
      <Section>
        <h3 className="smart-group">Cable routes & provisions</h3>
        <p className="hint">
          Only the drawn service routes and risers are shown. Room-to-room power, TV and Ethernet cable paths are not
          specified.
        </p>
        {ELECTRICAL_ROUTES.filter((r) => (outside ? r.area !== 'inside' : r.area === 'inside')).map((r) => (
          <p className="hint" key={r.id}>
            <strong>{r.name}.</strong> {r.notes}
          </p>
        ))}
      </Section>
      <Section>
        <h3 className="smart-group">Heating</h3>
        <p className="hint">
          Radiator outlines appear beneath windows in the background drawing. The plans also mark a bathroom towel rail
          connection, boiler and circulation pump sockets, and two heated roof drains. Radiator sizes, pipework and
          underfloor heating circuits are not specified.
        </p>
      </Section>
    </>
  )
}

export const ElectricalDetails = ({
  device,
  room,
  onClose,
  children,
}: {
  device: Device
  room?: string
  onClose: () => void
  children?: ReactNode
}) => (
  <>
    <PanelHead
      eyebrow={DEVICE_KINDS[device.kind].label}
      title={device.name}
      sub={[room, `${Math.round(device.z * 100)} cm above floor`].filter(Boolean).join(' · ')}
      onClose={onClose}
    />
    {children}
    <Section>
      <p>
        <strong>{device.plan!.symbol}</strong>
      </p>
      {device.plan!.ports && (
        <p>
          {device.plan!.ports} {device.kind === 'data' ? 'RJ45 ports' : 'outlet'}
        </p>
      )}
      {device.plan!.notes && <p className="hint">{device.plan!.notes}</p>}
      <p className="hint">
        Electrical drawing {device.plan!.sheet} ·{' '}
        {device.plan!.area === 'roof' ? 'Roof' : device.floor === 'ground' ? '1.NP' : '2.NP'}.
      </p>
      <p className="hint">
        Fixed point from the plan. Position and height are indicative; confirm on site and with the final kitchen,
        lighting and heating designs.
      </p>
    </Section>
  </>
)
