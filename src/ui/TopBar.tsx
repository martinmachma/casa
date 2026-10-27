import { House } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Floor } from '../layout/types'
import { Segmented } from './kit'

type TopBarProps = {
  floors: Floor[]
  floorIndex: number
  onFloor: (index: number) => void
  /** Looking at the whole house from outside instead of one floor. */
  outside: boolean
  onOutside: () => void
  /** The version picker, while planning. */
  versions?: ReactNode
}

const OUTSIDE = 'outside'

const ordinal = (n: number) => `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`

export const TopBar = ({ floors, floorIndex, onFloor, outside, onOutside, versions }: TopBarProps) => (
  <header className="topbar">
    <Segmented
      label="Floor"
      value={outside ? OUTSIDE : floors[floorIndex].id}
      onChange={(id) => (id === OUTSIDE ? onOutside() : onFloor(floors.findIndex((f) => f.id === id)))}
      options={[
        { value: OUTSIDE, label: 'Outside', icon: <House size={15} />, iconOnly: true },
        ...floors.map((f, i) => ({ value: f.id, label: ordinal(i + 1) })),
      ]}
      className="floors"
    />
    {versions}
  </header>
)
