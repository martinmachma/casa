# Electrical plan

Traced on 2026-11-01 from `A22_NJ6A_RD_C1_dsp_elektro_1.jpg` through `_4.jpg` in this folder:

- Sheet 1: strong-current and low-voltage symbol legends and installation notes.
- Sheet 2: ground floor, terrace, entrance, utility pillar and underground service provisions.
- Sheet 3: upper floor.
- Sheet 4: roof, heated drains, antenna and lightning protection.

Casa contains 135 fixed points: 54 inside the ground floor, 63 inside the upper floor and 18 exterior/roof
points. These include individual power sockets, four TV outlets and four double RJ45 outlets (eight RJ45
ports), appliance supplies, switches and timer buttons, smart lights, smoke/PIR/temperature
sensors, fans, doorbells, distribution boards, bonding and lightning protection equipment.

Open **Planning → Electrical plan** (the cable button). Pick a marker or an entry in the room inventory to
see its symbol, source sheet and notes. Choose **Outside** for the utility connections and roof. These are
built-in points shared by every saved version; choosing them does not edit furniture or create a draft.
The 17 lighting positions are smart lights using the same on/off, brightness and colour controls as lights
added from the Devices palette. They appear in their rooms and lighting scenes. The old passive lighting
markers have been replaced, preserving their positions and source IDs. Ceiling lights emit downward; wall
lights emit in front of their wall face. Other electrical connections remain passive.

On 2026-11-02, the 11 older, manually placed lights were removed in a new live version named
**Electrical plan lights only**. The previous version remains in the history. Manually added lights are
listed separately under **Additional lights**, marked **Outside electrical plan**, so they can be inspected
and removed without touching the 17 plan lights.

## Placement and routes

The drawings show schematic positions, not dimensioned installation coordinates. Points are projected onto
the corresponding faces of Casa's existing architectural walls, avoiding doors and windows at their mounting
height. The microwave socket uses the kitchen shaft face and the bedroom doorway controls use the structural
projection beside the door. The entrance light sits above the architectural entrance door. The existing
architectural geometry is retained where the electrical plan differs.

The under-stair storage fixture uses the wall-light symbol (cross with a mounting bar), on the storage
face of the kitchen partition. It is mounted beneath the upper stair flight at an indicative 1.8 m;
the electrical drawing does not specify its height.

The plan note assumes sockets 250 mm and switches 1100 mm above the floor. Other heights are indicative,
including appliance connections, wall lighting, panels, fans and sensors. Kitchen positions/heights must be
coordinated with the final cabinets and appliance design. Model dimensions of electrical accessories are
illustrative, not specified products.

The dashed service, power/low-voltage riser and down-conductor lines are hidden from the scene. Their source
routes and notes remain in the electrical inventory. Roof lightning conductors remain visible as solid lines
in the exterior electrical view. Foundation duct quantities, the 1000 mm cover requirement beneath parking,
fibre provision and earth conductor specifications are retained in the inventory notes. Intermediate riser
paths and service depths are not installation measurements. Internal Ethernet, coaxial and room circuit
cable paths are not drawn in the source and are not invented. Neighbouring air terminals are not counted
as this house's equipment.

## Heating shown in the drawings

The bathroom has a protected socket labelled **žebřík**, the towel rail. Sheet 1 notes provision for an
electric towel rail heating element depending on the rail actually installed. The boiler room has sockets
for the gas boiler and hot-water circulation pump. Sheet 4 marks two heated roof drains, with an outside NTC
temperature sensor on sheet 2. The note requires coordination of boiler, temperature sensors and room
thermostats with the heating supplier; unlocated thermostat points have not been fabricated.

The architectural background also sketches panel radiators beneath windows, including in the upstairs
bedrooms. Heater positions can therefore be read from the drawing, but radiator sizes, heating pipework and
underfloor heating loops are not specified.

Casa models the six panel radiators shown in that background: two in the living/dining room (by the terrace
glazing and beneath the front window), one on the hall's entrance wall beside the window, and one beneath
the window in each upstairs bedroom. A ladder towel rail sits on the bathroom's west wall at the marked
**žebřík** position. These are permanent fixtures visible in every version and with electrical mode off.

Positions and approximate widths follow sheets 2 and 3. Panel widths are 1.2 m (dining), 2 m (living),
0.7 m (hall), 1 m (Sara), 1.4 m (bedroom) and 1 m (Martin). Heights and depths are illustrative: the living
and bedroom radiators fit below the existing architectural sills, and the terrace radiator is a low panel
on feet in front of the full-height glazing. The towel rail is shown as 0.65 × 1.2 m. Models include white
ribbed panels, top grilles, valves and brackets, or ladder tubes; they do not specify heating output,
products or the heating pipe routes.

## Implementation

`src/devices/electrical.ts` contains the trace with stable IDs and source metadata. It is combined with saved
devices at read time, so existing versions and the bare house gain the infrastructure without a database
migration. Fixed points cannot be dragged or deleted. Plan lights have the app's smart-light controls;
passive sockets and cable outlets remain separate from those controls.

Physical fittings use generic models in `src/scene/DeviceModel.tsx`: vented circular smoke alarms,
grilled extractor fans, PIR lenses, outdoor sensor housings, switches and timer buttons, Czech-style
power sockets and weatherproof covers, three-phase sockets, RJ45 and coaxial connectors, distribution
cabinets, electricity meters, doorbells, earth terminals and capped service ducts. Ceiling and wall
lights have white housings and diffusers; the roof antenna has a metal mast and elements. These are
representative forms rather than specifications of the installed products. Category colours are kept
on the electrical-plan markers. Models keep the traced positions and face out of their mounting wall
or down from the ceiling. Small details receive shadows; main housings cast them.

Core tests verify room assignment, wall mounting clear of openings, and correct room/port assignment for the
four media banks. Browser verification covers both floor plans, picking a data marker, the towel rail's
details, and the exterior inventory.
