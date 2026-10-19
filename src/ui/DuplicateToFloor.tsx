import { Copy } from 'lucide-react'
import type { Floor } from '../layout/types'

type DuplicateToFloorProps = {
  floors: Floor[]
  currentFloor: string
  onDuplicate: (floorId: string) => void
}

export const DuplicateToFloor = ({ floors, currentFloor, onDuplicate }: DuplicateToFloorProps) => (
  <>
    {floors
      .filter((floor) => floor.id !== currentFloor)
      .map((floor) => (
        <button key={floor.id} className="btn btn-block" onClick={() => onDuplicate(floor.id)}>
          <Copy size={16} />
          Duplicate to {floor.name}
        </button>
      ))}
  </>
)
