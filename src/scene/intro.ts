/** The fly-in plays once per app load: the whole house from overhead, landing on the 1st floor. */
export const intro = { pending: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }
