// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOST_ID, placeHost } from '../src/google/detector';
import { collectSources, safeSourceUrl } from '../src/google/sources';
import { searchQuery } from '../src/shared/google';

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

describe('search interface placement', () => {
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
