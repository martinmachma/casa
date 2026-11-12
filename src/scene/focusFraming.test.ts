import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { blendFocusFraming, focusFraming } from './focusFraming'

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
      const full = focusFraming(size, 0)
      const focused = focusFraming(size, bottomInset)
      blendFocusFraming(camera, size, full, focused, 1)
      expect(screen(target).x).toBeCloseTo(size.width / 2)
      expect(screen(target).y).toBeCloseTo((size.height - bottomInset) / 2)
      // A 60 cm item at the close-up distance fits above the card, even on a short phone.
      expect(screen(above).y).toBeGreaterThan(0)
      expect(screen(target.clone().add(new Vector3(0, -0.3, 0))).y).toBeLessThan(size.height - bottomInset)

      blendFocusFraming(camera, size, focused, full, 1)
      expect(screen(target).y).toBeCloseTo(size.height / 2)
      expect(screen(above)).toEqual(fullView)
    }
  })

  it('preserves the previous projection on the first frame, then glides into and out of the card framing', () => {
    const size = { width: 375, height: 540 }
    const camera = new PerspectiveCamera(45, size.width / size.height)
    const target = new Vector3(0, 0, -2.2)
    const full = focusFraming(size, 0)
    const focused = focusFraming(size, 400)
    const original = camera.projectionMatrix.clone()
    for (const [from, to] of [
      [full, focused],
      [focused, full],
    ]) {
      const previous = camera.projectionMatrix.clone()
      blendFocusFraming(camera, size, from, to, 0)
      camera.projectionMatrix.elements.forEach((value, i) => expect(value).toBeCloseTo(previous.elements[i], 12))
      blendFocusFraming(camera, size, from, to, 0.5)
      expect(camera.zoom).toBeCloseTo((from.zoom + to.zoom) / 2)
      const projected = target.clone().project(camera)
      expect(((1 - projected.y) * size.height) / 2).toBeCloseTo(size.height / 2 - (from.offsetY + to.offsetY) / 2)
      blendFocusFraming(camera, size, from, to, 1)
    }
    camera.projectionMatrix.elements.forEach((value, i) => expect(value).toBeCloseTo(original.elements[i], 12))
  })

  it('centres a manually chosen orbit at every sheet height, including when the drag reverses', () => {
    const size = { width: 393, height: 540 }
    const target = new Vector3(1, 2, 3)
    const camera = new PerspectiveCamera(45, size.width / size.height)
    camera.position.set(4, 5, 7)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    const position = camera.position.clone()
    const rotation = camera.quaternion.clone()
    const framing = focusFraming(size, 0)
    for (const height of [170, 220, 300, 340, 260, 190, 170]) {
      focusFraming(size, height, framing)
      blendFocusFraming(camera, size, framing, framing, 1)
      const projected = target.clone().project(camera)
      expect(((projected.x + 1) * size.width) / 2).toBeCloseTo(size.width / 2)
      expect(((1 - projected.y) * size.height) / 2).toBeCloseTo((size.height - height) / 2)
      expect(camera.position).toEqual(position)
      expect(camera.quaternion.toArray()).toEqual(rotation.toArray())
    }
  })
})
