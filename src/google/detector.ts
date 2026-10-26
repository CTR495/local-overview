export const HOST_ID = 'local-overview-root';
const LABEL = /^(AI overview|AI-generated overview)$/i;
const ROOTS = '#search, #rso, #main, [role="main"]';
const LINKED_HEADINGS =
  'a h1,a h2,a h3,a h4,a h5,a h6,h1 a,h2 a,h3 a,h4 a,h5 a,h6 a,a [role="heading"],[role="heading"] a';
const NON_OVERVIEW_CONTEXT = `#${HOST_ID}, a, [role="link"], button, [role="button"], form, nav, input, textarea, select, script, style, template, article, [data-text-ad], [data-ad]`;
const MAX_LABEL_NODES = 2000;
const exactLabel = (value: string | null | undefined): boolean =>
  LABEL.test(value?.replace(/\s+/g, ' ').trim() ?? '');
function standaloneLabel(element: HTMLElement): boolean {
  if (element.closest('p, li, blockquote, dd, dt, figcaption')) return false;
  // A phrase emphasized inside running prose is not a heading label.
  return (
    !element.parentElement ||
    ![...element.parentElement.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && !!node.nodeValue?.trim(),
    )
  );
}
function safePanel(element: HTMLElement): boolean {
  return (
    !element.matches(ROOTS) &&
    !element.contains(document.getElementById(HOST_ID)) &&
    !element.closest(`#${HOST_ID}`) &&
    !element.closest('a, [role="link"], form, nav, article, [data-text-ad], [data-ad]') &&
    !element.querySelector(LINKED_HEADINGS)
  );
}
function panelForLabel(label: HTMLElement): HTMLElement | null {
  if (label.closest(NON_OVERVIEW_CONTEXT)) return null;
  // An aria-labelled region may itself be the overview container.
  const ariaLabel = label.getAttribute('aria-label');
  const ariaLabelled = exactLabel(ariaLabel);
  const labelLength = (ariaLabelled ? ariaLabel : label.textContent)?.length ?? 0;
  let candidate =
    ariaLabelled && label.matches('div, section, [role="region"]') ? label : label.parentElement;
  for (let depth = 0; candidate && depth < 5; depth++, candidate = candidate.parentElement) {
    if (candidate.matches(ROOTS) || !safePanel(candidate)) break;
    // A semantic section is the strongest fallback. Otherwise require substantial body text.
    if (
      candidate.matches('section, [role="region"], [data-mcpr]') ||
      (candidate.textContent?.trim().length ?? 0) > labelLength + 100
    )
      return candidate;
  }
  return null;
}
/** Google also uses standalone span/div labels without a semantic heading. */
function plainLabels(root: ParentNode): HTMLElement[] {
  const labels = new Set<HTMLElement>();
  const walker = document.createTreeWalker(
    root as Node,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let visited = 0;
  for (
    let node = walker.nextNode();
    node && visited < MAX_LABEL_NODES;
    node = walker.nextNode(), visited++
  ) {
    if (node instanceof HTMLElement && exactLabel(node.getAttribute('aria-label')))
      labels.add(node);
    if (node.nodeType !== Node.TEXT_NODE || !exactLabel(node.nodeValue)) continue;
    const parent = node.parentElement;
    // Exact full-element text excludes a snippet that merely mentions the phrase.
    if (
      parent &&
      parent.matches('span, div') &&
      exactLabel(parent.textContent) &&
      standaloneLabel(parent)
    )
      labels.add(parent);
  }
  return [...labels];
}
/** Conservative: an unknown layout stays visible rather than hiding search results. */
export function findNativeOverviews(root: ParentNode = document): HTMLElement[] {
  if (root === document) root = findResultsRoot() ?? document.body ?? document;
  const panels = new Set<HTMLElement>();
  for (const node of root.querySelectorAll<HTMLElement>(
    '[data-attrid="SGE"], [data-attrid="ai_overview"], [data-ai-overview="true"]',
  )) {
    if (safePanel(node)) panels.add(node);
  }
  for (const heading of root.querySelectorAll<HTMLElement>('h1,h2,h3,[role="heading"]')) {
    if (!exactLabel(heading.textContent)) continue;
    const panel = panelForLabel(heading);
    if (panel) panels.add(panel);
  }
  for (const label of plainLabels(root)) {
    const panel = panelForLabel(label);
    if (panel) panels.add(panel);
  }
  return [...panels].filter(
    (panel) => ![...panels].some((other) => other !== panel && other.contains(panel)),
  );
}
export class NativeVisibility {
  private original = new Map<HTMLElement, { value: string; priority: string }>();
  hide(elements: HTMLElement[]): void {
    for (const [element] of this.original)
      if (!elements.includes(element)) this.restoreOne(element);
    for (const element of elements) {
      if (!this.original.has(element))
        this.original.set(element, {
          value: element.style.getPropertyValue('display'),
          priority: element.style.getPropertyPriority('display'),
        });
      element.style.setProperty('display', 'none', 'important');
    }
  }
  private restoreOne(element: HTMLElement): void {
    const original = this.original.get(element);
    if (original) {
      if (original.value) element.style.setProperty('display', original.value, original.priority);
      else element.style.removeProperty('display');
      this.original.delete(element);
    }
  }
  restore(): void {
    for (const element of this.original.keys()) this.restoreOne(element);
  }
}
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
