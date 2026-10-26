// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewView } from '../src/content/view';
import { DEFAULTS } from '../src/shared/settings';
import type { Source } from '../src/shared/types';

const sources: Source[] = [
  {
    id: 1,
    title: 'Public science source',
    url: 'https://example.org/science',
    snippet: 'A public excerpt.',
  },
];
let views: OverviewView[];
let writeText: ReturnType<typeof vi.fn>;
function createView(): OverviewView {
  const view = new OverviewView({
    generate: vi.fn(),
    stop: vi.fn(),
    settings: vi.fn(),
    model: vi.fn(),
    refresh: vi.fn(),
  });
  view.settings({ ...DEFAULTS }, false);
  document.body.append(view.host);
  views.push(view);
  return view;
}
function answer(view: OverviewView): HTMLElement {
  return view.shadow.querySelector<HTMLElement>('.answer')!;
}
function flush(): void {
  vi.advanceTimersByTime(20);
}

beforeEach(() => {
  vi.useFakeTimers();
  views = [];
  writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => clearTimeout(handle));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(() => {
  views.forEach((view) => view.destroy());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('overview presentation', () => {
  it('shows one original heading and keeps connection updates out of the visible answer header', () => {
    const view = createView();
    expect(view.shadow.querySelector('.brand')?.textContent).toBe('Local Overview');
    expect(view.shadow.querySelector('.eyebrow')).toBeNull();
    view.connection('Ollama connected', true);
    const status = view.shadow.querySelector<HTMLElement>('.status');
    expect(status?.textContent).toBe('Local model ready.');
    expect(status?.closest('.sr-only')).not.toBeNull();
  });

  it('preserves revealed text nodes as later chunks and completion arrive', () => {
    const view = createView();
    view.start();
    view.delta('A clear answer ');
    flush();
    const firstReveal = answer(view).querySelector('.answer-reveal');
    expect(firstReveal).not.toBeNull();
    view.delta('continues naturally.');
    flush();
    expect(answer(view).querySelector('.answer-reveal')).toBe(firstReveal);
    expect(firstReveal?.isConnected).toBe(true);
    view.finish();
    expect(answer(view).querySelector('.answer-reveal')).toBe(firstReveal);
    expect(answer(view).textContent).toBe('A clear answer continues naturally.');
  });

  it('keeps loading visible until formatting markers produce actual answer text', () => {
    const view = createView();
    const skeleton = view.shadow.querySelector<HTMLElement>('.skeleton')!;
    view.start();
    view.delta('**');
    flush();
    expect(skeleton.hidden).toBe(false);
    expect(answer(view).textContent).toBe('');
    view.delta('A direct answer');
    flush();
    expect(skeleton.hidden).toBe(true);
    expect(answer(view).textContent).toBe('A direct answer');
    view.finish();
    expect(skeleton.hidden).toBe(true);
  });

  it('handles emphasis and a citation divided across streaming chunks', () => {
    const view = createView();
    view.context(sources, true);
    view.start();
    for (const chunk of [
      'The sky is *',
      '*blue',
      '** because of **Rayleigh',
      ' scattering** [',
      '1].',
    ]) {
      view.delta(chunk);
      flush();
    }
    view.finish();
    expect(
      [...answer(view).querySelectorAll('strong.emphasis')].map((node) => node.textContent),
    ).toEqual(['blue', 'Rayleigh scattering']);
    expect(answer(view).textContent).toBe('The sky is blue because of Rayleigh scattering [1].');
    expect(answer(view).querySelector('a')?.href).toBe(sources[0].url);
  });

  it('renders hostile HTML and Markdown URLs as inert text, including inside emphasis', () => {
    const view = createView();
    view.context(sources, true);
    view.start();
    view.delta(
      '**<img src=x onerror=alert(1)>** <script>alert(1)</script> [bad](javascript:alert(1)) [1] [999]',
    );
    view.finish();
    expect(answer(view).querySelectorAll('img,script,svg,iframe')).toHaveLength(0);
    expect(answer(view).querySelector('strong')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(answer(view).querySelectorAll('a')).toHaveLength(1);
    expect(answer(view).querySelector('a')?.href).toBe(sources[0].url);
    expect(answer(view).textContent).not.toContain('[999]');
  });

  it('produces the same safe answer regardless of stream record boundaries', () => {
    const text = 'A **blue sky** [1] and **Rayleigh scattering** [999].';
    for (const width of [1, 2, 3, 5, 8, 13, text.length]) {
      const view = createView();
      view.context(sources, true);
      view.start();
      for (let i = 0; i < text.length; i += width) {
        view.delta(text.slice(i, i + width));
        flush();
      }
      view.finish();
      expect(answer(view).textContent).toBe('A blue sky [1] and Rayleigh scattering .');
      expect([...answer(view).querySelectorAll('strong')].map((node) => node.textContent)).toEqual([
        'blue sky',
        'Rayleigh scattering',
      ]);
      expect(answer(view).querySelectorAll('a')).toHaveLength(1);
    }
  });

  it('copies the displayed answer without emphasis markup or unknown references', async () => {
    const view = createView();
    view.context(sources, true);
    view.start();
    view.delta('A **direct answer** [1]. [999]');
    view.finish();
    view.shadow.querySelector<HTMLButtonElement>('.copy')!.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('A direct answer [1]. ');
  });

  it('keeps cancelled incomplete emphasis readable without exposing marker syntax', () => {
    const view = createView();
    view.start();
    view.delta('A helpful **partial answer');
    flush();
    view.finish();
    expect(answer(view).textContent).toBe('A helpful partial answer');
    expect(answer(view).textContent).not.toContain('**');
  });

  it('clears prior emphasis and text for a new search or generation', () => {
    const view = createView();
    view.start();
    view.delta('The **old topic**.');
    view.finish();
    const old = answer(view).querySelector('strong');
    view.clear();
    expect(answer(view).textContent).toBe('');
    expect(old?.isConnected).toBe(false);
    view.start();
    view.delta('A **new topic**.');
    view.finish();
    expect(answer(view).textContent).toBe('A new topic.');
    expect(answer(view).querySelectorAll('strong')).toHaveLength(1);
  });

  it('retains accurate statistics alongside the simplified presentation', () => {
    const view = createView();
    view.start();
    view.delta('Answer.');
    view.finish(
      {
        model: 'local:latest',
        eval_count: 20,
        eval_duration: 2e9,
        total_duration: 3e9,
        prompt_eval_duration: 0.5e9,
      },
      true,
    );
    const stats = view.shadow.querySelector<HTMLDetailsElement>('.stats')!;
    expect(stats.hidden).toBe(false);
    expect(stats.textContent).toContain('10.0');
    expect(stats.textContent).toContain('3.00 s');
    expect(stats.textContent).toContain('0.50 s');
  });
});
