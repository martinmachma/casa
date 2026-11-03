import { Edges } from '@react-three/drei'
import type { ReactNode } from 'react'
import { FrontSide } from 'three'
import type { Device } from '../data/types'
import { SELECTED_OUTLINE } from './palette'
import { RoofDrain } from './RoofDrain'

// Generic fittings, not a claim about which products are installed. Wall/ceiling models attach at z = 0
// and face +z; Devices supplies their mounting orientation. Colours here describe materials, not categories.
const WHITE = '#f2f1ed'
const FACE = '#e4e5e1'
const SEAM = '#9ca09e'
const DARK = '#283036'
const METAL = '#969da1'
const noRaycast = () => null
type V = [number, number, number]
type PartProps = { at?: V; color?: string; selected?: boolean; children?: ReactNode; metal?: boolean; shadow?: boolean }

const Surface = ({ color = WHITE, metal = false }: { color?: string; metal?: boolean }) => (
  <meshStandardMaterial
    color={color}
    roughness={metal ? 0.55 : 0.65}
    metalness={metal ? 0.65 : 0}
    shadowSide={FrontSide}
  />
)

// Main casings cast shadows; tiny screws, contacts and vent marks only receive them.
const Box = ({ size, at = [0, 0, 0], color, selected, children, metal, shadow = false }: PartProps & { size: V }) => (
  <mesh position={at} castShadow={shadow} receiveShadow raycast={noRaycast}>
    <boxGeometry args={size} />
    <Surface color={color} metal={metal} />
    {selected && <Edges color={SELECTED_OUTLINE} />}
    {children}
  </mesh>
)

/** A circular part, with its axis pointing out of the mounting face. */
const Disc = ({
  radius,
  depth,
  at = [0, 0, 0],
  color,
  selected,
  metal,
  shadow = false,
}: PartProps & { radius: number; depth: number }) => (
  <mesh position={at} rotation-x={Math.PI / 2} castShadow={shadow} receiveShadow raycast={noRaycast}>
    <cylinderGeometry args={[radius, radius, depth, 24]} />
    <Surface color={color} metal={metal} />
    {selected && <Edges color={SELECTED_OUTLINE} />}
  </mesh>
)

const Ring = ({
  radius,
  tube = 0.002,
  at = [0, 0, 0],
  color = METAL,
}: {
  radius: number
  tube?: number
  at?: V
  color?: string
}) => (
  <mesh position={at} receiveShadow raycast={noRaycast}>
    <torusGeometry args={[radius, tube, 6, 32]} />
    <Surface color={color} metal />
  </mesh>
)

const Screws = ({ width, height, z }: { width: number; height: number; z: number }) => (
  <>
    {[-1, 1].flatMap((x) =>
      [-1, 1].map((y) => (
        <group key={`${x}:${y}`} position={[(x * width) / 2, (y * height) / 2, z]}>
          <Disc radius={0.003} depth={0.0015} color={METAL} metal />
          <Box size={[0.0035, 0.0007, 0.001]} at={[0, 0, 0.001]} color={DARK} />
        </group>
      )),
    )}
  </>
)

const Plate = ({
  selected,
  children,
  width = 0.086,
  height = 0.086,
  depth = 0.012,
}: {
  selected: boolean
  children?: ReactNode
  width?: number
  height?: number
  depth?: number
}) => (
  <>
    <Box size={[width, height, depth]} at={[0, 0, depth / 2 + 0.001]} selected={selected} shadow />
    <Box size={[width - 0.009, height - 0.009, 0.003]} at={[0, 0, depth + 0.002]} color={FACE} />
    {children}
  </>
)

const SmokeAlarm = ({ selected }: { selected: boolean }) => (
  <>
    <Disc radius={0.065} depth={0.012} at={[0, 0, 0.007]} color={FACE} selected={selected} shadow />
    <Disc radius={0.061} depth={0.027} at={[0, 0, 0.024]} shadow />
    <Disc radius={0.055} depth={0.006} at={[0, 0, 0.04]} />
    {/* Radial intake slots round the central test/hush button. */}
    {Array.from({ length: 12 }, (_, i) => (
      <group key={i} rotation-z={(i * Math.PI) / 6}>
        <Box size={[0.0035, 0.013, 0.0015]} at={[0, 0.04, 0.0435]} color={DARK} />
      </group>
    ))}
    <Disc radius={0.017} depth={0.002} at={[0, 0, 0.044]} color={FACE} />
    <Ring radius={0.0175} tube={0.0007} at={[0, 0, 0.045]} color={SEAM} />
    <Disc radius={0.0018} depth={0.001} at={[0.026, -0.02, 0.044]} color="#5a7563" />
  </>
)

const ExtractorFan = ({ selected }: { selected: boolean }) => (
  <>
    <Plate selected={selected} width={0.17} height={0.17} depth={0.018}>
      <Disc radius={0.064} depth={0.004} at={[0, 0, 0.023]} color={DARK} />
      <Ring radius={0.066} at={[0, 0, 0.027]} color={FACE} />
      {/* The impeller sits behind the protective grille. It is static, without a fictional running state. */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation-z={(i * Math.PI) / 2 + 0.4}>
          <Box size={[0.026, 0.04, 0.002]} at={[0, 0.025, 0.027]} color="#5e6567" />
        </group>
      ))}
      {[-0.048, -0.032, -0.016, 0, 0.016, 0.032, 0.048].map((y) => (
        <Box key={y} size={[2 * Math.sqrt(0.062 ** 2 - y ** 2), 0.005, 0.004]} at={[0, y, 0.033]} />
      ))}
      <Disc radius={0.012} depth={0.008} at={[0, 0, 0.032]} color={FACE} />
      <Screws width={0.144} height={0.144} z={0.022} />
    </Plate>
  </>
)

const MotionSensor = ({ selected }: { selected: boolean }) => (
  <>
    <Box size={[0.063, 0.077, 0.023]} at={[0, 0.006, 0.0125]} selected={selected} shadow />
    <mesh position={[0, -0.009, 0.023]} castShadow receiveShadow raycast={noRaycast}>
      <sphereGeometry args={[0.031, 12, 8, 0, Math.PI * 2, 0, Math.PI]} />
      <Surface color="#d8dfe0" />
    </mesh>
    <Box size={[0.038, 0.004, 0.002]} at={[0, 0.029, 0.025]} color={SEAM} />
  </>
)

const TemperatureSensor = ({ selected }: { selected: boolean }) => (
  <>
    <Box size={[0.05, 0.073, 0.024]} at={[0, 0, 0.013]} selected={selected} shadow />
    {[-0.02, -0.01, 0, 0.01, 0.02].map((y) => (
      <Box key={y} size={[0.035, 0.003, 0.0015]} at={[0, y, 0.026]} color={SEAM} />
    ))}
    <Screws width={0.036} height={0.06} z={0.026} />
  </>
)

const Socket = ({
  selected,
  protectedSocket,
  threePhase,
}: {
  selected: boolean
  protectedSocket: boolean
  threePhase: boolean
}) => {
  if (threePhase)
    return (
      <>
        <Plate selected={selected} width={0.105} height={0.13} depth={0.023} />
        <Disc radius={0.039} depth={0.027} at={[0, -0.006, 0.038]} color="#a63d36" />
        <Disc radius={0.03} depth={0.002} at={[0, -0.006, 0.053]} color={DARK} />
        {[0, 1, 2, 3, 4].map((i) => (
          <Disc
            key={i}
            radius={0.0038}
            depth={0.0015}
            at={[Math.sin((i * Math.PI * 2) / 5) * 0.018, -0.006 + Math.cos((i * Math.PI * 2) / 5) * 0.018, 0.055]}
            color={METAL}
            metal
          />
        ))}
        <Box size={[0.058, 0.009, 0.012]} at={[0, 0.041, 0.03]} color="#a63d36" />
        <Screws width={0.08} height={0.103} z={0.028} />
      </>
    )
  return (
    <>
      <Plate selected={selected} />
      <Disc radius={0.028} depth={0.002} at={[0, 0, 0.017]} color={SEAM} />
      <Disc radius={0.025} depth={0.003} at={[0, 0, 0.0195]} />
      {[-0.01, 0.01].map((x) => (
        <Disc key={x} radius={0.004} depth={0.0015} at={[x, -0.004, 0.022]} color={DARK} />
      ))}
      <Disc radius={0.0025} depth={0.008} at={[0, 0.012, 0.024]} color={METAL} metal />
      {protectedSocket && (
        <group position={[0, 0.034, 0.028]} rotation-x={-0.65}>
          <Box size={[0.074, 0.064, 0.005]} at={[0, -0.032, 0]} color={FACE} />
          <Box size={[0.078, 0.008, 0.009]} />
        </group>
      )}
    </>
  )
}

const WallSwitch = ({ device, selected }: { device: Device; selected: boolean }) => {
  const symbol = device.plan?.symbol ?? ''
  const button = symbol.startsWith('Push')
  const double = symbol.includes('Double') || symbol.includes('Series')
  return (
    <Plate selected={selected}>
      {button ? (
        <>
          <Disc radius={0.022} depth={0.004} at={[0, 0, 0.02]} color={SEAM} />
          <Disc radius={0.02} depth={0.005} at={[0, 0, 0.023]} />
        </>
      ) : (
        (double ? [-0.017, 0.017] : [0]).map((x) => (
          <group key={x} position={[x, 0, 0.019]} rotation-x={0.045}>
            <Box size={[double ? 0.031 : 0.064, 0.064, 0.005]} />
          </group>
        ))
      )}
    </Plate>
  )
}

const DataOutlet = ({ selected }: { selected: boolean }) => (
  <Plate selected={selected}>
    {[-0.018, 0.018].map((x) => (
      <group key={x} position={[x, 0, 0.018]}>
        <Box size={[0.026, 0.024, 0.003]} color={SEAM} />
        <Box size={[0.021, 0.017, 0.002]} at={[0, 0.001, 0.002]} color={DARK} />
        <Box size={[0.01, 0.005, 0.002]} at={[0, -0.009, 0.002]} color={DARK} />
        {[-0.006, -0.002, 0.002, 0.006].map((pin) => (
          <Box key={pin} size={[0.001, 0.006, 0.001]} at={[pin, 0.004, 0.0035]} color="#b79d63" metal />
        ))}
      </group>
    ))}
  </Plate>
)

const TvOutlet = ({ selected }: { selected: boolean }) => (
  <Plate selected={selected}>
    <Disc radius={0.014} depth={0.005} at={[0, 0, 0.019]} color={METAL} metal />
    <Disc radius={0.0095} depth={0.002} at={[0, 0, 0.023]} color={DARK} />
    <Ring radius={0.009} tube={0.0015} at={[0, 0, 0.025]} />
    <Disc radius={0.0015} depth={0.003} at={[0, 0, 0.026]} color={METAL} metal />
  </Plate>
)

const Cabinet = ({ device, selected }: { device: Device; selected: boolean }) => {
  const meter = device.plan?.symbol.startsWith('RE')
  const service = device.plan?.symbol === 'SP'
  const lowVoltage = device.plan?.symbol === 'SLA'
  const w = 0.3,
    h = 0.4,
    d = 0.085
  return (
    <>
      <Box size={[w, h, d]} at={[0, 0, d / 2 + 0.001]} color={service ? '#bec2c1' : WHITE} selected={selected} shadow />
      <Box size={[w - 0.018, h - 0.018, 0.004]} at={[0, 0, d + 0.004]} color={SEAM} />
      <Box size={[w - 0.025, h - 0.025, 0.006]} at={[0, 0, d + 0.009]} color={service ? '#c7cac8' : FACE} />
      <Box size={[0.01, 0.045, 0.009]} at={[w / 2 - 0.035, 0, d + 0.016]} color={METAL} metal />
      {[-0.12, 0.12].map((y) => (
        <Box key={y} size={[0.01, 0.028, 0.008]} at={[-w / 2 + 0.01, y, d + 0.01]} color={METAL} metal />
      ))}
      {meter ? (
        <>
          <Box size={[0.15, 0.2, 0.004]} at={[-0.015, 0.035, d + 0.015]} color={DARK} />
          <Box size={[0.11, 0.045, 0.002]} at={[-0.015, 0.075, d + 0.018]} color="#a4b0a5" />
          <Box size={[0.09, 0.006, 0.002]} at={[-0.015, 0.075, d + 0.02]} color="#54635b" />
          <Disc radius={0.019} depth={0.003} at={[-0.015, -0.015, d + 0.019]} color={SEAM} />
        </>
      ) : !service && !lowVoltage ? (
        [-0.065, 0.055].map((y) => (
          <group key={y} position={[0, y, d + 0.016]}>
            <Box size={[0.2, 0.065, 0.003]} color={DARK} />
            {[-0.072, -0.036, 0, 0.036, 0.072].map((x) => (
              <group key={x} position={[x, 0, 0.004]}>
                <Box size={[0.031, 0.052, 0.003]} />
                <Box size={[0.012, 0.018, 0.004]} at={[0, 0.006, 0.005]} color={DARK} />
              </group>
            ))}
          </group>
        ))
      ) : (
        lowVoltage &&
        [-0.1, -0.075, -0.05, 0.075, 0.1].map((y) => (
          <Box key={y} size={[0.18, 0.004, 0.002]} at={[-0.01, y, d + 0.014]} color={SEAM} />
        ))
      )}
      {service && <Disc radius={0.008} depth={0.004} at={[0, -0.1, d + 0.015]} color={METAL} metal />}
    </>
  )
}

const Doorbell = ({ button, selected }: { button: boolean; selected: boolean }) =>
  button ? (
    <>
      <Plate selected={selected} width={0.06} height={0.1} depth={0.018} />
      <Disc radius={0.017} depth={0.005} at={[0, -0.015, 0.025]} color={METAL} metal />
      <Ring radius={0.017} tube={0.002} at={[0, -0.015, 0.028]} color={DARK} />
      <Box size={[0.033, 0.012, 0.002]} at={[0, 0.025, 0.024]} color={FACE} />
    </>
  ) : (
    <>
      <Box size={[0.105, 0.155, 0.038]} at={[0, 0, 0.02]} selected={selected} shadow />
      {[-0.045, -0.03, -0.015, 0, 0.015, 0.03, 0.045].map((y) => (
        <Box key={y} size={[0.072, 0.003, 0.0015]} at={[0, y, 0.04]} color={SEAM} />
      ))}
    </>
  )

const Thermostat = ({ selected }: { selected: boolean }) => (
  <>
    <Plate selected={selected} width={0.1} height={0.1} depth={0.018} />
    <Box size={[0.067, 0.034, 0.003]} at={[0, 0.018, 0.024]} color={DARK} />
    {/* Screen segments are illustrative, not an invented temperature reading. */}
    {[-0.02, -0.006, 0.012].map((x) => (
      <Box key={x} size={[0.009, 0.002, 0.001]} at={[x, 0.018, 0.026]} color="#a8b5a6" />
    ))}
    <Disc radius={0.017} depth={0.008} at={[0, -0.022, 0.026]} color={WHITE} />
    <Ring radius={0.017} at={[0, -0.022, 0.03]} />
  </>
)

const Junction = ({ selected }: { selected: boolean }) => (
  <>
    <Plate selected={selected} width={0.075} height={0.075} depth={0.022} />
    <Screws width={0.053} height={0.053} z={0.027} />
    <Disc radius={0.009} depth={0.006} at={[0, -0.034, 0.023]} color={SEAM} />
    <Box size={[0.008, 0.035, 0.008]} at={[0, -0.052, 0.023]} color={WHITE} />
  </>
)

const EarthTerminal = ({ selected }: { selected: boolean }) => (
  <>
    <Box size={[0.022, 0.17, 0.005]} at={[0, 0, 0.004]} color={METAL} metal selected={selected} shadow />
    <mesh position={[0, 0, 0.015]} castShadow receiveShadow raycast={noRaycast}>
      <cylinderGeometry args={[0.005, 0.005, 0.22, 12]} />
      <Surface color={METAL} metal />
    </mesh>
    {[-0.027, 0.027].map((y) => (
      <group key={y} position={[0, y, 0.026]}>
        <Box size={[0.039, 0.014, 0.012]} color={METAL} metal />
        {[-0.012, 0.012].map((x) => (
          <Disc key={x} radius={0.004} depth={0.005} at={[x, 0, 0.009]} color={METAL} metal />
        ))}
      </group>
    ))}
  </>
)

const LightFixture = ({
  wall,
  linear,
  selected,
  glow,
  tint,
}: {
  wall: boolean
  linear: boolean
  selected: boolean
  glow: number
  tint: string
}) => (
  <>
    {linear ? (
      <>
        <Box size={[0.42, 0.032, 0.024]} at={[0, 0, 0.013]} selected={selected} shadow />
        <mesh position={[0, 0, 0.028]} castShadow raycast={noRaycast}>
          <boxGeometry args={[0.4, 0.021, 0.008]} />
          <meshStandardMaterial
            color={WHITE}
            emissive={tint}
            emissiveIntensity={glow * 4}
            roughness={0.55}
            shadowSide={FrontSide}
          />
        </mesh>
      </>
    ) : (
      <>
        <Disc radius={wall ? 0.075 : 0.11} depth={0.03} at={[0, 0, 0.016]} color={FACE} selected={selected} shadow />
        <mesh position={[0, 0, 0.036]} rotation-x={Math.PI / 2} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[wall ? 0.066 : 0.1, wall ? 0.066 : 0.1, 0.012, 32]} />
          <meshStandardMaterial
            color={WHITE}
            emissive={tint}
            emissiveIntensity={glow * 4}
            roughness={0.55}
            shadowSide={FrontSide}
          />
        </mesh>
        <Ring radius={wall ? 0.07 : 0.105} tube={0.0025} at={[0, 0, 0.034]} color={WHITE} />
      </>
    )}
  </>
)

/** Roof equipment is in world-up coordinates; other fittings use the mounting-face convention above. */
const RoofEquipment = ({ device, selected }: { device: Device; selected: boolean }) => {
  if (device.kind === 'connection') return <RoofDrain selected={selected} />
  const antenna = device.kind === 'tv'
  return (
    <>
      <mesh castShadow receiveShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.009, 0.014, antenna ? 1 : 2, 12]} />
        <Surface color={METAL} metal />
        {selected && <Edges color={SELECTED_OUTLINE} />}
      </mesh>
      {antenna && (
        <group position-y={0.25}>
          <Box size={[0.008, 0.008, 0.45]} color={METAL} metal />
          {[-0.15, -0.05, 0.05, 0.15].map((z, i) => (
            <Box key={z} size={[0.28 - i * 0.035, 0.007, 0.007]} at={[0, 0, z]} color={METAL} metal />
          ))}
        </group>
      )}
      <Box size={[0.08, 0.035, 0.08]} at={[0, antenna ? -0.48 : -0.98, 0]} color={DARK} />
    </>
  )
}

type DeviceModelProps = { device: Device; selected: boolean; glow: number; tint: string; wall: boolean }

/** Recognisable physical fittings. Electrical-category colours belong to plan markers, not these casings. */
export const DeviceModel = ({ device, selected, glow, tint, wall }: DeviceModelProps) => {
  const symbol = device.plan?.symbol ?? ''
  if (device.plan?.area === 'roof') return <RoofEquipment device={device} selected={selected} />
  if (device.kind === 'data' && symbol.startsWith('HDPE'))
    return (
      <group rotation-x={-Math.PI / 2}>
        <Disc radius={0.023} depth={0.11} at={[0, 0, -0.045]} color={DARK} selected={selected} shadow />
        <Disc radius={0.026} depth={0.009} at={[0, 0, 0.013]} color={SEAM} />
      </group>
    )
  switch (device.kind) {
    case 'light':
      return (
        <LightFixture
          wall={wall}
          linear={device.id === 'electrical-g-worktop-light' || device.id === 'electrical-u-bath-mirror'}
          selected={selected}
          glow={glow}
          tint={tint}
        />
      )
    case 'sensor':
      return symbol.startsWith('OK') || /smoke/i.test(device.name) ? (
        <SmokeAlarm selected={selected} />
      ) : symbol.includes('NTC') ? (
        <TemperatureSensor selected={selected} />
      ) : (
        <MotionSensor selected={selected} />
      )
    case 'fan':
      return <ExtractorFan selected={selected} />
    case 'socket':
      return (
        <Socket
          selected={selected}
          protectedSocket={symbol.includes('Protected')}
          threePhase={symbol.includes('400 V')}
        />
      )
    case 'switch':
      return <WallSwitch device={device} selected={selected} />
    case 'data':
      return <DataOutlet selected={selected} />
    case 'tv':
      return <TvOutlet selected={selected} />
    case 'panel':
      return <Cabinet device={device} selected={selected} />
    case 'bell':
      return <Doorbell button={symbol === 'Doorbell button'} selected={selected} />
    case 'thermostat':
      return <Thermostat selected={selected} />
    case 'blind':
      return (
        <Plate selected={selected}>
          <Box size={[0.06, 0.026, 0.005]} at={[0, 0.016, 0.02]} />
          <Box size={[0.06, 0.026, 0.005]} at={[0, -0.016, 0.02]} />
        </Plate>
      )
    case 'earth':
      return <EarthTerminal selected={selected} />
    case 'connection':
    case 'other':
      return <Junction selected={selected} />
  }
}
