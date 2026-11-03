import { describe, expect, it } from 'vitest'
import { Group, PerspectiveCamera, PointLight, Scene } from 'three'
import { ceilingLightMask } from './lightEmission'

describe('ceiling emitter assignment', () => {
  it('keeps the emission mask aligned with the renderer when shadowed lights come first', () => {
    const scene = new Scene()
    const camera = new PerspectiveCamera()
    const lamp = new PointLight()
    const ceiling = new PointLight()
    ceiling.userData.downlight = true
    ceiling.castShadow = true
    scene.add(lamp, ceiling)
    expect(ceilingLightMask(scene, camera)).toEqual([1, 0])
    // Adding a shadowed lamp must not give it a ceiling fixture's downward-only emission.
    lamp.castShadow = true
    expect(ceilingLightMask(scene, camera)).toEqual([0, 1])
  })

  it('does not include emitters hidden by a parent, visibility, or camera layer', () => {
    const scene = new Scene()
    const camera = new PerspectiveCamera()
    const visible = new PointLight()
    visible.userData.downlight = true
    const hidden = new PointLight()
    hidden.visible = false
    const otherLayer = new PointLight()
    otherLayer.layers.set(1)
    const group = new Group()
    group.visible = false
    group.add(new PointLight())
    scene.add(visible, hidden, otherLayer, group)
    expect(ceilingLightMask(scene, camera)).toEqual([1])
  })
})
