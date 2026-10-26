import styles from './view.css';
import type { GenerationStats, Model, Settings, Source } from '../shared/types';
import { HOST_ID } from '../google/detector';
import { AnswerRenderer } from './answer-renderer';
const SPARK =
  '<svg class="spark" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M14 2c1.7 8 4 10.3 12 12-8 1.7-10.3 4-12 12C12.3 18 10 15.7 2 14 10 12.3 12.3 10 14 2Z"/><path d="M26 1c.7 3.3 1.7 4.3 5 5-3.3.7-4.3 1.7-5 5-.7-3.3-1.7-4.3-5-5 3.3-.7 4.3-1.7 5-5Z"/></svg>';
const GEAR =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m9.4 3-.7 2.2-2 .9-2.1-.5-2 3.5L4 10.7v2.5l-1.4 1.6 2 3.5 2.2-.5 1.9.9.7 2.3h4.1l.7-2.3 2-.9 2.1.5 2-3.5-1.4-1.6v-2.5l1.4-1.6-2-3.5-2.2.5-1.9-.9-.7-2.2Z"/><circle cx="11.5" cy="12" r="3.2"/></svg>';
export interface ViewActions {
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
  private frame = 0;
  private queuedText = '';
  private answer: AnswerRenderer;
  constructor(actions: ViewActions) {
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.shadow = this.host.attachShadow({ mode: 'open' });
    // This template is constant. All search, model, and generated text uses textContent.
    this.shadow.innerHTML = `<style>${styles}</style>
      <div class="toolbar"><div class="brand">${SPARK}<span>Local Overview</span></div><div class="model-row"><label class="sr-only" for="lo-model">Model</label><select id="lo-model" aria-label="Ollama model"><option value="">Select a local model</option></select><button class="settings refresh" aria-label="Refresh installed models" title="Refresh models">↻</button></div><button class="settings" aria-label="Open Local Overview settings" title="Settings">${GEAR}</button></div>
      <section class="card" aria-label="Local AI answer"><span class="status sr-only" role="status">Ready to connect</span>
      <div class="body"><div class="empty"><p class="empty-text">Generate a local answer to this search.</p></div><div class="skeleton" aria-hidden="true" hidden><i></i><i></i><i></i></div><div class="answer" dir="auto"></div><div class="notice" hidden role="status"></div><details class="sources" hidden open><summary>Search context</summary><div class="source-grid"></div></details><details class="stats" hidden><summary>Generation statistics</summary><dl></dl></details></div>
      <footer class="foot"><div class="actions"><button class="button primary generate">Generate overview</button><button class="button stop" hidden>Stop generating</button><button class="button copy" hidden>Copy response</button></div><span class="local-label">Powered by local Ollama</span></footer><p class="grounding" data-grounded="false"></p></section><span class="sr-only announcement" aria-live="polite"></span>`;
    this.answer = new AnswerRenderer(this.el('.answer'));
    this.el<HTMLButtonElement>('.toolbar > .settings').addEventListener('click', actions.settings);
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
  connection(text: string, online = false): void {
    this.el('.status').textContent = text === 'Ollama connected' ? 'Local model ready.' : text;
    this.host.dataset.online = String(online);
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
    this.answer.setSources(sources);
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
    this.queuedText = '';
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.answer.reset();
    this.host.dataset.busy = 'true';
    this.el('.empty').hidden = true;
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
    this.queuedText += text;
    if (!this.frame)
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.flushAnswer();
      });
  }
  private flushAnswer(): void {
    if (this.queuedText) this.answer.append(this.queuedText);
    this.queuedText = '';
    this.el('.skeleton').hidden = !!this.el('.answer').textContent?.trim();
  }
  finish(stats?: GenerationStats, showStats = false): void {
    this.host.dataset.busy = 'false';
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.flushAnswer();
    this.answer.finish();
    this.el('.skeleton').hidden = true;
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
    this.queuedText = '';
    this.answer.reset();
    this.answer.setSources([]);
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
