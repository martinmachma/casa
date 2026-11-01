import type { Device, DeviceKind } from '../data/types'
import { house } from '../layout/layout'
import type { Point, WallSide } from '../layout/types'
import { mountAt } from './place'

// Drawings 2/3 have schematic symbol spacing, not dimensioned installation positions. Keep the existing
// architectural walls/windows; project symbols onto their corresponding face, clear of openings.
const ground = house.floors[0]
const upper = house.floors[1]
type Plan = NonNullable<Device['plan']>
const items: Device[] = []
const height = (kind: DeviceKind) =>
  ['socket', 'data', 'tv', 'earth'].includes(kind) ? 0.25 : kind === 'panel' ? 1.5 : 1.1

const wall = (
  id: string,
  kind: DeviceKind,
  name: string,
  wallId: string,
  side: WallSide,
  along: number,
  symbol: string,
  z = height(kind),
  notes?: string,
  ports?: number,
  area: Plan['area'] = 'inside',
) => {
  const floor = wallId.startsWith('g-') ? ground : upper
  const w = floor.walls.find((w) => w.id === wallId)!
  // `along` is an absolute x for horizontal walls and y for vertical ones, in the architectural plan.
  const t = w.from[0] === w.to[0] ? Math.abs(along - w.from[1]) : Math.abs(along - w.from[0])
  items.push({
    id: `electrical-${id}`,
    floor: floor.id,
    kind,
    name,
    z,
    ...mountAt(w, floor, side, t, z),
    plan: { sheet: floor === ground ? 2 : 3, symbol, notes, ports, area },
  })
}

const point = (
  id: string,
  kind: DeviceKind,
  name: string,
  floorId: string,
  at: Point,
  z: number,
  symbol: string,
  notes?: string,
  area: Plan['area'] = 'inside',
) =>
  items.push({
    id: `electrical-${id}`,
    floor: floorId,
    kind,
    name,
    x: at[0],
    y: at[1],
    z,
    plan: { sheet: area === 'roof' ? 4 : floorId === ground.id ? 2 : 3, symbol, notes, area },
  })

const sockets = (prefix: string, name: string, wallId: string, side: WallSide, positions: number[]) =>
  positions.forEach((at, i) =>
    wall(`${prefix}-${i + 1}`, 'socket', `${name} ${i + 1}`, wallId, side, at, '230 V / 16 A'),
  )
const sw = (id: string, name: string, wallId: string, side: WallSide, at: number, symbol = 'Single switch') =>
  wall(id, 'switch', name, wallId, side, at, symbol)
const ceiling = (id: string, name: string, floorId: string, at: Point, symbol = 'Ceiling lighting outlet') => {
  const floor = house.floors.find((f) => f.id === floorId)!
  point(
    id,
    'connection',
    name,
    floorId,
    at,
    floor.height,
    symbol,
    'Lighting connection shown in the drawing. The light fitting is chosen separately.',
  )
}
const media = (id: string, wallId: string, side: WallSide, tv: number, data: number) => {
  wall(
    `${id}-tv`,
    'tv',
    'TV antenna outlet',
    wallId,
    side,
    tv,
    'MTA',
    0.25,
    'In a shared frame with the power and data outlets.',
  )
  wall(
    `${id}-data`,
    'data',
    'Data outlet · 2 × RJ45',
    wallId,
    side,
    data,
    'DAT',
    0.25,
    'Double data outlet in a shared frame with power. Internal cable routes are not drawn.',
    2,
  )
}

// 1.NP — kitchen, living room, under-stair store, WC and entrance.
sockets('g-kitchen-nw', 'Kitchen worktop socket', 'g-north', 'a', [0.72, 0.87])
wall('g-oven', 'socket', 'Oven socket', 'g-north', 'a', 1.26, '230 V / 16 A')
wall('g-hob', 'connection', 'Hob supply', 'g-north', 'a', 1.53, 'Three-phase outlet', 0.25)
wall(
  'g-hood',
  'connection',
  'Extractor hood supply',
  'g-north',
  'a',
  1.8,
  'Multiwire outlet',
  2.1,
  'Height is indicative; coordinate with the kitchen and appliance design.',
)
sockets('g-kitchen-ne', 'Kitchen socket', 'g-north', 'a', [2.14, 2.29])
sw('g-terrace-switch', 'Terrace light switch', 'g-north', 'a', 2.46)
sockets('g-dining-north', 'Dining socket', 'g-north', 'a', [5.36, 5.51])
wall(
  'g-worktop-light',
  'connection',
  'Kitchen worktop lighting supply',
  'g-west',
  'a',
  0.58,
  'Wall lighting outlet',
  1.5,
  'Height is indicative; coordinate with kitchen cabinetry.',
)
sockets('g-worktop-west', 'Kitchen worktop socket', 'g-west', 'a', [0.82, 0.98])
wall('g-dishwasher', 'socket', 'Dishwasher socket', 'g-west', 'a', 1.95, '230 V / 16 A')
sw('g-kitchen-west-switch', 'Kitchen wall switch', 'g-west', 'a', 2.17)
sockets('g-worktop-south', 'Kitchen worktop socket', 'g-west', 'a', [2.36, 2.51])
wall('g-fridge', 'socket', 'Fridge socket', 'g-west', 'a', 2.75, '230 V / 16 A')
wall(
  'g-microwave',
  'socket',
  'Microwave socket',
  'g-shaft-s14',
  'b',
  0.48,
  '230 V / 16 A',
  0.25,
  'Projected onto the kitchen shaft face in the current architectural layout.',
)
wall('g-kitchen-south-socket', 'socket', 'Kitchen doorway socket', 'g-kitchen-storage', 'b', 2.05, '230 V / 16 A')
sw('g-kitchen-series', 'Kitchen two-gang switch', 'g-kitchen-storage', 'b', 2.19, 'Series switch')
sw(
  'g-kitchen-two-way',
  'Kitchen / living two-gang two-way switch',
  'g-kitchen-storage',
  'b',
  2.31,
  'Double two-way switch',
)
ceiling('g-kitchen-light', 'Kitchen ceiling lighting point', 'ground', [1.48, 2.03])
ceiling('g-dining-light', 'Dining ceiling lighting point', 'ground', [4.04, 2.03])
ceiling('g-living-light', 'Living ceiling lighting point', 'ground', [4.49, 5.55], 'Multiwire ceiling outlet')
sockets('g-living-east', 'Living wall socket', 'g-east-south', 'a', [3.85, 4.0])
sockets('g-living-media', 'Living media socket', 'g-east-south', 'a', [5.27, 5.42, 5.57])
media('g-living', 'g-east-south', 'a', 5.8, 6.02)
sockets('g-living-south', 'Living corner socket', 'g-east-south', 'a', [7.3, 7.45])
wall('g-living-door-socket', 'socket', 'Living doorway socket', 'g-core', 'b', 6.4, '230 V / 16 A')
sw('g-living-door-switch', 'Living two-gang two-way switch', 'g-core', 'b', 6.25, 'Double two-way switch')
wall('g-bell', 'bell', 'Entrance chime', 'g-core', 'b', 6.45, 'Doorbell chime', 2.1)
wall('g-store-socket', 'socket', 'Under-stair storage socket', 'g-kitchen-storage', 'a', 0.55, '230 V / 16 A')
ceiling('g-store-light', 'Under-stair storage light', 'ground', [1.3, 3.6], 'Ceiling light · max. 100 W, IP20')
sw('g-store-switch', 'Storage light switch', 'g-core', 'a', 4.04)
sw('g-stairs-two-way', 'Staircase two-way switch', 'g-storage-wc', 'b', 2.03, 'Two-way switch')
sw('g-stairs-intermediate', 'Staircase intermediate switch', 'g-storage-wc', 'b', 2.28, 'Intermediate switch')
ceiling('g-wc-light', 'WC ceiling light', 'ground', [1.25, 6.0], 'Ceiling light · max. 100 W, IP20')
wall('g-wc-fan', 'fan', 'WC extractor fan', 'g-west', 'a', 6.27, 'V · 230 V, up to 100 W', 2.3)
sw('g-wc-switch', 'WC light switch', 'g-wc-hall', 'b', 1.88)
sw('g-wc-timer', 'WC fan timer button', 'g-wc-hall', 'b', 2.07, 'Push button with run-on relay')
sw('g-hall-two-way', 'Hall two-way switch', 'g-wc-hall', 'a', 2.18, 'Two-way switch')
ceiling('g-hall-light', 'Hall ceiling light', 'ground', [1.55, 7.9], 'Ceiling light · max. 100 W, IP20')
point(
  'g-smoke',
  'sensor',
  'Hall smoke alarm',
  'ground',
  [1.57, 7.14],
  ground.height,
  'OK · autonomous optical smoke alarm',
)
wall('g-hall-socket', 'socket', 'Entrance socket', 'g-entrance-east', 'a', 7.9, '230 V / 16 A')
sw('g-entrance-switch', 'Entrance light switch', 'g-entrance-east', 'a', 7.91)
wall('g-rd', 'panel', 'RD · house electrical board', 'g-entrance-south', 'a', 0.56, 'RD', 1.5)
wall(
  'g-sla',
  'panel',
  'SLA · low-voltage distribution board',
  'g-west',
  'a',
  7.02,
  'SLA',
  1.5,
  'Optical-network connection and low-voltage riser. Drawing specifies a socket below the board and a three-way extension lead.',
)
wall(
  'g-sla-socket',
  'socket',
  'Low-voltage board service socket',
  'g-west',
  'a',
  7.02,
  '230 V / 16 A',
  0.25,
  'Below SLA; provide the three-way extension lead noted in the drawing.',
)

// Exterior points on drawing 2. Mount above the entrance opening where the architectural door differs.
wall(
  'g-terrace-light',
  'connection',
  'Terrace wall light',
  'g-north',
  'b',
  2.4,
  'Protected wall light · max. 100 W',
  2.2,
  undefined,
  undefined,
  'outside',
)
wall(
  'g-terrace-400v',
  'socket',
  'Terrace three-phase socket · 400 V',
  'g-north',
  'b',
  2.14,
  '16 A / 400 V · IP44',
  0.25,
  undefined,
  1,
  'outside',
)
wall(
  'g-terrace-230v',
  'socket',
  'Terrace weatherproof socket',
  'g-north',
  'b',
  2.32,
  'Protected 230 V / 16 A',
  0.25,
  undefined,
  1,
  'outside',
)
wall(
  'g-outdoor-temperature',
  'sensor',
  'Outdoor temperature sensor',
  'g-north',
  'b',
  1.54,
  'T · NTC, IP54',
  2.2,
  'For the heated-drain thermostat. Mounting height is indicative.',
  undefined,
  'outside',
)
wall(
  'g-entrance-light',
  'connection',
  'Entrance wall light',
  'g-entrance-east',
  'b',
  8.35,
  'Protected wall light · max. 100 W',
  2.3,
  undefined,
  undefined,
  'outside',
)
wall(
  'g-entrance-outlet',
  'socket',
  'Entrance weatherproof socket',
  'g-entrance-east',
  'b',
  9.17,
  'Protected 230 V / 16 A',
  0.25,
  undefined,
  1,
  'outside',
)
wall(
  'g-entrance-pir',
  'sensor',
  'Entrance motion sensor',
  'g-south',
  'b',
  5.98,
  'PIR · IP54, 270°, at least 12 m',
  2.2,
  undefined,
  undefined,
  'outside',
)
point(
  'g-re',
  'panel',
  'RE · electricity meter board',
  'ground',
  [5.69, 14.65],
  1.05,
  'RE · 3 × 25 A main breaker',
  'Shared utility pillar next to the service connection box.',
  'outside',
)
point(
  'g-sp',
  'panel',
  'SP · service connection box',
  'ground',
  [5.69, 15.04],
  0.65,
  'SP',
  'Utility-supplied service connection box.',
  'outside',
)
point(
  'g-bell-button',
  'bell',
  'Gate doorbell / intercom provision',
  'ground',
  [5.69, 15.3],
  1.1,
  'Doorbell button',
  'Leave spare cable for a camera intercom entry panel.',
  'outside',
)
point(
  'g-fibre-reserve',
  'data',
  'Fibre duct reserve at utility pillar',
  'ground',
  [5.5, 15.32],
  -0.24,
  'HDPE Ø40 mm reserve',
  'Duct ends in the ground beside the utility pillar; this is a provision, not an installed RJ45 outlet.',
  'outside',
)

// 2.NP — bedroom media banks each have three power sockets, one TV outlet and a double RJ45 outlet.
sockets('u-205-nw', "Sara's room north socket", 'u-north', 'a', [0.46, 0.61, 0.76])
media('u-205', 'u-north', 'a', 0.96, 1.12)
sockets('u-205-ne', "Sara's room corner socket", 'u-north', 'a', [2.82, 2.97])
sockets('u-205-west', "Sara's room bedside socket", 'u-west', 'a', [1.82, 1.98])
wall('u-205-door-socket', 'socket', "Sara's room doorway socket", 'u-205-south', 'b', 2.58, '230 V / 16 A')
sw('u-205-switch', "Sara's room light switch", 'u-205-south', 'b', 2.68)
ceiling('u-205-light', "Sara's room ceiling lighting point", 'upper', [1.95, 1.55])
sw('u-hall-north-1', 'Landing two-gang two-way switch 1', 'u-205-south', 'a', 2.52, 'Double two-way switch')
sw('u-hall-north-2', 'Landing two-gang two-way switch 2', 'u-205-south', 'a', 2.68, 'Double two-way switch')
wall(
  'u-stairs-light',
  'connection',
  'Staircase wall light',
  'u-west',
  'a',
  4.23,
  'Wall light · max. 100 W, IP20',
  1.8,
  'Height is indicative; the drawing does not dimension the wall light.',
)
ceiling('u-hall-light', 'Landing ceiling light', 'upper', [3.6, 4.23], 'Ceiling light · max. 100 W, IP20')
point(
  'u-smoke',
  'sensor',
  'Landing smoke alarm',
  'upper',
  [2.85, 4.23],
  upper.height,
  'OK · autonomous optical smoke alarm',
)
wall('u-hall-socket', 'socket', 'Landing socket', 'u-storage-west', 'a', 3.43, '230 V / 16 A')
sw('u-hall-cross-north', 'Landing intermediate switch · north', 'u-storage-west', 'a', 3.43, 'Intermediate switch')
sw('u-hall-cross-south', 'Landing intermediate switch · south', 'u-storage-west', 'a', 5.08, 'Intermediate switch')
sw('u-stairs-switch', 'Staircase two-way switch', 'u-middle', 'b', 2.5, 'Two-way switch')
sw('u-bedroom-door-switch', 'Bedroom two-gang switch', 'u-shaft-s15', 'a', 2.5, 'Series switch')
wall('u-bedroom-door-socket', 'socket', 'Bedroom doorway socket', 'u-shaft-s15', 'a', 2.5, '230 V / 16 A')
sockets('u-bedroom-west', 'Bedroom bedside socket', 'u-west', 'a', [6.22, 6.38])
sw('u-bedroom-west-switch', 'Bedroom bedside two-way switch · north', 'u-west', 'a', 6.62, 'Two-way switch')
sw('u-bedroom-south-switch', 'Bedroom bedside two-way switch · south', 'u-west', 'a', 8.55, 'Two-way switch')
sockets('u-bedroom-sw', 'Bedroom corner socket', 'u-west', 'a', [8.9, 9.05])
sockets('u-bedroom-media', 'Bedroom media socket', 'u-204-203', 'a', [8.45, 8.6, 8.75])
media('u-bedroom', 'u-204-203', 'a', 8.96, 9.12)
ceiling('u-bedroom-light', 'Bedroom ceiling lighting point', 'upper', [1.95, 7.5])
sw('u-203-switch', "Martin's room light switch", 'u-middle', 'a', 4.62)
wall('u-203-door-socket', 'socket', "Martin's room doorway socket", 'u-middle', 'a', 4.62, '230 V / 16 A')
sockets('u-203-ne', "Martin's room bedside socket", 'u-east-south', 'a', [5.6, 5.75])
sockets('u-203-se', "Martin's room corner socket", 'u-east-south', 'a', [8.9, 9.05])
sockets('u-203-media', "Martin's room media socket", 'u-204-203', 'b', [8.45, 8.6, 8.75])
media('u-203', 'u-204-203', 'b', 8.96, 9.12)
ceiling('u-203-light', "Martin's room ceiling lighting point", 'upper', [4.9, 7.15])
wall(
  'u-bath-mirror',
  'connection',
  'Bathroom mirror lighting supply',
  'u-205-bath',
  'b',
  0.8,
  'Wall lighting outlet',
  1.8,
  'Height is indicative; coordinate with the mirror.',
)
sockets('u-bath-basin', 'Bathroom basin socket', 'u-205-bath', 'b', [1.33, 1.49])
sw('u-bath-mirror-switch', 'Bathroom mirror switch', 'u-205-bath', 'b', 1.33)
wall(
  'u-towel-rail',
  'socket',
  'Bathroom heated towel rail connection',
  'u-205-bath',
  'b',
  2.46,
  'Protected 230 V / 16 A · žebřík',
  0.25,
  'The electrical note provides for a towel rail heating element, subject to the installed rail. Radiator dimensions and heating circuits are not specified.',
)
ceiling('u-bath-light', 'Bathroom ceiling light', 'upper', [4.52, 1.65], 'Ceiling light · max. 100 W, IP20')
point(
  'u-bath-fan',
  'fan',
  'Bathroom ceiling extractor fan',
  'upper',
  [4.75, 1.05],
  2.3,
  'V · 230 V, up to 100 W',
  'Shown in the suspended ceiling; exact ceiling height is not dimensioned.',
)
point('u-bath-bond', 'earth', 'Bathtub protective bonding', 'upper', [5.7, 1.4], 0.25, 'CYA 4 mm² protective bonding')
sw('u-bath-switch', 'Bathroom light switch', 'u-bath-south', 'b', 4.78)
sw('u-bath-timer', 'Bathroom fan timer button', 'u-bath-south', 'b', 4.95, 'Push button with run-on relay')
sw('u-store-switch', 'Boiler room light switch', 'u-storage-west', 'b', 4.86)
ceiling('u-store-light', 'Boiler room ceiling light', 'upper', [5.5, 4.23], 'Ceiling light · max. 100 W, IP20')
wall('u-washer', 'socket', 'Washing machine socket', 'u-bath-south', 'a', 5.12, '230 V / 16 A')
wall('u-dryer', 'socket', 'Dryer socket', 'u-bath-south', 'a', 5.35, '230 V / 16 A')
wall(
  'u-boiler',
  'socket',
  'Gas boiler socket',
  'u-east-south',
  'a',
  3.43,
  '230 V / 16 A',
  0.25,
  'Boiler, temperature sensors and room thermostat wiring must be coordinated with the heating supplier; sensor/thermostat positions are not drawn.',
)
wall('u-circulation', 'socket', 'Hot-water circulation pump socket', 'u-east-south', 'a', 3.67, '230 V / 16 A')

// Roof drawing 4. Adjacent-house rods are deliberately not counted as equipment belonging to this house.
export const ROOF_LEVEL = upper.elevation + upper.height + 0.3
const roofZ = ROOF_LEVEL - upper.elevation
point(
  'roof-drain-north',
  'connection',
  'Heated roof drain · north',
  'upper',
  [5.45, 3.53],
  roofZ + 0.03,
  'Heated drain',
  'Drain heating controlled using the outdoor NTC temperature sensor.',
  'roof',
)
point(
  'roof-drain-south',
  'connection',
  'Heated roof drain · south',
  'upper',
  [5.45, 5.16],
  roofZ + 0.03,
  'Heated drain',
  'Drain heating controlled using the outdoor NTC temperature sensor.',
  'roof',
)
point(
  'roof-antenna',
  'tv',
  'Roof antenna system',
  'upper',
  [0.95, 7.35],
  roofZ + 0.5,
  'Antenna system',
  'Final position and orientation to be set by the installer.',
  'roof',
)
point(
  'roof-rod-north',
  'earth',
  'Lightning air terminal · north',
  'upper',
  [0.85, 0.85],
  roofZ + 1.0,
  'JT 2.0 · 2 m air terminal',
  'Two-metre rod above the roof, within the lightning protection system.',
  'roof',
)
point(
  'roof-rod-south',
  'earth',
  'Lightning air terminal · south',
  'upper',
  [0.85, 8.65],
  roofZ + 1.0,
  'JT 2.0 · 2 m air terminal',
  'Two-metre rod above the roof, within the lightning protection system.',
  'roof',
)
point(
  'earth-test-1',
  'earth',
  'Lightning test clamp 1',
  'ground',
  [0.22, 9.5],
  1.65,
  'Test clamp / protective angle',
  'Approximately 2 m above surrounding ground; connects to the foundation earth.',
  'outside',
)
point(
  'earth-test-2',
  'earth',
  'Lightning test clamp 2',
  'ground',
  [6.25, 0.0],
  1.65,
  'Test clamp / protective angle',
  'Approximately 2 m above surrounding ground; connects to the foundation earth.',
  'outside',
)

export const ELECTRICAL_DEVICES: Device[] = items

/** Only routes actually drawn: no invented room-to-room power, TV or Ethernet cable runs. */
export type ElectricalRoute = {
  id: string
  name: string
  kind: 'power' | 'data' | 'earth'
  area: 'outside' | 'roof' | 'inside'
  points: [number, number, number][]
  notes: string
}
export const ELECTRICAL_ROUTES: ElectricalRoute[] = [
  {
    id: 'power-feed',
    name: 'Underground electricity supply',
    kind: 'power',
    area: 'outside',
    points: [
      [5.7, -0.35, 15.04],
      [5.7, -0.35, 10.28],
      [0.62, -0.35, 10.28],
      [0.62, -0.35, 9.15],
      [0.62, 1.5, 9.15],
    ],
    notes:
      '2 × Ø63 mm foundation ducts for power and MET earthing. Drawing requires 1000 mm cover beneath parking; the displayed line is schematic.',
  },
  {
    id: 'fibre-feed',
    name: 'Fibre / communications ducts',
    kind: 'data',
    area: 'outside',
    points: [
      [5.5, -0.35, 15.32],
      [5.5, -0.35, 10.48],
      [0.43, -0.35, 10.48],
      [0.43, -0.35, 7.02],
      [0.22, 1.5, 7.02],
    ],
    notes:
      '3 × Ø63 mm foundation communications ducts; 3 × HDPE Ø40 mm beneath parking. Local fibre connection runs to SLA; coordinate with the network provider.',
  },
  {
    id: 'data-riser',
    name: 'Low-voltage riser',
    kind: 'data',
    area: 'inside',
    points: [
      [0.22, 1.5, 7.02],
      [0.22, 2.65, 7.02],
      [0.22, 4.11, 6.9],
    ],
    notes: 'Riser symbols on the floor drawings; intermediate routing is schematic.',
  },
  {
    id: 'power-riser',
    name: 'Power riser',
    kind: 'power',
    area: 'inside',
    points: [
      [0.55, 1.5, 9.15],
      [0.22, 2.65, 9.15],
      [0.22, 4.11, 9.15],
    ],
    notes: 'Riser symbols on the floor drawings; intermediate routing is schematic.',
  },
  {
    id: 'lightning-ring',
    name: 'Roof lightning conductor',
    kind: 'earth',
    area: 'roof',
    points: [
      [0.22, ROOF_LEVEL + 0.52, 0.17],
      [6.25, ROOF_LEVEL + 0.52, 0.17],
      [6.25, ROOF_LEVEL + 0.52, 9.33],
      [0.22, ROOF_LEVEL + 0.52, 9.33],
      [0.22, ROOF_LEVEL + 0.52, 0.17],
    ],
    notes:
      'AlMgSi Ø8 mm roof conductor; connects to the adjacent building’s lightning protection. Adjacent-house conductors are not traced as this house’s equipment.',
  },
  ...[0.85, 8.65].map((y, i): ElectricalRoute => ({
    id: `air-terminal-${i}`,
    name: `Air terminal ${i + 1}`,
    kind: 'earth',
    area: 'roof',
    points: [
      [0.22, ROOF_LEVEL + 0.52, y < 1 ? 0.17 : 9.33],
      [0.85, ROOF_LEVEL + 0.02, y],
      [0.85, ROOF_LEVEL + 2, y],
    ],
    notes: 'JT 2.0 air terminal, 2 m high.',
  })),
  ...[
    [0.22, 9.5],
    [6.25, 0.0],
  ].map(([x, y], i): ElectricalRoute => ({
    id: `down-conductor-${i + 1}`,
    name: `Lightning down conductor ${i + 1}`,
    kind: 'earth',
    area: 'outside',
    points: [
      [x, ROOF_LEVEL + 0.52, i === 0 ? 9.33 : 0.17],
      [x, 1.65, y],
      [x, -0.5, y],
    ],
    notes:
      'Exposed AlMgSi Ø8 mm down conductor, test clamp around 2 m above ground, FeZn Ø10 mm earth tail to FeZn 4 × 30 mm foundation earth strip.',
  })),
]
