import { ChevronRight, Power } from 'lucide-react'
import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { lightColor, type LightState } from '../devices/lights'
import { shadeText, type ShadeState } from '../devices/shades'
import type { SmartItem } from '../rooms/roomItems'
import { DeviceIcon } from './deviceIcons'

type SmartRowProps = {
  item: SmartItem
  sub?: string
  /** Its settings, for a light. */
  light?: LightState
  pressed?: boolean
  /** Its item is pointed at in the scene. */
  hovered?: boolean
  onOpen: () => void
  onHover?: (hovering: boolean) => void
  onLight?: (patch: Partial<LightState>) => void
}

/** One smart item: its tile lit in the light's own colour while on, and a switch for a light. */
export const SmartRow = ({ item, sub, light, pressed, hovered, onOpen, onHover, onLight }: SmartRowProps) => {
  const on = !!light?.on
  return (
    <li
      className="smart-row"
      data-hovered={hovered || undefined}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
    >
      <button className="smart-item" aria-pressed={pressed} onClick={onOpen}>
        <span
          className="smart-tile"
          data-on={on || undefined}
          style={on ? { background: lightColor(light) } : undefined}
        >
          <DeviceIcon kind={item.kind} size={16} />
        </span>
        <span className="smart-item-text">
          <span className="smart-item-name">{item.name}</span>
          {sub && <span className="muted">{sub}</span>}
        </span>
      </button>
      {light && onLight && (
        <label className="switch smart-switch">
          <input
            type="checkbox"
            role="switch"
            aria-label={`${item.name} on`}
            checked={on}
            onChange={(e) => onLight({ on: e.target.checked })}
          />
          <span className="switch-track" aria-hidden />
        </label>
      )}
    </li>
  )
}

type SmartTileProps = {
  item: SmartItem
  /** Its settings, for a light: a tap switches it. */
  light?: LightState
  /** Its position, for a window's shade. */
  shade?: ShadeState
  /** Its card is open. */
  pressed?: boolean
  /** Its item is pointed at in the scene. */
  hovered?: boolean
  /** Opens its card: a tap for anything but a light, a right-click for a light. */
  onOpen: () => void
  onHover: (hovering: boolean) => void
  onLight: (patch: Partial<LightState>) => void
}

/** A smart item as a tile: its icon, lit in the light's colour while on, over its name and state. */
export const SmartTile = ({ item, light, shade, pressed, hovered, onOpen, onHover, onLight }: SmartTileProps) => {
  const on = !!light?.on
  return (
    <button
      className="smart-light"
      aria-pressed={light ? on : undefined}
      data-open={pressed || undefined}
      data-hovered={hovered || undefined}
      title={light ? `${item.name}: click to switch, right-click for brightness and colour` : item.name}
      onClick={() => (light ? onLight({ on: !on }) : onOpen())}
      onContextMenu={(e) => {
        e.preventDefault()
        onOpen()
      }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <span
        className="smart-light-bulb"
        data-on={on || undefined}
        style={on ? { background: lightColor(light) } : undefined}
      >
        <DeviceIcon kind={item.kind} size={18} />
      </span>
      <span className="smart-light-name">{item.name}</span>
      <span className="smart-light-state">
        {light
          ? on
            ? `${Math.round(light.brightness * 100)} %`
            : 'Off'
          : shade
            ? shadeText(shade)
            : item.lamp
              ? 'Lamp'
              : 'Not linked'}
      </span>
    </button>
  )
}

type SmartCardProps = {
  title: string
  summary: string
  /** Switches every light off, or on when all are off; left out when there are none. */
  allLights?: { on: boolean; onChange: (on: boolean) => void }
  children: ReactNode
}

/** The card down the right that lists smart items, with a switch for all the lights. */
export const SmartCard = ({ title, summary, allLights, children }: SmartCardProps) => (
  <section className="room-card float">
    <header className="smart-card-head">
      <div>
        <h3 className="smart-card-title">{title}</h3>
        <div className="muted">{summary}</div>
      </div>
      {allLights && (
        <button className="btn btn-small" onClick={() => allLights.onChange(!allLights.on)}>
          <Power size={15} />
          {allLights.on ? 'All off' : 'All on'}
        </button>
      )}
    </header>
    <div className="smart-card-body">{children}</div>
  </section>
)

type SmartTagProps = {
  item: SmartItem
  light?: LightState
  shade?: ShadeState
  onOpen: () => void
  onHover: (hovering: boolean) => void
  onLight?: (patch: Partial<LightState>) => void
}

/** The line from an item to its tag, or to the card the tag opens into: it leaves at an angle, then runs flat. */
export const TagLine = ({ reach = 14 }: { reach?: number }) => (
  <svg className="smart-tag-line" width={26 + reach} height="30" viewBox={`0 0 ${26 + reach} 30`} aria-hidden>
    <polyline points={`6,22 20,8 ${20 + reach},8`} />
  </svg>
)

/** The tag over an item in the room's view: its icon and what it's doing; a light's tag is its own dimmer. */
export const SmartTag = ({ item, light, shade, onOpen, onHover, onLight }: SmartTagProps) => {
  if (light && onLight) return <LightTag item={item} light={light} onOpen={onOpen} onHover={onHover} onLight={onLight} />
  return (
    <>
      <TagLine />
      <button
        className="smart-tag"
        aria-label={item.name}
        onClick={onOpen}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <span className="smart-tag-icon">
          <DeviceIcon kind={item.kind} size={12} />
        </span>
        {shade && <span className="muted">{shadeText(shade)}</span>}
      </button>
    </>
  )
}

/** How long a finger rests on a light's tag before it opens into the dimmer. */
const HOLD_MS = 350
/** How long a dimmer opened by a finger stays open once it lets go. */
const LINGER_MS = 1800
const RING = 2 * Math.PI * 12

type LightTagProps = {
  item: SmartItem
  light: LightState
  onOpen: () => void
  onHover: (hovering: boolean) => void
  onLight: (patch: Partial<LightState>) => void
}

/**
 * A light's tag: its icon in a ring that fills, in the light's colour, as bright as it is. A click or tap switches
 * it; hovering, or holding a finger on it, opens it into a dimmer to drag across, with a way into its card.
 */
const LightTag = ({ item, light, onOpen, onHover, onLight }: LightTagProps) => {
  const [hover, setHover] = useState(false)
  const [held, setHeld] = useState(false)
  const press = useRef<{ x: number; y: number; dimming: boolean; held: boolean; moved: boolean }>(undefined)
  const holdTimer = useRef<number>(undefined)
  const lingerTimer = useRef<number>(undefined)
  useEffect(
    () => () => {
      clearTimeout(holdTimer.current)
      clearTimeout(lingerTimer.current)
    },
    [],
  )
  const open = hover || held
  const on = light.on
  const level = on ? light.brightness : 0
  const color = lightColor(light)
  const percent = `${Math.round(light.brightness * 100)} %`

  const dimTo = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const b = Math.min(1, Math.max(0.05, (e.clientX - r.left) / r.width))
    onLight({ on: true, brightness: Math.round(b * 100) / 100 })
  }
  const linger = () => {
    clearTimeout(lingerTimer.current)
    lingerTimer.current = window.setTimeout(() => setHeld(false), LINGER_MS)
  }

  return (
    <>
      <TagLine />
      <div
        className="smart-tag light-tag"
        data-open={open || undefined}
        data-off={!on || undefined}
        onPointerEnter={(e) => {
          onHover(true)
          if (e.pointerType === 'mouse') setHover(true)
        }}
        onPointerLeave={(e) => {
          onHover(false)
          if (e.pointerType === 'mouse' && !press.current) setHover(false)
        }}
      >
        <button
          className="light-tag-dimmer"
          aria-label={`${item.name}: ${on ? percent : 'off'}`}
          title={open ? 'Click to switch, drag to dim' : 'Click to switch'}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            clearTimeout(lingerTimer.current)
            press.current = { x: e.clientX, y: e.clientY, dimming: open, held: false, moved: false }
            if (!open)
              holdTimer.current = window.setTimeout(() => {
                if (press.current) Object.assign(press.current, { dimming: true, held: true })
                setHeld(true)
              }, HOLD_MS)
          }}
          onPointerMove={(e) => {
            const p = press.current
            if (!p) return
            const far = Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4
            if (!p.dimming) {
              // A finger moving before the hold lands is turning the view, not pressing the tag.
              if (far) {
                clearTimeout(holdTimer.current)
                press.current = undefined
              }
              return
            }
            if (far) p.moved = true
            if (p.moved) dimTo(e)
          }}
          onPointerUp={(e) => {
            const p = press.current
            clearTimeout(holdTimer.current)
            press.current = undefined
            if (!p) return
            // A quick tap switches; a hold that never slid just leaves the dimmer open.
            if (!p.moved && !p.held) onLight({ on: !on })
            if (p.held || held) linger()
            if (e.pointerType === 'mouse' && !e.currentTarget.parentElement?.matches(':hover')) setHover(false)
          }}
          onPointerCancel={() => {
            clearTimeout(holdTimer.current)
            press.current = undefined
          }}
          onClick={(e) => {
            // Pointers are handled above; this is Enter or Space.
            if (e.detail === 0) onLight({ on: !on })
          }}
          onKeyDown={(e: KeyboardEvent) => {
            const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.1 : 0
            if (!step) return
            e.preventDefault()
            onLight({ on: true, brightness: Math.round(Math.min(1, Math.max(0.05, level + step)) * 100) / 100 })
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="light-tag-fill" style={{ width: `${open ? level * 100 : 0}%`, background: color }} />
          <span className="smart-tag-icon" style={on ? { background: color } : undefined}>
            {!open && (
              <svg className="light-tag-ring" width="26" height="26" viewBox="0 0 26 26" aria-hidden>
                <circle cx="13" cy="13" r="12" />
                <circle cx="13" cy="13" r="12" style={{ stroke: color }} strokeDasharray={`${level * RING} ${RING}`} />
              </svg>
            )}
            <DeviceIcon kind={item.kind} size={13} />
          </span>
          <span className="light-tag-level">{on ? percent : 'Off'}</span>
        </button>
        {open && (
          <button className="light-tag-more" aria-label={`Open ${item.name}`} title="Colour and more" onClick={onOpen}>
            <ChevronRight size={13} />
          </button>
        )}
      </div>
    </>
  )
}
