export const HOST_ID = 'local-overview-root';
export function findResultsRoot(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('#search') ??
    document.querySelector<HTMLElement>('#rso') ??
    document.querySelector<HTMLElement>('#main, [role="main"]')
  );
}
export function placeHost(host: HTMLElement): boolean {
  const root = findResultsRoot();
  if (!root) {
    // A compact accessible fallback that never overlays search results.
    if (!document.body) return false;
    host.dataset.fallback = 'true';
    if (host.parentElement !== document.body) document.body.append(host);
    return true;
  }
  delete host.dataset.fallback;
  if (!root.contains(host)) root.prepend(host);
  return true;
}
