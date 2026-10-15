import { X } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

// The small building blocks every panel is made of.

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; small?: boolean }

export const IconButton = ({ label, small, className = '', children, ...rest }: IconButtonProps) => (
  <button className={`icon-btn ${small ? 'icon-btn-sm' : ''} ${className}`} aria-label={label} title={label} {...rest}>
    {children}
  </button>
)

/** `iconOnly` keeps the label for the tooltip and screen readers. */
type Option<T> = { value: T; label: string; icon?: ReactNode; iconOnly?: boolean }

type SegmentedProps<T> = {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  block?: boolean
  className?: string
}

export const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
  block,
  className = '',
}: SegmentedProps<T>) => (
  <div className={`segmented ${block ? 'segmented-block' : ''} ${className}`} role="group" aria-label={label}>
    {options.map((o) => (
      <button
        key={o.value}
        aria-pressed={o.value === value}
        onClick={() => onChange(o.value)}
        title={o.label}
        aria-label={o.iconOnly ? o.label : undefined}
      >
        {o.icon}
        {!o.iconOnly && <span>{o.label}</span>}
      </button>
    ))}
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

type SectionProps = { title?: string; aside?: ReactNode; children: ReactNode }

export const Section = ({ title, aside, children }: SectionProps) => (
  <section className="section">
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
