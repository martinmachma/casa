import { X } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

// The small building blocks every panel is made of.

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; small?: boolean }

export const IconButton = ({ label, small, className = '', children, ...rest }: IconButtonProps) => (
  <button className={`icon-btn ${small ? 'icon-btn-sm' : ''} ${className}`} aria-label={label} title={label} {...rest}>
    {children}
  </button>
)

const SLIDE_MS = 220

/**
 * Slides its contents in and out sideways as `show` changes, the neighbours making room as it goes.
 * The contents only exist while shown or sliding out.
 */
export const Slide = ({ show, children }: { show: boolean; children: ReactNode }) => {
  const [present, setPresent] = useState(show)
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (present !== show && (show || still)) setPresent(show)
  // Sliding out, it shows what it last showed, not what the change it's leaving for would make of it.
  const [last, setLast] = useState(children)
  if (show && last !== children) setLast(children)
  const ref = useRef<HTMLDivElement>(null)
  // Things already there when the page loads don't slide.
  const mounted = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (!el || still) return
    // Collapsed, it also gives back the gap it takes in its row.
    const gap = parseFloat(getComputedStyle(el.parentElement!).columnGap) || 0
    const open = { width: `${el.scrollWidth}px`, marginInlineEnd: '0px', opacity: 1, transform: 'none' }
    const closed = { width: '0px', marginInlineEnd: `${-gap}px`, opacity: 0, transform: 'translateX(12px)' }
    el.style.overflow = 'hidden'
    const anim = el.animate(show ? [closed, open] : [open, closed], {
      duration: SLIDE_MS,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: show ? 'none' : 'forwards',
    })
    anim.onfinish = () => {
      el.style.overflow = ''
      if (!show) setPresent(false)
    }
    return () => anim.cancel()
  }, [show, still])

  return present ? (
    <div ref={ref} className="slide">
      {show ? children : last}
    </div>
  ) : null
}

/** `iconOnly` keeps the label for the tooltip and screen readers; with `show`, it slides in and out. */
type Option<T> = { value: T; label: string; icon?: ReactNode; iconOnly?: boolean; show?: boolean }

type SegmentedProps<T> = {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  block?: boolean
  className?: string
  disabled?: boolean
}

export const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
  block,
  className = '',
  disabled,
}: SegmentedProps<T>) => (
  <div className={`segmented ${block ? 'segmented-block' : ''} ${className}`} role="group" aria-label={label}>
    {options.map((o) => {
      const button = (
        <button
          key={o.value}
          aria-pressed={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          title={o.label}
          aria-label={o.iconOnly ? o.label : undefined}
        >
          {o.icon}
          {!o.iconOnly && <span>{o.label}</span>}
        </button>
      )
      return o.show === undefined ? (
        button
      ) : (
        <Slide key={o.value} show={o.show}>
          {button}
        </Slide>
      )
    })}
  </div>
)

type SwitchProps = { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void }

export const Switch = ({ label, checked, onChange }: SwitchProps) => (
  <label className="switch">
    <span>{label}</span>
    <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="switch-track" aria-hidden />
  </label>
)

type SectionProps = { title?: string; aside?: ReactNode; className?: string; children: ReactNode }

export const Section = ({ title, aside, className, children }: SectionProps) => (
  <section className={className ? `section ${className}` : 'section'}>
    {(title || aside) && (
      <header className="section-head">
        {title && <h3>{title}</h3>}
        {aside}
      </header>
    )}
    {children}
  </section>
)

type PanelHeadProps = {
  eyebrow?: string
  title: ReactNode
  sub?: ReactNode
  onClose?: () => void
  closeLabel?: string
  /** Replaces the close cross, e.g. a plus/minus for a panel that folds to its header. */
  closeIcon?: ReactNode
}

export const PanelHead = ({ eyebrow, title, sub, onClose, closeLabel = 'Close', closeIcon }: PanelHeadProps) => (
  <header className="panel-head">
    <div className="panel-head-text">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2 className="panel-title">{title}</h2>
      {sub && <div className="panel-sub">{sub}</div>}
    </div>
    {onClose && (
      <IconButton label={closeLabel} small onClick={onClose}>
        {closeIcon ?? <X size={18} />}
      </IconButton>
    )}
  </header>
)
