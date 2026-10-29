import type { ThreeEvent } from '@react-three/fiber'
import { Ray, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { FurnitureBox } from './FurnitureBox'

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useRef: () => ({ current: undefined }),
  useMemo: (create: () => unknown) => create(),
}))
vi.mock('@react-three/fiber', () => ({
  useThree: () => () => ({ controls: { enabled: true } }),
}))
vi.mock('@react-three/drei', () => ({ Html: 'html', Line: 'line' }))
vi.mock('./FurnitureModel', () => ({ FurnitureModel: 'model' }))
vi.mock('./ItemCut', () => ({ useItemCut: () => {} }))
vi.mock('../debug', () => ({ useDebug: () => false }))

const setup = (selected: boolean, pointerType = 'mouse', add = false) => {
  const onSelect = vi.fn()
  const onMove = vi.fn()
  const onMoveEnd = vi.fn()
  const onTap = vi.fn()
  const box = FurnitureBox({
    item: {
      id: 'chair',
      floor: 'ground',
      name: 'Chair',
      x: 2,
      y: 3,
      width: 1,
      depth: 1,
      height: 1,
      rotation: 0,
      color: '#fff',
    },
    elevation: 0,
    selected,
    showActions: false,
    interactive: true,
    wallSnap: false,
    furnitureSnap: false,
    snapWalls: undefined,
    snapItems: [],
    onSelect,
    onMove,
    onMoveEnd,
    onTap,
    actions: { onRotate: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() },
  })
  const handlers = box.props.children[0][0].props
  const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() }
  const event = (type: string, x = 2.25, pointerId = 1) =>
    ({
      type,
      pointerId,
      pointerType,
      shiftKey: add,
      metaKey: false,
      ctrlKey: false,
      ray: new Ray(new Vector3(x, 5, 3.25), new Vector3(0, -1, 0)),
      target,
      stopPropagation: vi.fn(),
    }) as unknown as ThreeEvent<PointerEvent>
  return { handlers, event, onSelect, onMove, onMoveEnd, onTap }
}

describe.each(['mouse', 'touch'])('furniture gestures (%s)', (pointerType) => {
  it('selects on release and never moves an initially unselected item', () => {
    const { handlers, event, onSelect, onMove, onMoveEnd } = setup(false, pointerType)
    handlers.onPointerDown(event('pointerdown'))
    expect(onSelect).not.toHaveBeenCalled()
    handlers.onPointerMove(event('pointermove', 5))
    handlers.onPointerUp(event('pointerup', 5))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('chair', false)
    expect(onMove).not.toHaveBeenCalled()
    expect(onMoveEnd).not.toHaveBeenCalled()
  })

  it('moves a selected piece from the original grab offset on the first move', () => {
    const { handlers, event, onSelect, onMove, onMoveEnd, onTap } = setup(true, pointerType)
    handlers.onPointerDown(event('pointerdown'))
    handlers.onPointerMove(event('pointermove', 3.25))
    handlers.onPointerUp(event('pointerup', 3.25))
    expect(onMove).toHaveBeenCalledExactlyOnceWith('chair', { x: 3, y: 3, rotation: 0 })
    expect(onMoveEnd).toHaveBeenCalledExactlyOnceWith('chair')
    // Dragging a member must preserve the group selection.
    expect(onSelect).not.toHaveBeenCalled()
    expect(onTap).not.toHaveBeenCalled()
  })

  it('does not record no-op moves, and keeps plain taps available', () => {
    const { handlers, event, onMove, onMoveEnd, onTap } = setup(true, pointerType)
    handlers.onPointerDown(event('pointerdown'))
    handlers.onPointerMove(event('pointermove'))
    handlers.onPointerUp(event('pointerup'))
    expect(onMove).not.toHaveBeenCalled()
    expect(onMoveEnd).not.toHaveBeenCalled()
    expect(onTap).toHaveBeenCalledExactlyOnceWith('chair')
  })
})

it('only changes modifier selection on release, without moving a selected piece', () => {
  const { handlers, event, onSelect, onMove, onTap } = setup(true, 'mouse', true)
  handlers.onPointerDown(event('pointerdown'))
  handlers.onPointerMove(event('pointermove', 5))
  expect(onSelect).not.toHaveBeenCalled()
  handlers.onPointerUp(event('pointerup', 5))
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('chair', true)
  expect(onMove).not.toHaveBeenCalled()
  expect(onTap).not.toHaveBeenCalled()
})

it('ignores other pointers and does not select a cancelled press', () => {
  const { handlers, event, onSelect, onMove, onMoveEnd, onTap } = setup(false, 'touch')
  handlers.onPointerDown(event('pointerdown'))
  handlers.onPointerUp(event('pointerup', 5, 2))
  expect(onSelect).not.toHaveBeenCalled()
  handlers.onPointerCancel(event('pointercancel'))
  handlers.onPointerUp(event('pointerup'))
  expect(onSelect).not.toHaveBeenCalled()
  expect(onMove).not.toHaveBeenCalled()
  expect(onMoveEnd).not.toHaveBeenCalled()
  expect(onTap).not.toHaveBeenCalled()
})
