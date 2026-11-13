/** Polite screen-reader announcements through one live region (#announcer). */
export function announce(message: string) {
  const el = typeof document !== 'undefined' ? document.getElementById('announcer') : null;
  if (!el) return;
  el.textContent = '';
  window.setTimeout(() => (el.textContent = message), 30);
}
