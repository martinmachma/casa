import { Info } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { IconButton } from './kit'

/** Optional specifications stay at the foot of the inspector, behind a quiet info button. */
export const ItemInfo = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <footer className="item-info">
      <div id={id} className="item-info-content" hidden={!open}>
        <h3>Technical information</h3>
        {children}
      </div>
      <IconButton
        label="Technical information"
        small
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Info size={18} />
      </IconButton>
    </footer>
  )
}
