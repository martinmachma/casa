import { useThree, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Plane, Raycaster, Vector2, Vector3, type Object3D, type Ray } from 'three'
import {
  cornerCuts,
  endPart,
  isExteriorWall,
  openingAt,
  openingSill,
  outsideFace,
  paintCells,
  paintStretch,
  shaftSpans,
  sidePart,
  splitPieces,
  stubPieces,
  wallEndExtensions,
  wallHeight,
  wallJoints,
  wallLength,
  wallOwner,
  wallOwnerOffset,
  wallPaintParts,
  wallPieces,
  wallThickness,
  type WallPiece,
} from '../layout/geometry'
import type { Floor, Wall, WallFace, WallSide } from '../layout/types'
import { wallPartColor, type NewWallArea, type WallArea } from '../data/types'
import type { ShadeState } from '../devices/shades'
import { DEFAULT_WALL, SELECTED_OUTLINE, WALL_CAP } from './palette'
import { OpeningFills } from './OpeningFills'
import { raycastIfShown } from './raycast'
import type { Selection } from './selection'
import { CutawayWall, STUB_HEIGHT, type Focus } from './CutawayWall'

// Keep overlapping end caps just inside the neighbouring wall's face to avoid z-fighting.
const CORNER_INSET = 0.002
// A pointer that moved further than this between down and up was an orbit/pan, not a click.
const CLICK_SLOP_PX = 5
// The selection wash sits this far off the wall face, so it doesn't flicker against it.
const PROUD = 0.006
// Painted areas sit just off the face (they never overlap), where painting would go a step further out, both
// under the selection wash.
const AREA_PROUD = 0.0008
// How long the paint square stays after the pointer leaves the wall.
const PREVIEW_LINGER_MS = 80

/** What a stroke on a wall does while painting: brush on a colour in squares `size` across, or take it off. */
export type Brush = { color: string; erase: boolean; size: number }

/** A block of paint squares on a part of a wall side, before it has a colour. */
export type PaintStroke = Omit<NewWallArea, 'color'>

/** A part of a wall side, or a wall end, painted in squares, or whole with Shift. */
export type PaintFace = { wallId: string; side: WallFace; part: number }

/** Where a stroke goes on, and for an end whether it's the far one, facing the way the wall runs. */
type PaintTarget = PaintFace & { far?: boolean }

/** The faces of an opening's reveal at its bottom and top. */
type RevealFace = 'sill' | 'head'
const isReveal = (side: WallFace): side is RevealFace => side === 'sill' || side === 'head'

/** Where painting would go: the square under the pointer, or the block from where it was started. */
type PaintPreview = PaintStroke & { started: boolean }

/** A block of paint started with a click and finished with the next, the camera free to turn in between. */
type PaintStart = {
  /** The block from where it was started to where the ray meets that face. */
  to: (ray: Ray) => PaintStroke
  /** The click that started it, which doesn't also finish it. */
  click: Event
}

const samePreview = (a: PaintPreview | undefined, b: PaintPreview | undefined) =>
  a === b || (!!a && !!b && (Object.keys(a) as (keyof PaintPreview)[]).every((k) => a[k] === b[k]))

type MeshHandlers = Pick<
  ThreeElements['mesh'],
  'onClick' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onPointerOver' | 'onPointerOut'
>

const hover = (cursor: string): MeshHandlers => ({
  onPointerOver: (e) => (e.stopPropagation(), (document.body.style.cursor = cursor)),
  onPointerOut: () => (document.body.style.cursor = ''),
})

/** The group a wall's meshes are placed in: wall-local space, x along the wall from its `from` point. */
const wallGroup = (o: Object3D) => {
  let g: Object3D | null = o
  while (g && !g.userData.wallId) g = g.parent
  return g
}

type FloorWallsProps = {
  floor: Floor
  colors: Map<string, string>
  areas: WallArea[]
  selection: Selection | undefined
  interactive: boolean
  /** Whether taps open and close doors. */
  doors: boolean
  openDoors: ReadonlySet<string>
  onToggleDoor: (id: string) => void
  shades: Readonly<Record<string, ShadeState>>
  /** Opens a shade's controls when it's tapped. */
  onPickShade?: (id: string) => void
  /** The shade pointed at, while shades can be picked. */
  onHoverShade?: (id: string | undefined) => void
  /** The shade pointed at in the scene or its controls, drawn solid. */
  hoveredShade?: string
  /** Hide the walls between the camera and the middle of the floor, so you can see in. */
  cutaway: boolean
  /** The middle of the room being looked at: only walls between it and the camera are cut. */
  focus?: Focus
  onPick: (wallId: string, side: WallFace, part: number, area?: string) => void
  /** While painting: a click starts a block of squares and the next finishes it; a Shift-click paints the whole wall. */
  brush?: Brush
  onPaint?: (stroke: PaintStroke) => void
  onPaintWall?: (face: PaintFace) => void
}

export const FloorWalls = ({
  floor,
  colors,
  areas,
  selection,
  interactive,
  doors,
  openDoors,
  onToggleDoor,
  shades,
  onPickShade,
  onHoverShade,
  hoveredShade,
  cutaway,
  focus,
  onPick,
  brush,
  onPaint,
  onPaintWall,
}: FloorWallsProps) => {
  const [preview, setPreview] = useState<PaintPreview>()
  // The pointer slips off the wall for a moment between its pieces and painted areas: only take the square
  // away once it has stayed off, so it doesn't blink.
  const clearing = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(clearing.current), [])
  const showPreview = useCallback((next: PaintPreview | undefined) => {
    window.clearTimeout(clearing.current)
    if (next) {
      document.body.style.cursor = 'crosshair'
      return setPreview((now) => (samePreview(now, next) ? now : next))
    }
    clearing.current = window.setTimeout(() => {
      setPreview(undefined)
      if (document.body.style.cursor === 'crosshair') document.body.style.cursor = ''
    }, PREVIEW_LINGER_MS)
  }, [])

  // A started block follows the pointer anywhere over the scene, even off the wall or while the camera turns, and
  // the next click (not a turn of the camera) finishes it. Esc lets it go.
  const getState = useThree((s) => s.get)
  const start = useRef<PaintStart>(undefined)
  const pressed = useRef<[number, number]>(undefined)
  const painting = !!brush
  useEffect(() => {
    if (!painting) start.current = undefined
  }, [painting])
  useEffect(() => {
    const el = getState().events.connected as HTMLElement | undefined
    if (!painting || !el) return
    const raycaster = new Raycaster()
    const ray = (e: MouseEvent) => {
      const { camera, gl } = getState()
      const r = gl.domElement.getBoundingClientRect()
      const at = new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(at, camera)
      return raycaster.ray
    }
    const move = (e: PointerEvent) => {
      if (start.current) showPreview({ ...start.current.to(ray(e)), started: true })
    }
    const press = (e: PointerEvent) => (pressed.current = [e.clientX, e.clientY])
    const click = (e: MouseEvent) => {
      const s = start.current
      const p = pressed.current
      if (!s || e === s.click || !p || Math.hypot(e.clientX - p[0], e.clientY - p[1]) > CLICK_SLOP_PX) return
      start.current = undefined
      showPreview(undefined)
      onPaint?.(s.to(ray(e)))
    }
    // Ahead of the app's own Esc, which would put the paint tool away.
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !start.current) return
      e.stopImmediatePropagation()
      start.current = undefined
      showPreview(undefined)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerdown', press)
    el.addEventListener('click', click)
    window.addEventListener('keydown', key, { capture: true })
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerdown', press)
      el.removeEventListener('click', click)
      window.removeEventListener('keydown', key, { capture: true })
    }
  }, [painting, getState, showPreview, onPaint])
  return (
    <group>
      {floor.walls.map((wall) => (
        <WallMesh
          key={wall.id}
          cutaway={cutaway}
          focus={focus}
          wall={wall}
          floor={floor}
          colors={colors}
          areas={areas}
          selected={
            selection?.kind === 'wall' && selection.wallId === wallOwner(wall, floor).id ? selection : undefined
          }
          interactive={interactive}
          doors={doors}
          openDoors={openDoors}
          onToggleDoor={onToggleDoor}
          shades={shades}
          onPickShade={onPickShade}
          onHoverShade={onHoverShade}
          hoveredShade={hoveredShade}
          onPick={onPick}
          brush={brush}
          preview={brush && preview?.wallId === wallOwner(wall, floor).id ? preview : undefined}
          onPreview={showPreview}
          startRef={start}
          onPaintWall={onPaintWall}
        />
      ))}
    </group>
  )
}

type WallMeshProps = {
  cutaway: boolean
  focus?: Focus
  wall: Wall
  floor: Floor
  colors: Map<string, string>
  areas: WallArea[]
  selected: { side: WallFace; part: number; area?: string } | undefined
  interactive: boolean
  doors: boolean
  openDoors: ReadonlySet<string>
  onToggleDoor: (id: string) => void
  shades: Readonly<Record<string, ShadeState>>
  /** Opens a shade's controls when it's tapped. */
  onPickShade?: (id: string) => void
  /** The shade pointed at, while shades can be picked. */
  onHoverShade?: (id: string | undefined) => void
  hoveredShade?: string
  onPick: (wallId: string, side: WallFace, part: number, area?: string) => void
  brush?: Brush
  /** Where painting would go on this wall. */
  preview?: PaintPreview
  onPreview: (preview: PaintPreview | undefined) => void
  /** The block being painted, on any wall. */
  startRef: RefObject<PaintStart | undefined>
  onPaintWall?: (face: PaintFace) => void
}

// Switching back must name the default: R3F leaves a raycast set to undefined unset, and nothing gets hit.
const noRaycast = () => null

const WallMesh = ({
  cutaway,
  focus,
  wall,
  floor,
  colors,
  areas: allAreas,
  selected,
  interactive,
  doors,
  openDoors,
  onToggleDoor,
  shades,
  onPickShade,
  onHoverShade,
  hoveredShade,
  onPick,
  brush,
  preview,
  onPreview,
  startRef,
  onPaintWall,
}: WallMeshProps) => {
  const owner = wallOwner(wall, floor)
  const offset = wallOwnerOffset(wall, owner)
  const thickness = wallThickness(wall, floor)
  const ownJoints = useMemo(() => wallJoints(wall, floor), [wall, floor])
  const paintParts = useMemo(() => wallPaintParts(owner, floor), [owner, floor])
  const joints = useMemo(() => {
    const joints = wallJoints(owner, floor)
    return { a: joints.a.map((u) => u - offset), b: joints.b.map((u) => u - offset) }
  }, [owner, floor, offset])
  // Cut where other walls meet either side, so each box lies in one part of each side, and at corners, so the
  // corner block is a piece of its own.
  const corners = useMemo(() => cornerCuts(wall, floor), [wall, floor])
  const pieces = useMemo(
    () =>
      splitPieces(wallPieces(wall, wallHeight(wall, floor), wallEndExtensions(wall, floor, CORNER_INSET)), [
        ...new Set([...joints.a, ...joints.b, ...ownJoints.a, ...ownJoints.b, ...corners.map((c) => c.at)]),
      ]),
    [wall, floor, joints, ownJoints, corners],
  )
  const partOf = (p: WallPiece, side: WallSide) => paintParts[side][sidePart(joints[side], (p.u0 + p.u1) / 2)]
  const colorOf = (p: WallPiece, side: WallSide) =>
    wallPartColor(colors, owner.id, side, partOf(p, side)) ?? DEFAULT_WALL
  const endColor = (u: number) =>
    wallPartColor(colors, owner.id, 'end', endPart(u + offset)) ??
    wallPartColor(colors, wall.id, 'end', endPart(u)) ??
    WALL_CAP
  const outside = useMemo(() => (isExteriorWall(wall, floor) ? outsideFace(wall, floor) : undefined), [wall, floor])
  const areas = useMemo(() => allAreas.filter((a) => a.wallId === owner.id), [allAreas, owner.id])
  // Paint sits `grow` off the face, so where it reaches the wall's edge it goes on that far round the corner, to
  // meet the paint on the other face there instead of leaving the bare edge showing between them.
  // Where an area lies on the end faces of the given pieces at its part.
  // Only the bands of it that show: beside an opening, the pieces under and over it cover the rest.
  const endPieces = (area: WallArea, list: WallPiece[], grow = AREA_PROUD): EndRect[] =>
    area.side !== 'end'
      ? []
      : list.flatMap((p) =>
          ([p.u0, p.u1] as const).flatMap((u) => {
            if (endPart(u + offset) !== area.part) return []
            const far = u === p.u1
            const z0 = area.u0 <= -thickness / 2 + 1e-6 ? -thickness / 2 - grow : area.u0
            const z1 = area.u1 >= thickness / 2 - 1e-6 ? thickness / 2 + grow : area.u1
            const y0 = Math.max(p.y0, area.y0)
            const y1 = Math.min(p.y1, area.y1)
            if (z1 - z0 < 1e-6) return []
            const end = beyond(p, far, list)
            return bands(y0, y1, end).flatMap(([y0, y1]) =>
              end.open((y0 + y1) / 2) ? [{ u, far, z0, z1, y0, y1 }] : [],
            )
          }),
        )
  // The pieces carrying on from an end of a piece, and whether its end face is open (an edge of the wall) at a height.
  const beyond = (p: WallPiece, far: boolean, list: WallPiece[]) => {
    const u = far ? p.u1 : p.u0
    const next = list.filter((q) => q !== p && Math.abs((far ? q.u0 : q.u1) - u) < 1e-6)
    return { next, open: (y: number) => !next.some((q) => q.y0 < y && y < q.y1) }
  }
  // `y0`–`y1` cut where any of those pieces start or stop.
  const bands = (y0: number, y1: number, ...ends: { next: WallPiece[] }[]) => {
    if (y1 - y0 < 1e-6) return []
    const ys = [
      ...new Set([y0, y1, ...ends.flatMap((e) => e.next.flatMap((q) => [q.y0, q.y1])).filter((y) => y > y0 && y < y1)]),
    ].sort((a, b) => a - b)
    return ys.slice(1).map((y, i): [number, number] => [ys[i], y])
  }
  // A piece under an opening has the opening's sill on top of it, one over it the head underneath.
  const revealOf = (p: WallPiece, face: RevealFace) => {
    const at = face === 'sill' ? p.y1 : p.y0
    const opening = wall.openings?.find(
      (o) =>
        o.offset <= p.u0 + 1e-6 &&
        p.u1 <= o.offset + o.width + 1e-6 &&
        Math.abs(at - (openingSill(o) + (face === 'sill' ? 0 : o.height))) < 1e-6,
    )
    return opening && endPart(opening.offset + offset)
  }
  // Where an area lies on the sills or heads of the given pieces at its opening.
  const revealPieces = (area: WallArea, list: WallPiece[], grow = AREA_PROUD): RevealRect[] => {
    const face = area.side
    if (!isReveal(face)) return []
    return list.flatMap((p) => {
      if (revealOf(p, face) !== area.part) return []
      const u0 = Math.max(p.u0, area.u0 - offset)
      const u1 = Math.min(p.u1, area.u1 - offset)
      const z0 = area.y0 <= 1e-6 ? -thickness / 2 - grow : area.y0 - thickness / 2
      const z1 = area.y1 >= thickness - 1e-6 ? thickness / 2 + grow : area.y1 - thickness / 2
      const up = face === 'sill'
      return u1 - u0 > 1e-6 && z1 - z0 > 1e-6 ? [{ u0, u1, z0, z1, y: up ? p.y1 : p.y0, up }] : []
    })
  }
  // The face behind a shaft is hidden, and paint on the shaft's front mustn't peek out round its edges.
  const behindShafts = useMemo(
    () => (wall.partOf ? { a: [], b: [] } : { a: shaftSpans(wall, floor, 'a'), b: shaftSpans(wall, floor, 'b') }),
    [wall, floor],
  )
  // Where an area lies on the given pieces of its part: the pieces leave out the openings.
  const areaPieces = (area: WallArea, list: WallPiece[], grow = AREA_PROUD) =>
    list.flatMap((p) => {
      if (area.side === 'end' || isReveal(area.side) || partOf(p, area.side) !== area.part) return []
      const side = area.side
      // Round the edge onto a sill or head too.
      const y0 = area.y0 <= p.y0 + 1e-6 && revealOf(p, 'head') !== undefined ? p.y0 - grow : Math.max(p.y0, area.y0)
      const y1 = area.y1 >= p.y1 - 1e-6 && revealOf(p, 'sill') !== undefined ? p.y1 + grow : Math.min(p.y1, area.y1)
      // Round the piece's ends too, at the heights where no piece carries on from them.
      const [near, far] = [beyond(p, false, list), beyond(p, true, list)]
      return bands(y0, y1, near, far).flatMap(([y0, y1]) => {
        const y = (y0 + y1) / 2
        const u0 = area.u0 - offset <= p.u0 + 1e-6 ? p.u0 - (near.open(y) ? grow : 0) : area.u0 - offset
        const u1 = area.u1 - offset >= p.u1 - 1e-6 ? p.u1 + (far.open(y) ? grow : 0) : area.u1 - offset
        return clearOfShafts(side, u0, u1).map(([u0, u1]) => ({ u0, u1, y0, y1 }))
      })
    })
  // A side's span with the stretch behind a shaft left out.
  const clearOfShafts = (side: WallSide, u0: number, u1: number) => {
    let spans: [number, number][] = [[u0, u1]]
    for (const [m0, m1] of behindShafts[side]) {
      // The shaft is drawn just inside its outline, so paint that stops at its edge carries on to meet it.
      const [o0, o1] = [m0 - offset, m1 - offset]
      const [s0, s1] = [o0 + CORNER_INSET, o1 - CORNER_INSET]
      spans = spans.flatMap(([u0, u1]): [number, number][] =>
        u0 >= o0 - 1e-6 && u1 <= o1 + 1e-6
          ? []
          : [
              [u0, Math.abs(u1 - o0) < 1e-6 ? s0 : Math.min(u1, s0)],
              [Math.abs(u0 - o1) < 1e-6 ? s1 : Math.max(u0, s1), u1],
            ],
      )
    }
    return spans.filter(([u0, u1]) => u1 - u0 > 1e-6)
  }
  const inSelection = (list: WallPiece[]) => {
    const side = selected?.side
    if (!side || side === 'end' || isReveal(side)) return []
    const area = selected.area && areas.find((a) => a.id === selected.area)
    if (area) return areaPieces(area, list)
    return list.filter((p) => partOf(p, side) === selected?.part)
  }
  const stub = useMemo(() => stubPieces(pieces, STUB_HEIGHT), [pieces])

  // Box faces in wall-local space: +z is side 'a', -z is side 'b', ±x the ends at u1 and u0.
  const handleClick = (p: WallPiece) => (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_SLOP_PX) return
    const n = e.face?.normal
    if (!n) return
    e.stopPropagation()
    if (n.z > 0.5) onPick(owner.id, 'a', partOf(p, 'a'))
    else if (n.z < -0.5) onPick(owner.id, 'b', partOf(p, 'b'))
    else if (Math.abs(n.x) > 0.5) onPick(owner.id, 'end', endPart((n.x > 0 ? p.u1 : p.u0) + offset))
    else {
      const face = n.y > 0 ? 'sill' : 'head'
      const part = revealOf(p, face)
      if (part !== undefined) onPick(owner.id, face, part)
    }
  }

  // Painting goes on in squares on a side's, an end's or a reveal's face: hovering shows the square under the pointer, and a
  // click starts the block of squares from there, across the plane of that face, in the wall's own space.
  /** A point in the world on the target's face: along the owning wall (or across an end) and up (or across a reveal). */
  const local = (target: PaintTarget, group: Object3D, p: Vector3): [number, number] => {
    const l = group.worldToLocal(p.clone())
    if (isReveal(target.side)) return [l.x + offset, l.z + thickness / 2]
    return [target.side === 'end' ? l.z : l.x + offset, l.y]
  }
  // Beside an opening, squares count from its bottom and stop at its top.
  const endCells = (part: number, far: boolean, from: [number, number], to: [number, number]) => {
    const at = openingAt(owner, floor, part)
    const y0 = at ? openingSill(at.opening) : 0
    const height = at ? at.opening.height : wallHeight(wall, floor)
    const cells = paintCells(
      // Facing the far end, side a is on the left.
      far ? 'b' : 'a',
      { u0: -thickness / 2, u1: thickness / 2 },
      height,
      brush?.size ?? 1,
      [from[0], from[1] - y0],
      [to[0], to[1] - y0],
    )
    return { ...cells, y0: cells.y0 + y0, y1: cells.y1 + y0 }
  }
  const revealCells = (part: number, from: [number, number], to: [number, number]) => {
    const at = openingAt(owner, floor, part)
    const u0 = at?.u0 ?? from[0]
    return paintCells('a', { u0, u1: u0 + (at?.opening.width ?? 0) }, thickness, brush?.size ?? 1, from, to)
  }
  const cells = ({ far, ...target }: PaintTarget, from: [number, number], to: [number, number]): PaintStroke => ({
    ...target,
    ...(isReveal(target.side)
      ? revealCells(target.part, from, to)
      : target.side === 'end'
        ? endCells(target.part, !!far, from, to)
        : paintCells(
            target.side,
            // Squares stay on the flat stretch the stroke started on.
            paintStretch(owner, floor, target.side, target.part, from[0]),
            wallHeight(owner, floor),
            brush?.size ?? 1,
            from,
            to,
          )),
  })
  const startStroke = (e: ThreeEvent<MouseEvent>, target: PaintTarget) => {
    const group = wallGroup(e.object)
    if (startRef.current || e.delta > CLICK_SLOP_PX || !group) return
    e.stopPropagation()
    // Shift paints the whole wall, as one click.
    if (e.nativeEvent.shiftKey) {
      onPreview(undefined)
      return onPaintWall?.(target)
    }
    const from = local(target, group, e.point)
    const normal = (
      target.side === 'end'
        ? new Vector3(target.far ? 1 : -1, 0, 0)
        : isReveal(target.side)
          ? new Vector3(0, target.side === 'sill' ? 1 : -1, 0)
          : new Vector3(0, 0, target.side === 'a' ? 1 : -1)
    ).transformDirection(group.matrixWorld)
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, e.point)
    let to = from
    startRef.current = {
      click: e.nativeEvent,
      to: (ray) => {
        const hit = ray.intersectPlane(plane, new Vector3())
        if (hit) to = local(target, group, hit)
        return cells(target, from, to)
      },
    }
    onPreview({ ...cells(target, from, from), started: true })
  }
  const pointerMove = (e: ThreeEvent<PointerEvent>, target: PaintTarget | undefined) => {
    // A started block follows the pointer on its own.
    if (startRef.current) return
    const group = wallGroup(e.object)
    if (!target || !group) return onPreview(undefined)
    e.stopPropagation()
    const at = local(target, group, e.point)
    onPreview({ ...cells(target, at, at), started: false })
  }
  const strokeHandlers = (target: (e: ThreeEvent<MouseEvent>) => PaintTarget | undefined): MeshHandlers => ({
    onClick: (e) => {
      const t = target(e)
      if (t) startStroke(e, t)
    },
    onPointerMove: (e) => pointerMove(e, target(e)),
    onPointerOver: (e) => (e.stopPropagation(), (document.body.style.cursor = 'crosshair')),
    // The cursor goes back with the square.
    onPointerOut: () => {
      if (!startRef.current) onPreview(undefined)
    },
  })
  const paintHandlers = (p: WallPiece): MeshHandlers =>
    strokeHandlers((e) => {
      const n = e.face?.normal
      if (!n) return undefined
      // Only the inside of the house is painted.
      if (n.z > 0.5) return outside === 'a' ? undefined : { wallId: owner.id, side: 'a', part: partOf(p, 'a') }
      if (n.z < -0.5) return outside === 'b' ? undefined : { wallId: owner.id, side: 'b', part: partOf(p, 'b') }
      if (Math.abs(n.y) > 0.5) {
        const face = n.y > 0 ? 'sill' : 'head'
        const part = revealOf(p, face)
        return part === undefined ? undefined : { wallId: owner.id, side: face, part }
      }
      if (Math.abs(n.x) < 0.5) return undefined
      const far = n.x > 0
      return { wallId: owner.id, side: 'end', part: endPart((far ? p.u1 : p.u0) + offset), far }
    })
  const boxHandlers = (p: WallPiece): MeshHandlers =>
    interactive ? { onClick: handleClick(p), ...hover('pointer') } : brush ? paintHandlers(p) : {}
  const areaHandlers = (area: WallArea, far?: boolean): MeshHandlers =>
    interactive
      ? {
          onClick: (e) => {
            if (e.delta > CLICK_SLOP_PX) return
            e.stopPropagation()
            onPick(owner.id, area.side, area.part, area.id)
          },
          ...hover('pointer'),
        }
      : brush && area.side !== outside
        ? strokeHandlers(() => ({ wallId: owner.id, side: area.side, part: area.part, far }))
        : {}

  // The block at a corner, shared with the wall met there: a room view keeps it with either wall.
  const length = wallLength(wall)
  const cornerOf = (p: WallPiece) =>
    corners.find((c) => (c.at < length / 2 ? p.u1 <= c.at + 1e-6 : p.u0 >= c.at - 1e-6))?.wall
  const isCorner = (p: WallPiece) => cornerOf(p) !== undefined
  // Looking at a room, a corner this wall shares with one of the room's own walls goes with that wall: it
  // stands in the room's outline, so it's cut away (or left) with the walls either side of it there.
  const handedOver = (p: WallPiece) => {
    const other = cornerOf(p)
    return focus && !focus.sides.has(wall.id) && other && focus.sides.has(other) ? other : undefined
  }
  const own = pieces.filter((p) => !handedOver(p))
  const given = [...new Set(pieces.map(handedOver).filter((id) => id !== undefined))]

  // Only the horizontal section face is artificial. The vertical faces keep their real lighting/shadows,
  // including on shortened walls; the complete hidden wall still blocks light in the physical scene.
  const revealColor = (p: WallPiece, face: RevealFace) => {
    const part = revealOf(p, face)
    return (part !== undefined && wallPartColor(colors, owner.id, face, part)) || WALL_CAP
  }
  const boxes = (list: WallPiece[], cut = false) => {
    return list.map((p, i) => (
      <mesh
        key={i}
        position={[(p.u0 + p.u1) / 2, (p.y0 + p.y1) / 2, 0]}
        userData={{ corner: isCorner(p) }}
        receiveShadow
        raycast={interactive || brush ? raycastIfShown : noRaycast}
        {...boxHandlers(p)}
      >
        <boxGeometry args={[p.u1 - p.u0, p.y1 - p.y0, thickness]} />
        {/* At a flush passage return, a wall side can share the end cap's plane. Keep the side in front. */}
        <meshStandardMaterial
          roughness={1}
          attach="material-0"
          color={endColor(p.u1)}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
        <meshStandardMaterial
          roughness={1}
          attach="material-1"
          color={endColor(p.u0)}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
        <meshStandardMaterial
          attach="material-2"
          color={revealColor(p, 'sill')}
          roughness={1}
          userData={{ section: (cut && p.y1 === STUB_HEIGHT) || p.y1 >= floor.height }}
        />
        <meshStandardMaterial roughness={1} attach="material-3" color={revealColor(p, 'head')} />
        <meshStandardMaterial roughness={1} attach="material-4" color={colorOf(p, 'a')} />
        <meshStandardMaterial roughness={1} attach="material-5" color={colorOf(p, 'b')} />
      </mesh>
    ))
  }

  // Areas don't overlap; where painting would go shows over them.
  const paint = (list: WallPiece[]) => {
    const handlers = (area: WallArea, far?: boolean) => (interactive || brush ? areaHandlers(area, far) : undefined)
    const shown = preview && brush && { ...preview, id: '', color: '' }
    // Taking paint off shows as the selection wash.
    const look = brush && {
      color: brush.erase ? SELECTED_OUTLINE : brush.color,
      opacity: brush.erase ? 0.45 : preview?.started ? 0.9 : 0.6,
    }
    return (
      <>
        {areas.map((area) =>
          area.side === 'end' ? (
            <EndPaint
              key={area.id}
              rects={endPieces(area, list)}
              color={area.color}
              proud={AREA_PROUD}
              handlers={(far) => handlers(area, far)}
            />
          ) : isReveal(area.side) ? (
            <RevealPaint
              key={area.id}
              rects={revealPieces(area, list)}
              color={area.color}
              proud={AREA_PROUD}
              handlers={handlers(area)}
            />
          ) : (
            <AreaPaint
              key={area.id}
              pieces={areaPieces(area, list)}
              side={area.side}
              color={area.color}
              z={thickness / 2 + AREA_PROUD}
              handlers={handlers(area)}
            />
          ),
        )}
        {shown &&
          look &&
          (shown.side === 'end' ? (
            <EndPaint rects={endPieces(shown, list, 2 * AREA_PROUD)} {...look} proud={2 * AREA_PROUD} />
          ) : isReveal(shown.side) ? (
            <RevealPaint rects={revealPieces(shown, list, 2 * AREA_PROUD)} {...look} proud={2 * AREA_PROUD} />
          ) : (
            <AreaPaint
              pieces={areaPieces(shown, list, 2 * AREA_PROUD)}
              side={shown.side}
              {...look}
              z={thickness / 2 + 2 * AREA_PROUD}
            />
          ))}
      </>
    )
  }
  // A picked area on a sill or head is washed on its own; else the whole of it.
  const revealSelection = (list: WallPiece[]) => {
    if (!selected || !isReveal(selected.side)) return null
    const area = (selected.area && areas.find((a) => a.id === selected.area)) || {
      ...selected,
      id: '',
      wallId: owner.id,
      color: '',
      u0: -Infinity,
      u1: Infinity,
      y0: 0,
      y1: thickness,
    }
    return <RevealPaint rects={revealPieces(area, list)} color={SELECTED_OUTLINE} opacity={0.6} wash proud={PROUD} />
  }
  const highlight = (list: WallPiece[]) =>
    !selected ? null : selected.side === 'end' ? (
      endSelection(list)
    ) : isReveal(selected.side) ? (
      revealSelection(list)
    ) : (
      <SideHighlight pieces={inSelection(list)} side={selected.side} thickness={thickness} />
    )
  // A picked area on an end is washed on its own; else the whole end at that point.
  const endSelection = (list: WallPiece[]) => {
    const area = selected?.area && areas.find((a) => a.id === selected.area)
    return area ? (
      <EndPaint rects={endPieces(area, list)} color={SELECTED_OUTLINE} opacity={0.6} wash proud={PROUD} />
    ) : (
      <EndHighlight pieces={list} part={selected!.part} offset={offset} thickness={thickness} />
    )
  }

  const ownStub = stubPieces(own, STUB_HEIGHT)
  const opening = (top?: number) =>
    wall.openings && (
      <OpeningFills
        wallId={wall.id}
        openings={wall.openings}
        exterior={isExteriorWall(wall, floor)}
        outside={outside}
        thickness={thickness}
        clickable={doors}
        openDoors={openDoors}
        onToggleDoor={onToggleDoor}
        shades={shades}
        onPickShade={onPickShade}
        onHoverShade={onHoverShade}
        hoveredShade={hoveredShade}
        ghostShades={cutaway}
        top={top}
      />
    )

  return (
    <>
      <CutawayWall
        wall={wall}
        floor={floor}
        cutaway={cutaway}
        focus={focus}
        full={
          <>
            {boxes(own)}
            {paint(own)}
            {highlight(pieces)}
            {opening()}
          </>
        }
        stub={
          <>
            {boxes(ownStub, true)}
            {paint(ownStub)}
            {highlight(stub)}
            {opening(STUB_HEIGHT)}
          </>
        }
      />
      {given.map((id) => {
        const corner = pieces.filter((p) => handedOver(p) === id)
        return (
          <CutawayWall
            key={id}
            wall={wall}
            floor={floor}
            cutaway={cutaway}
            focus={focus}
            decider={floor.walls.find((w) => w.id === id)}
            full={
              <>
                {boxes(corner)}
                {paint(corner)}
              </>
            }
            stub={
              <>
                {boxes(stubPieces(corner, STUB_HEIGHT), true)}
                {paint(stubPieces(corner, STUB_HEIGHT))}
              </>
            }
          />
        )
      })}
    </>
  )
}

/** A painted area on a side's face, lit like the wall under it. */
const AreaPaint = ({
  pieces,
  side,
  color,
  z,
  handlers,
  opacity,
}: {
  pieces: WallPiece[]
  side: WallSide
  color: string
  /** How far out from the wall's centre the face sits. */
  z: number
  /** Taps and drags on it; none and it can't be pointed at. */
  handlers?: MeshHandlers
  /** Less than 1 to see through it. */
  opacity?: number
}) => (
  <group rotation-y={side === 'a' ? 0 : Math.PI}>
    {pieces.map((p, i) => (
      <mesh
        key={i}
        position={[((p.u0 + p.u1) / 2) * (side === 'a' ? 1 : -1), (p.y0 + p.y1) / 2, z]}
        // A see-through one is laid over the wall, not something the pointer stops at.
        userData={{ overlay: opacity !== undefined }}
        receiveShadow
        raycast={handlers ? raycastIfShown : noRaycast}
        {...handlers}
      >
        <planeGeometry args={[p.u1 - p.u0, p.y1 - p.y0]} />
        <meshStandardMaterial
          roughness={1}
          color={color}
          transparent={opacity !== undefined}
          opacity={opacity ?? 1}
          depthWrite={opacity === undefined}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
    ))}
  </group>
)

/** A rectangle on an end face: `u` is where the end is along the wall, `z0`–`z1` across it. */
type EndRect = { u: number; far: boolean; z0: number; z1: number; y0: number; y1: number }

/** Paint on wall ends, lit like the end under it, or the selection wash over it. */
const EndPaint = ({
  rects,
  color,
  proud,
  handlers,
  opacity,
  wash,
}: {
  rects: EndRect[]
  color: string
  /** How far off the end face it sits. */
  proud: number
  /** Taps and drags on it, by which end it's on; none and it can't be pointed at. */
  handlers?: (far: boolean) => MeshHandlers | undefined
  opacity?: number
  /** Unlit, as the selection wash. */
  wash?: boolean
}) => (
  <>
    {rects.map((r, i) => {
      const h = handlers?.(r.far)
      return (
        <mesh
          key={i}
          position={[r.u + (r.far ? proud : -proud), (r.y0 + r.y1) / 2, (r.z0 + r.z1) / 2]}
          rotation-y={r.far ? Math.PI / 2 : -Math.PI / 2}
          userData={{ overlay: opacity !== undefined }}
          receiveShadow={!wash}
          raycast={h ? raycastIfShown : noRaycast}
          {...h}
        >
          <planeGeometry args={[r.z1 - r.z0, r.y1 - r.y0]} />
          <PaintMaterial color={color} opacity={opacity} wash={wash} />
        </mesh>
      )
    })}
  </>
)

/** A rectangle on a sill (facing up) or a head (facing down) at height `y`: `u0`–`u1` along the wall, `z0`–`z1` across. */
type RevealRect = { u0: number; u1: number; z0: number; z1: number; y: number; up: boolean }

/** Paint on sills and heads, lit like the face under it, or the selection wash over it. */
const RevealPaint = ({
  rects,
  color,
  proud,
  handlers,
  opacity,
  wash,
}: {
  rects: RevealRect[]
  color: string
  /** How far off the face it sits. */
  proud: number
  /** Taps on it; none and it can't be pointed at. */
  handlers?: MeshHandlers
  opacity?: number
  /** Unlit, as the selection wash. */
  wash?: boolean
}) => (
  <>
    {rects.map((r, i) => (
      <mesh
        key={i}
        position={[(r.u0 + r.u1) / 2, r.y + (r.up ? proud : -proud), (r.z0 + r.z1) / 2]}
        rotation-x={r.up ? -Math.PI / 2 : Math.PI / 2}
        userData={{ overlay: opacity !== undefined }}
        receiveShadow={!wash}
        raycast={handlers ? raycastIfShown : noRaycast}
        {...handlers}
      >
        <planeGeometry args={[r.u1 - r.u0, r.z1 - r.z0]} />
        <PaintMaterial color={color} opacity={opacity} wash={wash} />
      </mesh>
    ))}
  </>
)

/** Paint lit like the face under it and kept in front of it, or unlit as the selection wash. */
const PaintMaterial = ({ color, opacity, wash }: { color: string; opacity?: number; wash?: boolean }) => {
  const material = {
    color,
    transparent: opacity !== undefined,
    opacity: opacity ?? 1,
    depthWrite: opacity === undefined,
  }
  return wash ? (
    <meshBasicMaterial {...material} />
  ) : (
    <meshStandardMaterial roughness={1} {...material} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
  )
}

/** The picked side's face washed in the accent colour, as when measuring. */
const SideHighlight = ({ pieces, side, thickness }: { pieces: WallPiece[]; side: WallSide; thickness: number }) => {
  const z = (side === 'a' ? 1 : -1) * (thickness / 2 + PROUD)
  return (
    <group rotation-y={side === 'a' ? 0 : Math.PI}>
      {pieces.map((p, i) => (
        <mesh
          key={i}
          position={[((p.u0 + p.u1) / 2) * (side === 'a' ? 1 : -1), (p.y0 + p.y1) / 2, Math.abs(z)]}
          userData={{ overlay: true }}
          raycast={noRaycast}
        >
          <planeGeometry args={[p.u1 - p.u0, p.y1 - p.y0]} />
          <meshBasicMaterial color={SELECTED_OUTLINE} transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** A picked wall end washed like a side: every piece's end face at that point along the wall. */
const EndHighlight = ({
  pieces,
  part,
  thickness,
  offset = 0,
}: {
  pieces: WallPiece[]
  part: number
  thickness: number
  offset?: number
}) => (
  <>
    {pieces.flatMap((p, i) =>
      ([p.u0, p.u1] as const)
        .filter((u) => endPart(u + offset) === part)
        .map((u) => (
          <mesh
            key={`${i}:${u}`}
            position={[u + (u === p.u1 ? PROUD : -PROUD), (p.y0 + p.y1) / 2, 0]}
            rotation-y={u === p.u1 ? Math.PI / 2 : -Math.PI / 2}
            userData={{ overlay: true }}
            raycast={noRaycast}
          >
            <planeGeometry args={[thickness, p.y1 - p.y0]} />
            <meshBasicMaterial color={SELECTED_OUTLINE} transparent opacity={0.6} depthWrite={false} />
          </mesh>
        )),
    )}
  </>
)
