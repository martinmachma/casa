import { X } from 'lucide-react'
import { type RefObject } from 'react'
import { DEVICE_KINDS } from '../devices/kinds'
import type { LightState } from '../devices/lights'
import type { SmartItem } from '../rooms/roomItems'
import { DeviceIcon } from './deviceIcons'
import { IconButton } from './kit'
import { LightControls } from './LightControls'

type RoomOverviewProps = {
  title: string
  area: number | undefined
  items: SmartItem[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  open: string | undefined
  onOpen: (id: string | undefined) => void
  onClose: () => void
  /** The open item's popover, moved over its item every frame. */
  pinRefs: RefObject<Map<string, HTMLElement | null>>
}

const state = (item: SmartItem, light: LightState | undefined) =>
  item.kind !== 'light' || !light
    ? item.entity
      ? 'Not linked yet'
      : 'Not linked'
    : light.on
      ? `On · ${Math.round(light.brightness * 100)} %`
      : 'Off'

/** The room's own view: cards down the right with what's in it, and a popover by the item picked. */
export const RoomOverview = ({
  title,
  area,
  items,
  light,
  onLight,
  open,
  onOpen,
  onClose,
  pinRefs,
}: RoomOverviewProps) => {
  const picked = items.find((i) => i.id === open)
  // An item pointed at, on its marker or its card: it stands out and the rest of the view dims.
  return (
    <>
      <div className="room-cards">
        <section className="room-card float">
          <header className="room-card-head">
            <div>
              <div className="eyebrow">Room</div>
              <h2 className="panel-title">{title}</h2>
              {area !== undefined && <div className="panel-sub num">{area.toFixed(1)} m²</div>}
            </div>
            <IconButton label="Back to the house" small onClick={onClose}>
              <X size={18} />
            </IconButton>
          </header>
        </section>
        <section className="room-card float">
          <h3 className="room-card-title">Smart items</h3>
          {items.length ? (
            <ul className="smart-list">
              {items.map((item) => {
                const s = item.kind === 'light' ? light(item.id) : undefined
                return (
                  <li key={item.id}>
                    <button
                      className="smart-item"
                      aria-pressed={open === item.id}
                      onClick={() => onOpen(open === item.id ? undefined : item.id)}
                    >
                      <span
                        className="device-swatch"
                        data-on={s?.on || undefined}
                        style={{ background: DEVICE_KINDS[item.kind].color }}
                      >
                        <DeviceIcon kind={item.kind} size={16} />
                      </span>
                      <span className="smart-item-text">
                        <span>{item.name}</span>
                        <span className="muted">
                          {item.lamp ? 'Lamp' : DEVICE_KINDS[item.kind].label} · {state(item, s)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="hint">No smart items here yet. Place them under Planning → Devices.</p>
          )}
        </section>
      </div>

      <div className="overlay">
        {picked && (
          <div
            className="room-pin"
            ref={(el) => {
              pinRefs.current.set(picked.id, el)
            }}
          >
            <div className="room-popover float" role="dialog" aria-label={picked.name}>
              <header className="room-card-head">
                <div>
                  <div className="eyebrow">{picked.lamp ? 'Lamp' : DEVICE_KINDS[picked.kind].label}</div>
                  <strong>{picked.name}</strong>
                </div>
                <IconButton label="Close" small onClick={() => onOpen(undefined)}>
                  <X size={16} />
                </IconButton>
              </header>
              {picked.kind === 'light' ? (
                <LightControls
                  light={light(picked.id)}
                  entity={picked.entity}
                  onChange={(p) => onLight(picked.id, p)}
                />
              ) : (
                <p className="hint">
                  {picked.entity
                    ? `It will show ${picked.entity} once Home Assistant is linked.`
                    : 'Give it a Home Assistant entity under Planning to control it here.'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
