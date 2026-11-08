import { events, type RootStore } from '@react-three/fiber'

/** Captured mouse input can arrive much faster than the display. Look handles every delta; picking runs once a frame. */
export const pointerEvents = (store: RootStore) => {
  const manager = events(store)
  const handlers = manager.handlers!
  const move = handlers.onPointerMove
  const disconnect = manager.disconnect
  let pending: Event | undefined
  let frame: number | undefined
  const cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    pending = undefined
  }
  handlers.onPointerMove = (event) => {
    if (document.pointerLockElement !== store.getState().gl.domElement) {
      cancel()
      move(event)
      return
    }
    pending = event
    if (frame !== undefined) return
    frame = requestAnimationFrame(() => {
      const latest = pending
      cancel()
      if (latest && document.pointerLockElement === store.getState().gl.domElement) move(latest)
    })
  }
  manager.disconnect = () => {
    cancel()
    disconnect?.()
  }
  return manager
}
