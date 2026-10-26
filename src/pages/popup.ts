import { getSettings, saveSettings, watchSettings } from '../shared/settings';
import { openOptions, requestModels } from '../shared/protocol';
import type { Mode, Model, Settings } from '../shared/types';
import {
  applyAppearance,
  connectionState,
  describeError,
  element,
  renderModelOptions,
  setVersion,
} from './common';

let settings: Settings;
let models: Model[] = [];
let refreshId = 0;
const select = element<HTMLSelectElement>('model');

function render(next: Settings): void {
  const endpointChanged = settings && next.endpoint !== settings.endpoint;
  settings = next;
  applyAppearance(settings);
  element<HTMLInputElement>('enabled').checked = settings.enabled;
  const mode = settings.mode;
  for (const value of ['google', 'local'] as const)
    element(`mode-${value}`).setAttribute('aria-pressed', String(mode === value));
  element('mode-detail').textContent = !settings.enabled
    ? 'Disabled. Google Search keeps its original interface.'
    : mode === 'google'
      ? 'Google’s original overview, when available.'
      : settings.interactionOnly
        ? 'Local AI is selected. Click Generate on your search.'
        : 'Answers from your locally installed Ollama model.';
  renderModelOptions(select, models, settings.model);
  if (endpointChanged) void refresh();
}
async function persist(patch: Partial<Settings>): Promise<void> {
  try {
    await saveSettings(patch);
    element('save-status').textContent = 'Saved on this device.';
  } catch (error) {
    element('save-status').textContent = describeError(error);
  }
}
async function refresh(): Promise<void> {
  const id = ++refreshId;
  connectionState('loading');
  const refreshButton = element<HTMLButtonElement>('refresh');
  refreshButton.disabled = true;
  try {
    const received = await requestModels();
    if (id !== refreshId) return;
    models = received;
    renderModelOptions(select, models, settings.model);
    connectionState(
      models.length ? 'online' : 'empty',
      models.length
        ? `${models.length} local model${models.length === 1 ? '' : 's'} available on your computer.`
        : undefined,
    );
  } catch (error) {
    if (id !== refreshId) return;
    models = [];
    renderModelOptions(select, [], settings.model);
    connectionState('error', describeError(error));
  } finally {
    if (id === refreshId) refreshButton.disabled = false;
  }
}
async function init(): Promise<void> {
  setVersion(true);
  render(await getSettings());
  watchSettings(render);
  element<HTMLInputElement>('enabled').addEventListener(
    'change',
    (event) => void persist({ enabled: (event.target as HTMLInputElement).checked }),
  );
  select.addEventListener('change', () => void persist({ model: select.value }));
  for (const mode of ['google', 'local'] as Mode[])
    element(`mode-${mode}`).addEventListener('click', () => void persist({ mode }));
  element('refresh').addEventListener('click', () => void refresh());
  element('settings').addEventListener('click', openOptions);
  void refresh();
}
void init().catch((error) => {
  element('save-status').textContent = describeError(error);
});
