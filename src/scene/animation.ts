/** Progress over elapsed milliseconds; the caller starts the clock on the first active frame after idle. */
export const animationProgress = (started: number, now: number, seconds: number) =>
  Math.min(1, Math.max(0, (now - started) / (seconds * 1000)))
