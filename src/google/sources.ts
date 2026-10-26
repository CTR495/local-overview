import type { Source } from '../shared/types';
import { HOST_ID } from './detector';

export function safeSourceUrl(href: string): string | null {
  try {
    const url = new URL(href, location.href);
    if (
      (url.hostname === 'www.google.com' || url.hostname === 'www.google.com.au') &&
      url.pathname === '/url'
    ) {
      const target = url.searchParams.get('q') || url.searchParams.get('url');
      return target ? safeSourceUrl(target) : null;
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      /(^|\.)google\.(com|com\.au)$/.test(url.hostname)
    )
      return null;
    url.hash = '';
    return url.href.length <= 2000 ? url.href : null;
  } catch {
    return null;
  }
}
function visible(node: HTMLElement): boolean {
  for (let el: HTMLElement | null = node; el; el = el.parentElement) {
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return node.getClientRects().length > 0;
}
export function collectSources(root: ParentNode, limit: number): Source[] {
  const sources: Source[] = [],
    seen = new Set<string>();
  for (const heading of root.querySelectorAll<HTMLElement>('h3')) {
    if (sources.length >= limit) break;
    if (
      heading.closest(
        `#${HOST_ID}, [data-text-ad], [data-ad], [data-ai-overview], [data-attrid="SGE"], [data-attrid="ai_overview"]`,
      ) ||
      !visible(heading)
    )
      continue;
    const anchor =
      heading.closest<HTMLAnchorElement>('a[href]') ??
      heading.querySelector<HTMLAnchorElement>('a[href]');
    const url = anchor && safeSourceUrl(anchor.href);
    const title = heading.textContent?.trim().slice(0, 240);
    if (!url || !title || seen.has(url)) continue;
    let block = anchor?.parentElement;
    for (let depth = 0; block?.parentElement && depth < 4; depth++) {
      if (block.querySelectorAll('h3').length > 1 || block.id === 'rso' || block.id === 'search')
        break;
      if ((block.textContent?.trim().length ?? 0) > title.length + 90) break;
      if (block.parentElement.querySelectorAll('h3').length > 1) break;
      block = block.parentElement;
    }
    // Public DOM text only; no requests, hidden attributes, or page scripts.
    const text = block ? block.innerText : '';
    const snippet = (text || '').replace(title, '').replace(/\s+/g, ' ').trim().slice(0, 900);
    sources.push({ id: sources.length + 1, title, url, snippet });
    seen.add(url);
  }
  return sources;
}
