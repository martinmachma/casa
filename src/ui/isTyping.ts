export const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)
