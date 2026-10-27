/** The fly-in onto the whole house plays once per app load; skipped for reduced motion. */
export const intro = { pending: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }
