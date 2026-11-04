import { Lightbulb } from 'lucide-react'
import { type CSSProperties, type PointerEvent, useRef } from 'react'
import { colorHue, hueColor, KELVIN_MAX, KELVIN_MIN, kelvinColor, lightColor, type LightState } from '../devices/lights'
import { DIAL_START, DIAL_SWEEP, dialFraction, dialPoint } from './dial'
import { Section, Segmented } from './kit'

// The dial, in px: its box, the middle of its ring, and the hole inside the ring, where the bulb button sits.
const DIAL_SIZE = 148
const DIAL_RADIUS = 62
const DIAL_HOLE = 42

const conic = (stops: string[]) =>
  `conic-gradient(from ${DIAL_START}deg, ${stops.map((c, i) => `${c} ${(i * DIAL_SWEEP) / (stops.length - 1)}deg`).join(', ')}, transparent ${DIAL_SWEEP}deg)`

// The ring shows what each stop of the dial looks like: the whites, warm to cool, or the hues.
const WHITES = Array.from({ length: 9 }, (_, i) => kelvinColor(KELVIN_MIN + (i * (KELVIN_MAX - KELVIN_MIN)) / 8))
const HUES = [0, 60, 120, 180, 240, 300, 360].map(hueColor)

const dialAt = (t: number) => {
  const { x, y } = dialPoint(t, DIAL_RADIUS)
  return { x: DIAL_SIZE / 2 + x, y: DIAL_SIZE / 2 + y }
}
const ARC_START = dialAt(0)
const ARC_END = dialAt(1)

type LightControlsProps = {
  light: LightState
  onChange: (patch: Partial<LightState>) => void
}

/** Everything a Home Assistant light offers: on/off, brightness, and a shade of white or a colour. */
export const LightControls = ({ light, onChange }: LightControlsProps) => {
  const dragging = useRef(false)
  const white = light.mode === 'white'
  const hue = colorHue(light.color)
  const shade = lightColor(light)
  const percent = Math.round(light.brightness * 100)
  const stops = white ? WHITES : HUES
  const fraction = white ? (light.kelvin - KELVIN_MIN) / (KELVIN_MAX - KELVIN_MIN) : hue / 360
  const thumb = dialAt(fraction)

  const setFraction = (t: number) =>
    onChange(
      white
        ? { kelvin: Math.round((KELVIN_MIN + t * (KELVIN_MAX - KELVIN_MIN)) / 100) * 100 }
        : { color: hueColor(t * 360) },
    )

  // The dial may be scaled on screen, so pointers are measured in its own px.
  const pointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - box.left) / box.width - 0.5) * DIAL_SIZE,
      y: ((e.clientY - box.top) / box.height - 0.5) * DIAL_SIZE,
    }
  }

  return (
    <Section className="light-controls">
      <Segmented
        label="Light colour"
        block
        className="light-mode"
        value={light.mode}
        options={[
          { value: 'white', label: 'Temperature' },
          { value: 'color', label: 'Colour' },
        ]}
        onChange={(mode) => onChange({ mode })}
      />
      <div
        className="light-dial"
        onPointerDown={(e) => {
          const { x, y } = pointer(e)
          if (Math.hypot(x, y) < DIAL_HOLE) return
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          setFraction(dialFraction(x, y))
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return
          const { x, y } = pointer(e)
          setFraction(dialFraction(x, y))
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <svg viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`} aria-hidden="true">
          <path
            d={`M ${ARC_START.x} ${ARC_START.y} A ${DIAL_RADIUS} ${DIAL_RADIUS} 0 1 1 ${ARC_END.x} ${ARC_END.y}`}
          />
        </svg>
        <div className="light-dial-ring" style={{ background: conic(stops) }} />
        <span className="light-dial-cap" style={{ left: ARC_START.x, top: ARC_START.y, background: stops[0] }} />
        <span className="light-dial-cap" style={{ left: ARC_END.x, top: ARC_END.y, background: stops.at(-1) }} />
        <span className="light-dial-thumb" style={{ left: thumb.x, top: thumb.y, background: shade }} />
        <button
          className="light-dial-power"
          style={{
            background: light.on
              ? `color-mix(in srgb, ${shade} ${35 + light.brightness * 65}%, var(--surface-3))`
              : undefined,
          }}
          aria-label={light.on ? 'Turn off' : 'Turn on'}
          title={light.on ? 'Turn off' : 'Turn on'}
          aria-pressed={light.on}
          onClick={() => onChange({ on: !light.on })}
        >
          <Lightbulb size={20} />
        </button>
        <span className="light-dial-value num">{!light.on ? 'Off' : white ? `${light.kelvin} K` : `${hue}°`}</span>
        <input
          type="range"
          aria-label={white ? 'Temperature' : 'Colour'}
          min={white ? KELVIN_MIN : 0}
          max={white ? KELVIN_MAX : 360}
          step={white ? 100 : 1}
          value={white ? light.kelvin : hue}
          onChange={(e) => {
            const value = Number(e.target.value)
            onChange(white ? { kelvin: value } : { color: hueColor(value) })
          }}
        />
      </div>
      <input
        type="range"
        className="light-brightness"
        aria-label="Brightness"
        title={`${percent} %`}
        style={
          {
            background: `linear-gradient(to right, var(--brightness-dim), ${shade})`,
            '--brightness-thumb': `color-mix(in srgb, ${shade} ${percent}%, var(--brightness-dim))`,
          } as CSSProperties
        }
        min={1}
        max={100}
        value={percent}
        onChange={(e) => onChange({ on: true, brightness: Number(e.target.value) / 100 })}
      />
    </Section>
  )
}
