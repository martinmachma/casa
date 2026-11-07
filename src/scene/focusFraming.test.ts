import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { focusFraming } from './focusFraming'

describe('focusFraming', () => {
  it('keeps close-ups above the card on tall and short phones, restoring the full view when it closes', () => {
    const target = new Vector3(1, 2.4, 3)
    for (const size of [
      { width: 393, height: 796 },
      { width: 375, height: 540 },
    ]) {
      const bottomInset = 400
      const camera = new PerspectiveCamera(45, size.width / size.height)
      camera.position.copy(target).add(new Vector3(0, 0, 2.2))
      camera.lookAt(target)
      camera.updateMatrixWorld()
      camera.updateProjectionMatrix()
      const screen = (point: Vector3) => {
        const p = point.clone().project(camera)
        return { x: ((p.x + 1) * size.width) / 2, y: ((1 - p.y) * size.height) / 2 }
      }
      const above = target.clone().add(new Vector3(0, 0.3, 0))
      const fullView = screen(above)
      Object.assign(camera, focusFraming(size, bottomInset))
      camera.updateProjectionMatrix()
      expect(screen(target).x).toBeCloseTo(size.width / 2)
      expect(screen(target).y).toBeCloseTo((size.height - bottomInset) / 2)
      // A 60 cm item at the close-up distance fits above the card, even on a short phone.
      expect(screen(above).y).toBeGreaterThan(0)
      expect(screen(target.clone().add(new Vector3(0, -0.3, 0))).y).toBeLessThan(size.height - bottomInset)

      Object.assign(camera, focusFraming(size, 0))
      camera.updateProjectionMatrix()
      expect(screen(target).y).toBeCloseTo(size.height / 2)
      expect(screen(above)).toEqual(fullView)
    }
  })
})
