import { Html } from '@react-three/drei'

/** A small tag over an item in debug mode: its name and the start of its id, enough to find it by. */
export const DebugLabel = ({ y, text }: { y: number; text: string }) => (
  <Html position={[0, y, 0]} center zIndexRange={[10, 0]}>
    <div className="debug-label">{text}</div>
  </Html>
)
