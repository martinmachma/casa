// Furniture models: Kenney's Furniture Kit (CC0, public/models/furniture). Each model is stretched to the item's
// width × depth × height, so the sizes here are just sensible real-world defaults (centimetres).

export type CatalogGroup = 'Living' | 'Dining' | 'Kitchen' | 'Bedroom' | 'Bathroom' | 'Office' | 'Other'

export type CatalogEntry = {
  /** Model file name without .glb; stored on the item. */
  model: string
  name: string
  group: CatalogGroup
  width: number
  depth: number
  height: number
}

const entry = (model: string, name: string, group: CatalogGroup, [width, depth, height]: number[]): CatalogEntry => ({
  model,
  name,
  group,
  width,
  depth,
  height,
})

export const CATALOG: CatalogEntry[] = [
  entry('loungeSofa', 'Sofa', 'Living', [200, 90, 85]),
  entry('loungeSofaLong', 'Sofa with chaise', 'Living', [220, 160, 85]),
  entry('loungeSofaCorner', 'Corner sofa', 'Living', [250, 250, 85]),
  entry('loungeDesignSofa', 'Design sofa', 'Living', [210, 85, 80]),
  entry('loungeChair', 'Armchair', 'Living', [85, 80, 85]),
  entry('loungeSofaOttoman', 'Footstool', 'Living', [80, 80, 42]),
  entry('tableCoffee', 'Coffee table', 'Living', [110, 60, 42]),
  entry('tableCoffeeGlass', 'Glass coffee table', 'Living', [110, 60, 42]),
  entry('cabinetTelevision', 'TV unit', 'Living', [180, 45, 50]),
  entry('televisionModern', 'TV', 'Living', [145, 25, 90]),
  entry('bookcaseOpen', 'Bookcase', 'Living', [80, 35, 180]),
  entry('sideTable', 'Side table', 'Living', [60, 40, 55]),
  entry('lampRoundFloor', 'Floor lamp', 'Living', [40, 40, 160]),
  entry('rugRectangle', 'Rug', 'Living', [200, 140, 1]),
  entry('rugRound', 'Round rug', 'Living', [160, 160, 1]),
  entry('pottedPlant', 'Plant', 'Living', [50, 50, 120]),

  entry('table', 'Dining table', 'Dining', [180, 90, 75]),
  entry('tableRound', 'Round table', 'Dining', [120, 120, 75]),
  entry('chair', 'Chair', 'Dining', [45, 50, 90]),
  entry('chairCushion', 'Cushioned chair', 'Dining', [45, 50, 90]),
  entry('chairModernCushion', 'Modern chair', 'Dining', [45, 50, 85]),
  entry('stoolBar', 'Bar stool', 'Dining', [40, 40, 75]),
  entry('bench', 'Bench', 'Dining', [120, 40, 47]),

  entry('kitchenCabinet', 'Base cabinet', 'Kitchen', [60, 60, 90]),
  entry('kitchenCabinetDrawer', 'Drawer cabinet', 'Kitchen', [60, 60, 90]),
  entry('kitchenSink', 'Sink', 'Kitchen', [80, 60, 90]),
  entry('kitchenStoveElectric', 'Oven + hob', 'Kitchen', [60, 60, 90]),
  entry('kitchenFridgeLarge', 'Fridge', 'Kitchen', [70, 70, 200]),
  entry('kitchenBar', 'Breakfast bar', 'Kitchen', [120, 60, 90]),
  entry('washer', 'Washing machine', 'Kitchen', [60, 60, 85]),
  entry('dryer', 'Dryer', 'Kitchen', [60, 60, 85]),
  entry('washerDryerStacked', 'Washer + dryer', 'Kitchen', [60, 60, 170]),

  entry('bedDouble', 'Double bed', 'Bedroom', [180, 210, 60]),
  entry('bedSingle', 'Single bed', 'Bedroom', [90, 200, 60]),
  entry('cabinetBedDrawerTable', 'Nightstand', 'Bedroom', [45, 40, 50]),
  entry('bookcaseClosedWide', 'Wardrobe', 'Bedroom', [200, 60, 220]),
  entry('lampSquareTable', 'Table lamp', 'Bedroom', [25, 25, 50]),
  entry('coatRackStanding', 'Coat stand', 'Bedroom', [45, 45, 175]),

  entry('bathtub', 'Bathtub', 'Bathroom', [170, 75, 58]),
  entry('shower', 'Corner shower', 'Bathroom', [90, 90, 200]),
  entry('showerRound', 'Round shower', 'Bathroom', [90, 90, 200]),
  entry('toilet', 'Toilet', 'Bathroom', [38, 65, 80]),
  entry('bathroomSink', 'Washbasin', 'Bathroom', [60, 45, 85]),
  entry('bathroomCabinetDrawer', 'Vanity unit', 'Bathroom', [80, 46, 85]),

  entry('desk', 'Desk', 'Office', [140, 70, 75]),
  entry('deskCorner', 'Corner desk', 'Office', [160, 160, 75]),
  entry('chairDesk', 'Office chair', 'Office', [60, 60, 110]),
  entry('plantSmall1', 'Small plant', 'Other', [25, 25, 35]),
]

export const CATALOG_GROUPS: CatalogGroup[] = ['Living', 'Dining', 'Kitchen', 'Bedroom', 'Bathroom', 'Office', 'Other']

export const catalogEntry = (model: string | undefined) => CATALOG.find((e) => e.model === model)

export const modelUrl = (model: string) => `/models/furniture/${model}.glb`
export const thumbnailUrl = (model: string) => `/models/furniture/thumbs/${model}.webp`
