import { Footprints } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  disabled: boolean
  onStart: () => void
  onDrag: (x: number, y: number) => boolean
  onDrop: (x: number, y: number) => void
  onCancel: () => void
}

/** A click enters at the viewed position; dragging places the walker on a floor. */
export const WalkButton = ({ disabled, onStart, onDrag, onDrop, onCancel }: Props) => {
  const gesture = useRef<{ x: number; y: number; id: number; dragged: boolean } | undefined>(undefined)
  const suppressClick = useRef(false)
  const [preview, setPreview] = useState<{ x: number; y: number; valid: boolean }>()
  useEffect(() => {
    const cancel = () => {
      if (!gesture.current) return
      suppressClick.current = gesture.current.dragged
      gesture.current = undefined
      setPreview(undefined)
      onCancel()
    }
    const move = (e: PointerEvent) => {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      if (!g.dragged && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 6) return
      g.dragged = true
      setPreview({ x: e.clientX, y: e.clientY, valid: onDrag(e.clientX, e.clientY) })
    }
    const up = (e: PointerEvent) => {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      gesture.current = undefined
      suppressClick.current = g.dragged
      setPreview(undefined)
      if (g.dragged) onDrop(e.clientX, e.clientY)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    // Capture releases before the canvas handles them, including a release outside the button.
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('lostpointercapture', cancel, true)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('lostpointercapture', cancel, true)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', key)
    }
  }, [onDrag, onDrop, onCancel])
  return (
    <>
      <button
        className="walk-button"
        disabled={disabled}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        title="Walk · click to start here, or drag onto a floor or the garden"
        onClick={() => {
          if (!suppressClick.current) onStart()
        }}
        onPointerDown={(e) => {
          if (!e.isPrimary || e.button !== 0) return
          suppressClick.current = false
          gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, dragged: false }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Footprints size={15} />
        <span>Walk</span>
      </button>
      {preview &&
        createPortal(
          <div
            className="walk-drag-preview float"
            data-valid={preview.valid}
            style={{ left: preview.x, top: preview.y }}
          >
            <Footprints size={21} />
            <span>{preview.valid ? 'Release to start walking' : 'Drop onto a floor or the garden'}</span>
          </div>,
          document.body,
        )}
    </>
  )
}
