/** Frames an orbit's target above a bottom card, scaling close-ups to fit short viewports. */
export const focusFraming = ({ width, height }: { width: number; height: number }, bottomInset: number) => {
  const inset = Math.max(0, Math.min(bottomInset, height - 1))
  const visible = height - inset
  return {
    zoom: Math.min(1, visible / Math.min(width, height)),
    view: {
      enabled: inset > 0,
      fullWidth: width,
      fullHeight: height,
      offsetX: 0,
      offsetY: inset / 2,
      width,
      height,
    },
  }
}
