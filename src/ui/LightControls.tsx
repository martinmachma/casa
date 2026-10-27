import { KELVIN_MAX, KELVIN_MIN, kelvinColor, type LightState } from '../devices/lights'
import { Section, Segmented, Switch } from './kit'

const COLORS = ['#ff3b30', '#ff8a3d', '#ffcc00', '#34c759', '#30b0c7', '#007aff', '#5856d6', '#ff2d92']
// The temperature slider's track runs warm to cool, as the light would look.
const KELVIN_TRACK = `linear-gradient(to right, ${[KELVIN_MIN, 3000, 4000, 5000, KELVIN_MAX].map(kelvinColor).join(', ')})`

type LightControlsProps = {
  light: LightState
  /** The Home Assistant entity it will be linked to, if set. */
  entity: string | undefined
  onChange: (patch: Partial<LightState>) => void
}

/** Everything a Home Assistant light offers: on/off, brightness, and a shade of white or a colour. */
export const LightControls = ({ light, entity, onChange }: LightControlsProps) => (
  <Section
    title="Light"
    aside={<span className="muted num">{light.on ? `${Math.round(light.brightness * 100)} %` : 'Off'}</span>}
  >
    <Switch label="On" checked={light.on} onChange={(on) => onChange({ on })} />
    <label className="field">
      Brightness
      <input
        type="range"
        min={1}
        max={100}
        value={Math.round(light.brightness * 100)}
        onChange={(e) => onChange({ on: true, brightness: Number(e.target.value) / 100 })}
      />
    </label>
    <Segmented
      label="Light colour"
      block
      value={light.mode}
      options={[
        { value: 'white', label: 'White' },
        { value: 'color', label: 'Colour' },
      ]}
      onChange={(mode) => onChange({ mode })}
    />
    {light.mode === 'white' ? (
      <label className="field">
        Temperature <span className="muted num">{light.kelvin} K</span>
        <input
          type="range"
          className="kelvin"
          style={{ background: KELVIN_TRACK }}
          min={KELVIN_MIN}
          max={KELVIN_MAX}
          step={100}
          value={light.kelvin}
          onChange={(e) => onChange({ kelvin: Number(e.target.value) })}
        />
      </label>
    ) : (
      <>
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className="swatch"
              style={{ background: c }}
              aria-label={c}
              title={c}
              aria-pressed={light.color.toLowerCase() === c}
              onClick={() => onChange({ color: c })}
            />
          ))}
        </div>
        <label className="color-field">
          <input type="color" value={light.color} onChange={(e) => onChange({ color: e.target.value })} />
          <span>Custom colour</span>
        </label>
      </>
    )}
    <p className="hint">
      {entity
        ? `Only here in the app for now; it isn't linked to ${entity} yet.`
        : 'Only here in the app for now, until it’s linked to a real light.'}
    </p>
  </Section>
)
