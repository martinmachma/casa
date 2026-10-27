import type { Vector3 } from 'three'

/**
 * The fly-in plays once per app load, onto the whole house, which then gives way to the 1st floor.
 * `handoff` carries where the camera landed over to the 1st floor's camera.
 */
export const intro: { pending: boolean; handoff?: { position: Vector3; target: Vector3 } } = {
  pending: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
}
