import { useMemo } from 'react'
import { Color, MathUtils, Object3D } from 'three'
import { sunDirection, type SunPosition } from '../sun/sun'

type LightsProps = {
  /** Sunlight at a real date and time, or undefined for the even studio light. */
  sun: SunPosition | undefined
  north: number
  /** What the light aims at and its shadows are centred on (the house). */
  center: [number, number, number]
}

const BACKGROUND = '#f4efe8'
const NIGHT_SKY = '#283040'
const SUN_DISTANCE = 35
// After dark: a cool moonlit fill so the house still reads instead of going pitch black.
const MOON = '#9fb0d8'
const MOON_INTENSITY = 0.8

const mix = (a: string, b: string, t: number) => `#${new Color(a).lerp(new Color(b), t).getHexString()}`

export const Lights = ({ sun, north, center }: LightsProps) => {
  const target = useMemo(() => new Object3D(), [])

  let position: [number, number, number] = [center[0] + 9, center[1] + 24, center[2] + 6]
  let sunColor = '#ffffff'
  let sunIntensity = 1.5
  let shadow = 0.45
  let sky = '#fff8ee'
  let ground = '#b8a990'
  let ambient = 1.5
  let background = BACKGROUND
  let moon = 0

  if (sun) {
    const [dx, dy, dz] = sunDirection(sun, north)
    const height = Math.sin(sun.altitude)
    const day = MathUtils.smoothstep(height, -0.1, 0.2)
    const low = 1 - MathUtils.smoothstep(height, 0.05, 0.45)
    position = [center[0] + dx * SUN_DISTANCE, center[1] + dy * SUN_DISTANCE, center[2] + dz * SUN_DISTANCE]
    sunColor = mix('#fff3df', '#ff9d52', low)
    sunIntensity = 3.2 * MathUtils.smoothstep(height, -0.02, 0.1)
    shadow = 0.85
    sky = mix('#8592b8', '#eef3fb', day)
    ground = mix('#4a4640', '#b8a990', day)
    ambient = 0.8 + 0.3 * day
    moon = MOON_INTENSITY * (1 - day)
    background = mix(NIGHT_SKY, BACKGROUND, day)
  }

  return (
    <>
      <color attach="background" args={[background]} />
      <hemisphereLight args={[sky, ground, ambient]} />
      <primitive object={target} position={center} />
      {moon > 0 && (
        <directionalLight
          position={[center[0] - 10, center[1] + 25, center[2] - 8]}
          target={target}
          color={MOON}
          intensity={moon}
        />
      )}
      <directionalLight
        position={position}
        target={target}
        color={sunColor}
        intensity={sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
        shadow-intensity={shadow}
      />
    </>
  )
}
