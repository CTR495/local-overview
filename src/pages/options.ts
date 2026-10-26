import { DEFAULTS, getSettings, saveSettings, watchSettings } from '../shared/settings';
import { validateEndpoint } from '../shared/endpoint';
import { requestModels } from '../shared/protocol';
import type { Model, Settings } from '../shared/types';
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
let saveId = 0;
const checkboxes = [
  'enabled',
  'autoGenerate',
  'stream',
  'grounding',
  'reducedMotion',
  'sparkle',
  'showStats',
  'interactionOnly',
  'autoRegenerate',
] as const;
const selects = ['responseLength', 'theme'] as const;
const model = element<HTMLSelectElement>('model');
const endpoint = element<HTMLInputElement>('endpoint');

function render(next: Settings): void {
  const endpointChanged = settings && next.endpoint !== settings.endpoint;
  settings = next;
  applyAppearance(settings);
  for (const key of checkboxes) element<HTMLInputElement>(key).checked = settings[key];
  for (const key of selects) element<HTMLSelectElement>(key).value = settings[key];
  if (document.activeElement !== endpoint) endpoint.value = settings.endpoint;
  for (const key of ['maxResults', 'temperature'] as const) {
    const field = element<HTMLInputElement>(key);
    if (document.activeElement !== field)
      field.value = settings[key] === null ? '' : String(settings[key]);
  }
  element<HTMLInputElement>('maxResults').disabled = !settings.grounding;
  renderModelOptions(model, models, settings.model);
  if (endpointChanged) void refresh();
}
async function persist(patch: Partial<Settings>): Promise<boolean> {
  const id = ++saveId;
  try {
    await saveSettings(patch);
    if (id === saveId) {
      element('save-status').textContent = 'Saved. Changes are applied to your open search tabs.';
      element('save-status').classList.remove('error-text');
    }
    return true;
  } catch (error) {
    if (id === saveId) {
      element('save-status').textContent = describeError(error);
      element('save-status').classList.add('error-text');
    }
    return false;
  }
}
async function refresh(): Promise<void> {
  const id = ++refreshId;
  connectionState('loading');
  const retry = element<HTMLButtonElement>('refresh');
  retry.disabled = true;
  try {
    const received = await requestModels();
    if (id !== refreshId) return;
    models = received;
    renderModelOptions(model, models, settings.model);
    connectionState(
      models.length ? 'online' : 'empty',
      models.length
        ? `${models.length} local model${models.length === 1 ? '' : 's'} available. ${settings.endpoint}`
        : undefined,
    );
  } catch (error) {
    if (id !== refreshId) return;
    models = [];
    renderModelOptions(model, [], settings.model);
    connectionState('error', describeError(error));
  } finally {
    if (id === refreshId) retry.disabled = false;
  }
}
async function connect(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const button = element<HTMLButtonElement>('connect');
  button.disabled = true;
  try {
    const valid = validateEndpoint(endpoint.value);
    const changed = settings.endpoint !== valid;
    if (await persist({ endpoint: valid, ...(changed ? { model: '' } : {}) })) {
      endpoint.value = valid;
      // onChanged refreshes a changed endpoint; also retry an unchanged endpoint.
      if (!changed) await refresh();
    }
  } catch (error) {
    element('save-status').textContent = describeError(error);
    element('save-status').classList.add('error-text');
    endpoint.focus();
  } finally {
    button.disabled = false;
  }
}
async function init(): Promise<void> {
  setVersion();
  render(await getSettings());
  watchSettings(render);
  element<HTMLInputElement>('extension-origin').value = chrome.runtime
    .getURL('')
    .replace(/\/$/, '');
  for (const key of checkboxes)
    element<HTMLInputElement>(key).addEventListener(
      'change',
      (event) => void persist({ [key]: (event.target as HTMLInputElement).checked }),
    );
  for (const key of selects)
    element<HTMLSelectElement>(key).addEventListener(
      'change',
      (event) => void persist({ [key]: (event.target as HTMLSelectElement).value }),
    );
  model.addEventListener('change', () => void persist({ model: model.value }));
  for (const key of ['maxResults', 'temperature'] as const)
    element<HTMLInputElement>(key).addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }
      if (key === 'maxResults' && !input.value) {
        input.value = String(settings.maxResults);
        return;
      }
      void persist({ [key]: input.value === '' ? null : input.valueAsNumber });
    });
  element<HTMLFormElement>('endpoint-form').addEventListener(
    'submit',
    (event) => void connect(event),
  );
  element('refresh').addEventListener('click', () => void refresh());
  element('restore').addEventListener('click', async () => {
    if (await persist({ ...DEFAULTS })) {
      render(await getSettings());
      await refresh();
    }
  });
  element('copy-origin').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(element<HTMLInputElement>('extension-origin').value);
      element('copy-origin').textContent = 'Copied';
    } catch {
      element<HTMLInputElement>('extension-origin').select();
      element('save-status').textContent = 'Select and copy the extension origin shown below.';
    }
  });
  void refresh();
}
void init().catch((error) => {
  element('save-status').textContent = describeError(error);
  element('save-status').classList.add('error-text');
});
