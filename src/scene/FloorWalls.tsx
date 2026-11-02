import { useThree, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Plane, Vector3, type Object3D } from 'three'
import {
  cornerCuts,
  endPart,
  isExteriorWall,
  outsideFace,
  paintCells,
  paintStretch,
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
// Painted areas sit just off the face, each later one a step further out, all under the selection wash.
const AREA_PROUD = 0.0008

/** What a tap or drag on a wall does while painting: brush on a colour in squares `size` across, or take it off. */
export type Brush = { color: string; erase: boolean; size: number }

/** A block of paint squares on a part of a wall side, before it has a colour. */
export type PaintStroke = Omit<NewWallArea, 'color'>

/** A part of a wall side, or a wall end, painted in squares, or whole with Shift. */
export type PaintFace = { wallId: string; side: WallFace; part: number }

/** Where a stroke goes on, and for an end whether it's the far one, facing the way the wall runs. */
type PaintTarget = PaintFace & { far?: boolean }

/** Where painting would go: the square under the pointer, or the block being dragged out. */
type PaintPreview = PaintStroke & { dragging: boolean }

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
  /** While painting: a tap paints the square under it, a drag a block of squares, a Shift-tap the whole wall. */
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
  const showPreview = useCallback(
    (next: PaintPreview | undefined) => setPreview((now) => (samePreview(now, next) ? now : next)),
    [],
  )
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
          onPaint={onPaint}
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
  onPaint?: (stroke: PaintStroke) => void
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
  onPaint,
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
  const areas = useMemo(() => allAreas.filter((a) => a.wallId === owner.id), [allAreas, owner.id])
  // Where an area lies on the end faces of the given pieces at its part.
  const endPieces = (area: WallArea, list: WallPiece[]): EndRect[] =>
    area.side !== 'end'
      ? []
      : list.flatMap((p) =>
          ([p.u0, p.u1] as const).flatMap((u) => {
            if (endPart(u + offset) !== area.part) return []
            const z0 = Math.max(-thickness / 2, area.u0)
            const z1 = Math.min(thickness / 2, area.u1)
            const y0 = Math.max(p.y0, area.y0)
            const y1 = Math.min(p.y1, area.y1)
            return z1 - z0 > 1e-6 && y1 - y0 > 1e-6 ? [{ u, far: u === p.u1, z0, z1, y0, y1 }] : []
          }),
        )
  // Where an area lies on the given pieces of its part: the pieces leave out the openings.
  const areaPieces = (area: WallArea, list: WallPiece[]) =>
    list.flatMap((p) => {
      if (area.side === 'end' || partOf(p, area.side) !== area.part) return []
      const u0 = Math.max(p.u0, area.u0 - offset)
      const u1 = Math.min(p.u1, area.u1 - offset)
      const y0 = Math.max(p.y0, area.y0)
      const y1 = Math.min(p.y1, area.y1)
      return u1 - u0 > 1e-6 && y1 - y0 > 1e-6 ? [{ u0, u1, y0, y1 }] : []
    })
  const inSelection = (list: WallPiece[]) => {
    const side = selected?.side
    if (!side || side === 'end') return []
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
  }

  // Painting goes on in squares on a side's or an end's face: hovering shows the square under the pointer, a drag
  // the block of squares from where it was pressed, across the plane of that face, in the wall's own space.
  const getState = useThree((s) => s.get)
  const drag = useRef<{ target: PaintTarget; group: Object3D; plane: Plane; start: [number, number] }>(undefined)
  const setControlsEnabled = (enabled: boolean) => {
    const controls = getState().controls as { enabled: boolean } | null
    if (controls) controls.enabled = enabled
  }
  /** A point in the world on the target's face: along the owning wall (or across an end) and up. */
  const local = (target: PaintTarget, group: Object3D, p: Vector3): [number, number] => {
    const l = group.worldToLocal(p.clone())
    return [target.side === 'end' ? l.z : l.x + offset, l.y]
  }
  const cells = ({ far, ...target }: PaintTarget, from: [number, number], to: [number, number]): PaintStroke => ({
    ...target,
    ...(target.side === 'end'
      ? // Facing the far end, side a is on the left.
        paintCells(
          far ? 'b' : 'a',
          { u0: -thickness / 2, u1: thickness / 2 },
          wallHeight(wall, floor),
          brush?.size ?? 1,
          from,
          to,
        )
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
  const pointerDown = (e: ThreeEvent<PointerEvent>, target: PaintTarget) => {
    const group = wallGroup(e.object)
    if (!group) return
    e.stopPropagation()
    // Shift paints the whole wall, as one tap.
    if (e.nativeEvent.shiftKey) {
      onPreview(undefined)
      return onPaintWall?.(target)
    }
    const start = local(target, group, e.point)
    const normal = (
      target.side === 'end' ? new Vector3(target.far ? 1 : -1, 0, 0) : new Vector3(0, 0, target.side === 'a' ? 1 : -1)
    ).transformDirection(group.matrixWorld)
    drag.current = { target, group, plane: new Plane().setFromNormalAndCoplanarPoint(normal, e.point), start }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setControlsEnabled(false)
    onPreview({ ...cells(target, start, start), dragging: true })
  }
  const pointerMove = (e: ThreeEvent<PointerEvent>, target: PaintTarget | undefined) => {
    const d = drag.current
    if (d) {
      e.stopPropagation()
      const hit = e.ray.intersectPlane(d.plane, new Vector3())
      if (hit) onPreview({ ...cells(d.target, d.start, local(d.target, d.group, hit)), dragging: true })
      return
    }
    const group = wallGroup(e.object)
    if (!target || !group) return onPreview(undefined)
    e.stopPropagation()
    const at = local(target, group, e.point)
    onPreview({ ...cells(target, at, at), dragging: false })
  }
  const endStroke = (e: ThreeEvent<PointerEvent>, cancel = false) => {
    const d = drag.current
    if (!d) return
    drag.current = undefined
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    setControlsEnabled(true)
    onPreview(undefined)
    if (cancel) return
    const hit = e.ray.intersectPlane(d.plane, new Vector3())
    onPaint?.(cells(d.target, d.start, hit ? local(d.target, d.group, hit) : d.start))
  }
  const strokeHandlers = (target: (e: ThreeEvent<PointerEvent>) => PaintTarget | undefined): MeshHandlers => ({
    onPointerDown: (e) => {
      const t = target(e)
      if (t) pointerDown(e, t)
    },
    onPointerMove: (e) => pointerMove(e, target(e)),
    onPointerUp: (e) => endStroke(e),
    onPointerCancel: (e) => endStroke(e, true),
    onPointerOver: (e) => (e.stopPropagation(), (document.body.style.cursor = 'crosshair')),
    onPointerOut: () => {
      document.body.style.cursor = ''
      if (!drag.current) onPreview(undefined)
    },
  })
  const paintHandlers = (p: WallPiece): MeshHandlers =>
    strokeHandlers((e) => {
      const n = e.face?.normal
      if (!n) return undefined
      if (n.z > 0.5) return { wallId: owner.id, side: 'a', part: partOf(p, 'a') }
      if (n.z < -0.5) return { wallId: owner.id, side: 'b', part: partOf(p, 'b') }
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
      : brush
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
          color={WALL_CAP}
          roughness={1}
          userData={{ section: (cut && p.y1 === STUB_HEIGHT) || p.y1 >= floor.height }}
        />
        <meshStandardMaterial roughness={1} attach="material-3" color={WALL_CAP} />
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
      opacity: brush.erase ? 0.45 : preview?.dragging ? 0.9 : 0.6,
    }
    return (
      <>
        {areas.map((area, k) =>
          area.side === 'end' ? (
            <EndPaint
              key={area.id}
              rects={endPieces(area, list)}
              color={area.color}
              proud={AREA_PROUD * (k + 1)}
              handlers={(far) => handlers(area, far)}
            />
          ) : (
            <AreaPaint
              key={area.id}
              pieces={areaPieces(area, list)}
              side={area.side}
              color={area.color}
              z={thickness / 2 + AREA_PROUD * (k + 1)}
              handlers={handlers(area)}
            />
          ),
        )}
        {shown &&
          look &&
          (shown.side === 'end' ? (
            <EndPaint rects={endPieces(shown, list)} {...look} proud={AREA_PROUD * (areas.length + 1)} />
          ) : (
            <AreaPaint
              pieces={areaPieces(shown, list)}
              side={shown.side}
              {...look}
              z={thickness / 2 + AREA_PROUD * (areas.length + 1)}
            />
          ))}
      </>
    )
  }
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
  const outside = useMemo(() => (isExteriorWall(wall, floor) ? outsideFace(wall, floor) : undefined), [wall, floor])
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
            {selected && selected.side !== 'end' && (
              <SideHighlight pieces={inSelection(pieces)} side={selected.side} thickness={thickness} />
            )}
            {selected?.side === 'end' && endSelection(pieces)}
            {opening()}
          </>
        }
        stub={
          <>
            {boxes(ownStub, true)}
            {paint(ownStub)}
            {selected && selected.side !== 'end' && (
              <SideHighlight pieces={inSelection(stub)} side={selected.side} thickness={thickness} />
            )}
            {selected?.side === 'end' && endSelection(stub)}
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
      const material = {
        color,
        transparent: opacity !== undefined,
        opacity: opacity ?? 1,
        depthWrite: opacity === undefined,
      }
      return (
        <mesh
          key={i}
          position={[r.u + (r.far ? proud : -proud), (r.y0 + r.y1) / 2, (r.z0 + r.z1) / 2]}
          rotation-y={r.far ? Math.PI / 2 : -Math.PI / 2}
          receiveShadow={!wash}
          raycast={h ? raycastIfShown : noRaycast}
          {...h}
        >
          <planeGeometry args={[r.z1 - r.z0, r.y1 - r.y0]} />
          {wash ? (
            <meshBasicMaterial {...material} />
          ) : (
            <meshStandardMaterial
              roughness={1}
              {...material}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          )}
        </mesh>
      )
    })}
  </>
)

/** The picked side's face washed in the accent colour, as when measuring. */
const SideHighlight = ({ pieces, side, thickness }: { pieces: WallPiece[]; side: WallSide; thickness: number }) => {
  const z = (side === 'a' ? 1 : -1) * (thickness / 2 + PROUD)
  return (
    <group rotation-y={side === 'a' ? 0 : Math.PI}>
      {pieces.map((p, i) => (
        <mesh
          key={i}
          position={[((p.u0 + p.u1) / 2) * (side === 'a' ? 1 : -1), (p.y0 + p.y1) / 2, Math.abs(z)]}
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
            raycast={noRaycast}
          >
            <planeGeometry args={[thickness, p.y1 - p.y0]} />
            <meshBasicMaterial color={SELECTED_OUTLINE} transparent opacity={0.6} depthWrite={false} />
          </mesh>
        )),
    )}
  </>
)
