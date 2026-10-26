// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findNativeOverviews, HOST_ID, NativeVisibility, placeHost } from '../src/google/detector';
import { collectSources, safeSourceUrl } from '../src/google/sources';
import { searchQuery } from '../src/shared/google';

const native =
  '<section id="native"><h2>AI Overview</h2><p>This is the native overview, with enough explanatory text to represent the semantic answer section on a Google Search results page.</p><button>Show more</button></section>';
const result = (id: number, options = '') =>
  `<article ${options}><a href="https://example.org/result-${id}"><h3>Useful result ${id}</h3></a><p>Visible public snippet for result ${id} that gives useful factual context for the current search query.</p></article>`;

beforeEach(() => {
  document.body.replaceChildren();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('supported Google search URLs', () => {
  it.each([
    ['https://www.google.com/search?q=local+models', 'local models'],
    ['https://google.com.au/search?q=hello%20world&start=10', 'hello world'],
    ['https://www.google.com.au/search?q=web&udm=14', 'web'],
    ['https://google.com/search?q=%20trimmed%20', 'trimmed'],
  ])('extracts the query from %s', (url, query) => {
    expect(searchQuery(url)).toBe(query);
  });

  it.each([
    'https://www.google.com/search?q=photo&tbm=isch',
    'https://www.google.com/search?q=ai&udm=50',
    'https://www.google.com/search?q=photo&udm=2',
    'https://www.google.co.uk/search?q=unsupported',
    'https://www.google.com.evil.example/search?q=spoof',
    'http://www.google.com/search?q=insecure',
    'https://www.google.com/?q=homepage',
    'https://www.google.com/search?q=%20',
    'not a URL',
  ])('rejects unsupported or empty search %s', (url) => {
    expect(searchQuery(url)).toBeNull();
  });

  it('bounds exceptionally long queries', () => {
    expect(searchQuery(`https://www.google.com/search?q=${'a'.repeat(3000)}`)).toHaveLength(2000);
  });
});

describe('native overview detection and safe restoration', () => {
  it('detects a semantic overview while leaving organic results separate', () => {
    document.body.innerHTML = `<main id="search">${native}${result(1)}</main>`;
    const panels = findNativeOverviews(document.querySelector('#search')!);
    expect(panels).toEqual([document.querySelector('#native')]);
    expect(panels[0].contains(document.querySelector('article'))).toBe(false);
  });

  it('detects delayed content without requiring a native panel at first render', () => {
    document.body.innerHTML = `<main id="search">${result(1)}</main>`;
    expect(findNativeOverviews()).toEqual([]);
    document.querySelector('#search')!.insertAdjacentHTML('afterbegin', native);
    expect(findNativeOverviews().map((node) => node.id)).toEqual(['native']);
  });

  it('detects known semantic data attributes without relying on CSS class names', () => {
    document.body.innerHTML =
      '<main id="search"><div id="panel" data-attrid="SGE"><p>A native answer</p></div></main>';
    expect(findNativeOverviews().map((node) => node.id)).toEqual(['panel']);
  });

  it('detects a standalone span label inside nested native controls and answer text', () => {
    document.body.innerHTML = `<main id="search"><div id="plain-native"><div><span aria-hidden="true">✦</span><span>AI Overview</span><button>About this result</button></div><p>${'A useful native overview with explanatory text. '.repeat(4)}</p><button>Show more</button></div>${result(1)}</main>`;
    expect(findNativeOverviews().map((node) => node.id)).toEqual(['plain-native']);
  });

  it('detects div labels and aria-labelled regions without proprietary CSS classes', () => {
    document.body.innerHTML =
      '<main id="search"><section id="div-native"><div> AI\n Overview </div><p>A native answer</p></section><div id="aria-native" role="region" aria-label="AI Overview"><p>Another native answer</p></div></main>';
    expect(findNativeOverviews().map((node) => node.id)).toEqual(['div-native', 'aria-native']);
  });

  it('recognizes an aria-labelled div container when it includes a substantial answer', () => {
    document.body.innerHTML = `<main id="search"><div id="aria-div-native" aria-label="AI Overview"><p>${'A native answer without a semantic heading or region. '.repeat(4)}</p></div>${result(1)}</main>`;
    expect(findNativeOverviews().map((node) => node.id)).toEqual(['aria-div-native']);
  });

  it('does not hide linked organic titles or standalone snippet labels inside a result', () => {
    document.body.innerHTML = `<main id="search"><article><a href="https://example.org"><h2><span>AI Overview</span></h2></a><section><div>AI Overview</div><p>${'An organic result snippet. '.repeat(8)}</p></section></article><div><a href="https://example.org/second"><h3>Another organic result</h3></a><div><span>AI Overview</span></div><p>${'A second public snippet. '.repeat(6)}</p></div></main>`;
    expect(findNativeOverviews()).toEqual([]);
  });

  it('does not mistake forms, navigation controls, or incidental source text for an overview', () => {
    document.body.innerHTML = `<main id="search"><nav><section><span>AI Overview</span><p>${'Other navigation text. '.repeat(8)}</p></section></nav><form><section><div aria-label="AI Overview">Form control</div></section></form><section><p>Read more about <span>AI Overview</span> and how it works.</p></section><section><button><span>AI Overview</span></button></section></main>`;
    expect(findNativeOverviews()).toEqual([]);
  });

  it('bounds plain-label traversal and scopes default scans to the results root', () => {
    document.body.innerHTML = `<section id="outside"><span>AI Overview</span><p>Outside the results root</p></section><main id="search">${'<i></i>'.repeat(2001)}<section id="too-late"><span>AI Overview</span><p>A later unknown layout</p></section></main>`;
    expect(findNativeOverviews()).toEqual([]);
    document.getElementById('too-late')!.setAttribute('data-attrid', 'SGE');
    expect(findNativeOverviews().map((node) => node.id)).toEqual(['too-late']);
  });

  it('does not hide a broad main/search root or a result titled AI Overview', () => {
    document.body.innerHTML =
      '<main id="search" data-attrid="SGE"><h2>AI Overview</h2><article><a href="https://example.org"><h3>AI Overview</h3></a><p>An organic result with that exact title.</p></article></main>';
    expect(findNativeOverviews()).toEqual([]);
  });

  it('ignores extension-owned headings and containers containing the extension', () => {
    document.body.innerHTML = `<main id="search"><section data-ai-overview="true"><div id="${HOST_ID}"><h2>AI Overview</h2></div><p>Some wrapper content</p></section></main>`;
    expect(findNativeOverviews()).toEqual([]);
  });

  it('deduplicates nested native candidates', () => {
    document.body.innerHTML =
      '<main id="search"><section id="outer" data-ai-overview="true"><div data-attrid="SGE"><h2>AI Overview</h2><p>Nested native body</p></div></section></main>';
    expect(findNativeOverviews().map((node) => node.id)).toEqual(['outer']);
  });

  it('restores the exact original inline display value and priority over repeated hides', () => {
    document.body.innerHTML = `<main id="search">${native}${result(1)}</main>`;
    const panel = document.getElementById('native')!;
    panel.style.setProperty('display', 'grid', 'important');
    const visibility = new NativeVisibility();
    visibility.hide([panel]);
    visibility.hide([panel]);
    expect(panel.style.getPropertyValue('display')).toBe('none');
    expect(panel.style.getPropertyPriority('display')).toBe('important');
    expect(document.querySelector('article')!.getAttribute('style')).toBeNull();
    expect(panel.querySelector('button')!.textContent).toBe('Show more');
    visibility.restore();
    expect(panel.style.getPropertyValue('display')).toBe('grid');
    expect(panel.style.getPropertyPriority('display')).toBe('important');
    visibility.restore();
    expect(panel.style.getPropertyValue('display')).toBe('grid');
  });

  it('removes only its display override when the original display was absent', () => {
    const panel = document.createElement('section');
    panel.style.color = 'red';
    panel.hidden = true;
    const visibility = new NativeVisibility();
    visibility.hide([panel]);
    visibility.restore();
    expect(panel.style.getPropertyValue('display')).toBe('');
    expect(panel.style.color).toBe('red');
    expect(panel.hidden).toBe(true);
  });

  it('restores candidates that disappear from a later detection set', () => {
    const a = document.createElement('section'),
      b = document.createElement('section');
    a.style.display = 'flex';
    b.style.display = 'block';
    const visibility = new NativeVisibility();
    visibility.hide([a]);
    visibility.hide([b]);
    expect(a.style.display).toBe('flex');
    expect(b.style.display).toBe('none');
    visibility.restore();
    expect(b.style.display).toBe('block');
  });

  it('positions one host ahead of results and falls back without overlaying content', () => {
    const host = document.createElement('div');
    host.id = HOST_ID;
    expect(placeHost(host)).toBe(true);
    expect(host.parentElement).toBe(document.body);
    expect(host.dataset.fallback).toBe('true');
    document.body.insertAdjacentHTML(
      'beforeend',
      '<main id="search"><article>Result</article></main>',
    );
    placeHost(host);
    placeHost(host);
    expect(document.querySelector('#search')!.firstElementChild).toBe(host);
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
    expect(host.dataset.fallback).toBeUndefined();
  });
});

describe('visible source context', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
  });

  it('collects only a limited set of visible unique organic results', () => {
    document.body.innerHTML = `<main id="search">${result(1)}${result(1)}${result(2)}${result(3)}</main>`;
    const sources = collectSources(document.querySelector('#search')!, 2);
    expect(sources.map((source) => source.url)).toEqual([
      'https://example.org/result-1',
      'https://example.org/result-2',
    ]);
    expect(sources.map((source) => source.id)).toEqual([1, 2]);
    expect(sources[0].title).toBe('Useful result 1');
  });

  it('skips hidden, aria-hidden, CSS-hidden, sponsored, and native overview results', () => {
    document.body.innerHTML = `<main id="search">${result(1, 'hidden')}${result(2, 'aria-hidden="true"')}${result(3, 'style="display:none"')}${result(4, 'style="visibility:hidden"')}${result(5, 'data-text-ad="true"')}${result(6, 'data-ai-overview="true"')}${result(7)}</main>`;
    expect(collectSources(document, 8).map((source) => source.url)).toEqual([
      'https://example.org/result-7',
    ]);
  });

  it('skips nodes with no layout rectangles', () => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue({ length: 0 } as DOMRectList);
    document.body.innerHTML = result(1);
    expect(collectSources(document, 8)).toEqual([]);
  });

  it('does not read the extension own content as search context', () => {
    document.body.innerHTML = `<div id="${HOST_ID}">${result(1)}</div>${result(2)}`;
    expect(collectSources(document, 8).map((source) => source.id)).toEqual([1]);
    expect(collectSources(document, 8)[0].url).toBe('https://example.org/result-2');
  });

  it('bounds titles and snippets and uses public text as inert data', () => {
    document.body.innerHTML = `<article><a href="https://example.org"><h3>${'t'.repeat(400)}</h3></a><p>${'s'.repeat(1400)}</p></article>`;
    const article = document.querySelector('article')!;
    Object.defineProperty(article, 'innerText', {
      configurable: true,
      value: `${'t'.repeat(400)} ${'s'.repeat(1400)}`,
    });
    const [source] = collectSources(document, 8);
    expect(source.title).toHaveLength(240);
    expect(source.snippet.length).toBeLessThanOrEqual(900);
    expect(source.url).toBe('https://example.org/');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'ftp://example.org/file',
    'https://user:password@example.org',
    'https://www.google.com/search?q=internal',
  ])('rejects unsafe or Google-internal source %s', (href) => {
    expect(safeSourceUrl(href)).toBeNull();
  });

  it('unwraps supported Google outbound links and strips fragments', () => {
    expect(
      safeSourceUrl('https://www.google.com/url?q=https%3A%2F%2Fexample.org%2Farticle%23section'),
    ).toBe('https://example.org/article');
    expect(safeSourceUrl('https://www.google.com.au/url?url=https%3A%2F%2Fexample.org%2Fau')).toBe(
      'https://example.org/au',
    );
  });
  it('rejects oversized URLs instead of citing a different truncated destination', () => {
    expect(safeSourceUrl(`https://example.org/${'x'.repeat(2100)}`)).toBeNull();
  });
});
