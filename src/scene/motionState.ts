/** Shared with render passes that defer expensive quality changes until the view settles. */
export const motionState = { moving: false }

/**
 * The room camera's flight, eased 0 to 1, for the room's blur to follow: in over a flight into a room, and between two
 * rooms away over its first half and in over its second.
 */
export const roomFlight = { kind: 'none' as 'none' | 'enter' | 'switch', progress: 1 }

/** Flying from one room to another: a switch of floor on the way fades, as the rest of the view does. */
export const betweenRooms = () => roomFlight.kind === 'switch' && roomFlight.progress < 1
