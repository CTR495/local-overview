import styles from './view.css';
import type { GenerationStats, Mode, Model, Settings, Source } from '../shared/types';
import { HOST_ID } from '../google/detector';
const SPARK =
  '<svg class="spark" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M14 2c1.7 8 4 10.3 12 12-8 1.7-10.3 4-12 12C12.3 18 10 15.7 2 14 10 12.3 12.3 10 14 2Z"/><path d="M26 1c.7 3.3 1.7 4.3 5 5-3.3.7-4.3 1.7-5 5-.7-3.3-1.7-4.3-5-5 3.3-.7 4.3-1.7 5-5Z"/></svg>';
const GEAR =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m9.4 3-.7 2.2-2 .9-2.1-.5-2 3.5L4 10.7v2.5l-1.4 1.6 2 3.5 2.2-.5 1.9.9.7 2.3h4.1l.7-2.3 2-.9 2.1.5 2-3.5-1.4-1.6v-2.5l1.4-1.6-2-3.5-2.2.5-1.9-.9-.7-2.2Z"/><circle cx="11.5" cy="12" r="3.2"/></svg>';
export interface ViewActions {
  mode(mode: Mode): void;
  generate(): void;
  stop(): void;
  settings(): void;
  model(name: string): void;
  refresh(): void;
}
export class OverviewView {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  private text = '';
  private sources: Source[] = [];
  private frame = 0;
  private busy = false;
  constructor(actions: ViewActions) {
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.shadow = this.host.attachShadow({ mode: 'open' });
    // This template is constant. All search, model, and generated text uses textContent.
    this.shadow.innerHTML = `<style>${styles}</style>
      <div class="toolbar"><div class="brand">${SPARK}<span>Local Overview</span><span class="badge">On your device</span></div>
      <div class="switch" role="group" aria-label="Overview provider"><button data-mode="google" aria-pressed="true">Google</button><button data-mode="local" aria-pressed="false">Local AI</button></div><button class="settings" aria-label="Open Local Overview settings" title="Settings">${GEAR}</button></div>
      <p class="google-note" role="status"></p>
      <section class="card" aria-label="Local AI Overview" hidden><header class="card-head"><div><div class="eyebrow">Local AI Overview</div><div class="connection"><span class="dot"></span><span class="status">Ready to connect</span></div></div><div class="model-row"><label for="lo-model">Model</label><select id="lo-model" aria-label="Ollama model"><option value="">Select a local model</option></select><button class="settings refresh" aria-label="Refresh installed models" title="Refresh models">↻</button></div></header>
      <div class="body"><p class="grounding" data-grounded="false"></p><div class="empty"><h2 class="empty-title">A little perspective. Locally.</h2><p class="empty-text">Turn this search into a helpful overview using a model on your computer.</p></div><div class="skeleton" aria-hidden="true" hidden><i></i><i></i><i></i></div><div class="answer" dir="auto"></div><div class="notice" hidden role="status"></div><details class="sources" hidden open><summary>Search context</summary><div class="source-grid"></div></details><details class="stats" hidden><summary>Generation statistics</summary><dl></dl></details></div>
      <footer class="foot"><div class="actions"><button class="button primary generate">Generate overview</button><button class="button stop" hidden>Stop generating</button><button class="button copy" hidden>Copy response</button></div><span class="local-label">◇ &nbsp;Powered by local Ollama</span></footer></section><span class="sr-only announcement" aria-live="polite"></span>`;
    this.shadow
      .querySelectorAll<HTMLButtonElement>('[data-mode]')
      .forEach((button) =>
        button.addEventListener('click', () => actions.mode(button.dataset.mode as Mode)),
      );
    this.el<HTMLButtonElement>('.settings').addEventListener('click', actions.settings);
    this.el<HTMLButtonElement>('.generate').addEventListener('click', actions.generate);
    this.el<HTMLButtonElement>('.stop').addEventListener('click', actions.stop);
    this.el<HTMLButtonElement>('.refresh').addEventListener('click', actions.refresh);
    this.el<HTMLSelectElement>('select').addEventListener('change', (event) =>
      actions.model((event.target as HTMLSelectElement).value),
    );
    this.el<HTMLButtonElement>('.copy').addEventListener('click', () => {
      void navigator.clipboard.writeText(this.el('.answer').textContent ?? '').then(
        () => {
          this.el('.announcement').textContent = 'Response copied.';
          this.notice('Response copied to clipboard.');
        },
        () =>
          this.notice(
            'Clipboard unavailable. Select the response text and copy it with your keyboard.',
            true,
          ),
      );
    });
  }
  private el<T extends HTMLElement = HTMLElement>(selector: string): T {
    return this.shadow.querySelector<T>(selector)!;
  }
  settings(settings: Settings, dark: boolean): void {
    this.host.dataset.theme =
      settings.theme === 'auto' ? (dark ? 'dark' : 'light') : settings.theme;
    this.host.dataset.reduced = String(settings.reducedMotion);
    this.host.dataset.sparkle = String(settings.sparkle);
    this.el('.stats').hidden = !settings.showStats || !this.el('.stats dl').childElementCount;
    if (settings.model) this.el<HTMLSelectElement>('select').value = settings.model;
  }
  mode(mode: Mode, nativeAvailable: boolean): void {
    this.shadow
      .querySelectorAll<HTMLButtonElement>('[data-mode]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.mode === mode)),
      );
    this.el('.card').hidden = mode !== 'local';
    const note = this.el('.google-note');
    note.hidden = mode === 'local';
    note.textContent = nativeAvailable
      ? 'Google’s original AI Overview is shown below.'
      : 'Google AI Overview is unavailable or has not been detected on this page. You can still use Local AI.';
  }
  connection(text: string, online = false): void {
    this.el('.status').textContent = text;
    this.el('.connection').dataset.online = String(online);
  }
  models(models: Model[], selected: string): void {
    const select = this.el<HTMLSelectElement>('select');
    select.replaceChildren();
    if (!models.length) select.add(new Option('No local models installed', ''));
    for (const model of models) select.add(new Option(model.name, model.name));
    if (selected && !models.some((model) => model.name === selected))
      select.add(new Option(`${selected} (unavailable)`, selected));
    select.value = selected || models[0]?.name || '';
  }
  context(sources: Source[], enabled: boolean): void {
    this.sources = sources;
    const label = this.el('.grounding');
    label.dataset.grounded = String(sources.length > 0);
    label.textContent = sources.length
      ? `↗ Using ${sources.length} visible search results · verify important claims`
      : enabled
        ? 'No usable search context found · using model knowledge, which may be outdated'
        : 'Model knowledge only · current search context is off';
    const section = this.el<HTMLDetailsElement>('.sources');
    section.hidden = !sources.length;
    const grid = this.el('.source-grid');
    grid.replaceChildren();
    for (const source of sources) {
      const link = document.createElement('a');
      link.className = 'source';
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.id = `lo-source-${source.id}`;
      const domain = document.createElement('small');
      domain.textContent = `[${source.id}] ${new URL(source.url).hostname}`;
      const title = document.createElement('span');
      title.textContent = source.title;
      link.append(domain, title);
      grid.append(link);
    }
  }
  start(): void {
    this.text = '';
    this.busy = true;
    this.host.dataset.busy = 'true';
    this.el('.empty').hidden = true;
    this.el('.answer').replaceChildren();
    this.el('.notice').hidden = true;
    this.el('.skeleton').hidden = false;
    this.el('.card').dataset.busy = 'true';
    this.el('.card').setAttribute('aria-busy', 'true');
    this.el('.stop').hidden = false;
    this.el('.generate').hidden = true;
    this.el('.copy').hidden = true;
    this.el('.stats').hidden = true;
    this.el('.stats dl').replaceChildren();
    this.el('.announcement').textContent = 'Generating a local overview.';
  }
  delta(text: string): void {
    this.text += text;
    if (!this.frame)
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.renderAnswer();
      });
  }
  private renderAnswer(): void {
    const answer = this.el('.answer');
    answer.replaceChildren();
    this.el('.skeleton').hidden = this.text.length > 0 || !this.busy;
    // Only source IDs supplied by the extension can become links. No Markdown/HTML URLs.
    const pattern = /\[(\d{1,3})\]/g;
    let previous = 0;
    for (const match of this.text.matchAll(pattern)) {
      answer.append(document.createTextNode(this.text.slice(previous, match.index)));
      const source = this.sources.find((item) => item.id === Number(match[1]));
      if (source) {
        const a = document.createElement('a');
        a.textContent = match[0];
        a.href = source.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', `Source ${source.id}: ${source.title}`);
        answer.append(a);
      } else answer.append(document.createTextNode(''));
      previous = match.index! + match[0].length;
    }
    answer.append(document.createTextNode(this.text.slice(previous)));
    if (this.busy && this.text) {
      const cursor = document.createElement('span');
      cursor.className = 'cursor';
      cursor.setAttribute('aria-hidden', 'true');
      answer.append(cursor);
    }
  }
  finish(stats?: GenerationStats, showStats = false): void {
    this.busy = false;
    this.host.dataset.busy = 'false';
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.renderAnswer();
    this.el('.card').dataset.busy = 'false';
    this.el('.card').setAttribute('aria-busy', 'false');
    this.el('.stop').hidden = true;
    this.el('.generate').hidden = false;
    this.el('.generate').textContent =
      !this.el('.notice').hidden && this.el('.notice').dataset.error === 'true'
        ? 'Retry'
        : this.text
          ? '↻ Regenerate'
          : 'Generate overview';
    this.el('.copy').hidden = !this.text;
    this.el('.announcement').textContent = 'Local overview generation ended.';
    if (stats) {
      const rows: [string, string][] = [['Model', stats.model]];
      if (stats.eval_count !== undefined) rows.push(['Output tokens', String(stats.eval_count)]);
      if (stats.eval_count !== undefined && stats.eval_duration && stats.eval_duration > 0)
        rows.push([
          'Tokens per second',
          (stats.eval_count / (stats.eval_duration / 1e9)).toFixed(1),
        ]);
      for (const [key, label] of [
        ['total_duration', 'Total duration'],
        ['prompt_eval_duration', 'Prompt evaluation'],
        ['eval_duration', 'Output generation'],
      ] as const)
        if (stats[key] !== undefined) rows.push([label, `${(stats[key]! / 1e9).toFixed(2)} s`]);
      const dl = this.el('.stats dl');
      dl.replaceChildren();
      for (const [label, value] of rows) {
        const dt = document.createElement('dt'),
          dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        dl.append(dt, dd);
      }
      this.el('.stats').hidden = !showStats;
    }
  }
  notice(text: string, error = false): void {
    const node = this.el('.notice');
    node.textContent = text;
    node.dataset.error = String(error);
    node.hidden = !text;
    if (error) this.el('.generate').textContent = 'Retry';
  }
  clear(): void {
    this.text = '';
    this.sources = [];
    this.finish();
    this.el('.empty').hidden = false;
    this.el('.notice').hidden = true;
    this.el('.sources').hidden = true;
    this.el('.stats').hidden = true;
    this.el('.stats dl').replaceChildren();
  }
  get hasAnswer(): boolean {
    return this.text.length > 0;
  }
  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.host.remove();
  }
}
