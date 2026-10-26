import type { Model, Settings } from '../shared/types';

export function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing page element: ${id}`);
  return node as T;
}
export function applyAppearance(settings: Settings): void {
  document.documentElement.dataset.theme = settings.theme;
  document.body.dataset.reducedMotion = String(settings.reducedMotion);
}
export function describeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The connection was interrupted. Start Ollama, then click Retry.';
}
export function renderModelOptions(
  select: HTMLSelectElement,
  models: Model[],
  selected: string,
): void {
  const options: HTMLOptionElement[] = [];
  options.push(
    new Option(models.length ? 'Automatic · first local model' : 'No local models found', ''),
  );
  for (const model of models) options.push(new Option(model.name, model.name));
  if (selected && !models.some((model) => model.name === selected))
    options.push(new Option(`${selected} · unavailable`, selected));
  select.replaceChildren(...options);
  select.value = selected;
  select.disabled = !models.length && !selected;
}
export function connectionState(
  state: 'loading' | 'online' | 'empty' | 'error',
  detail?: string,
): void {
  const titles = {
    loading: 'Checking Ollama…',
    online: 'Ollama is connected',
    empty: 'No local models installed',
    error: 'Ollama is unavailable',
  };
  element('connection-title').textContent = titles[state];
  element('status-dot').className =
    `status-dot ${state === 'online' ? 'online' : state === 'error' || state === 'empty' ? 'error' : ''}`;
  element('connection-detail').textContent =
    detail ??
    {
      loading: 'Connecting to your local instance.',
      online: 'Ready to generate on your computer.',
      empty: 'Download a local chat model with ollama pull, then click Retry.',
      error: 'Start Ollama on your computer, then click Retry.',
    }[state];
}
export function setVersion(popup = false): void {
  const version = chrome.runtime.getManifest().version;
  element('version').textContent = popup ? `VERSION ${version} · LOCAL AI` : `VERSION ${version}`;
  const footer = document.getElementById('footer-version');
  if (footer) footer.textContent = `Version ${version}`;
}
