import { useFrame } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import { Vector3 } from 'three'

// Text pinned to points in the scene: plain DOM over the canvas, moved every frame (like the room labels).

export type Annotation = {
  key: string
  at: [number, number, number]
  text: string
  kind: 'face' | 'opening' | 'gap'
  /** Which side of the point the label sits on; centred when absent. */
  anchor?: 'n' | 's' | 'e' | 'w'
}

const ANCHOR_SHIFT = {
  n: 'translate(-50%, -100%)',
  s: 'translate(-50%, 0)',
  e: 'translate(0, -50%)',
  w: 'translate(-100%, -50%)',
}

type AnnotationRefs = RefObject<Map<string, HTMLDivElement | null>>
type AnnotationsProps = { items: Annotation[]; refs: AnnotationRefs }

/** The DOM half: render next to the <Canvas>. */
export const AnnotationLabels = ({ items, refs }: AnnotationsProps) => (
  <div className="annotations" aria-hidden>
    {items.map((a) => (
      <div
        key={a.key}
        className={`annotation annotation-${a.kind}`}
        ref={(el) => {
          refs.current.set(a.key, el)
        }}
      >
        {a.text}
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
      el.style.transform = `translate(${x}px, ${y}px) ${a.anchor ? ANCHOR_SHIFT[a.anchor] : 'translate(-50%, -50%)'}`
      el.style.visibility = v.z < 1 ? 'visible' : 'hidden'
    }
  })
  return null
}
