import { useFrame } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import { X } from 'lucide-react'
import { Vector3 } from 'three'

// Lengths pinned to points in the scene: plain DOM over the canvas, moved every frame (like the room labels).

export type Annotation = {
  key: string
  at: [number, number, number]
  text: string
  kind: 'gap' | 'measure'
  /** Shows a remove button on the pill. */
  onRemove?: () => void
}

type AnnotationRefs = RefObject<Map<string, HTMLDivElement | null>>
type AnnotationsProps = { items: Annotation[]; refs: AnnotationRefs }

/** The DOM half: render next to the <Canvas>. */
export const AnnotationLabels = ({ items, refs }: AnnotationsProps) => (
  <div className="overlay">
    {items.map((a) => (
      <div
        key={a.key}
        className={`annotation annotation-${a.kind}`}
        ref={(el) => {
          refs.current.set(a.key, el)
        }}
      >
        {a.text}
        {a.onRemove && (
          <button className="annotation-remove" aria-label={`Remove ${a.text}`} onClick={a.onRemove}>
            <X size={12} />
          </button>
        )}
      </div>
    ))}
  </div>
)

/** The scene half: render inside the <Canvas>. */
export const AnnotationProjector = ({ items, refs }: AnnotationsProps) => {
  const v = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    for (const a of items) {
      const el = refs.current.get(a.key)
      if (!el) continue
      v.set(...a.at).project(camera)
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
      el.style.visibility = v.z < 1 ? 'visible' : 'hidden'
    }
  })
  return null
}
