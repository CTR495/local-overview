import type { Settings } from './types';
import { validateEndpoint } from './endpoint';

export const DEFAULTS: Readonly<Settings> = Object.freeze({
  enabled: true,
  endpoint: 'http://localhost:11434',
  model: '',
  autoGenerate: true,
  stream: true,
  grounding: false,
  maxResults: 5,
  responseLength: 'balanced',
  temperature: null,
  theme: 'auto',
  reducedMotion: false,
  showStats: false,
  sparkle: true,
  interactionOnly: false,
  autoRegenerate: true,
});
export function normalizeSettings(value: unknown): Settings {
  const result = { ...DEFAULTS };
  if (!value || typeof value !== 'object') return result;
  const input = value as Record<string, unknown>;
  for (const key of [
    'enabled',
    'autoGenerate',
    'stream',
    'grounding',
    'reducedMotion',
    'showStats',
    'sparkle',
    'interactionOnly',
    'autoRegenerate',
  ] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
  }
  if (['auto', 'light', 'dark'].includes(String(input.theme)))
    result.theme = input.theme as Settings['theme'];
  if (['short', 'balanced', 'detailed'].includes(String(input.responseLength)))
    result.responseLength = input.responseLength as Settings['responseLength'];
  if (typeof input.endpoint === 'string') {
    try {
      result.endpoint = validateEndpoint(input.endpoint);
    } catch {
      /* retain safe default */
    }
  }
  if (typeof input.model === 'string' && input.model.length <= 200)
    result.model = input.model.trim();
  if (typeof input.maxResults === 'number' && Number.isFinite(input.maxResults))
    result.maxResults = Math.max(1, Math.min(8, Math.floor(input.maxResults)));
  if (typeof input.temperature === 'number' && Number.isFinite(input.temperature))
    result.temperature = Math.max(0, Math.min(2, input.temperature));
  return result;
}
// Separate keys keep a popup model change from overwriting an options save.
// Legacy provider-mode keys are deliberately ignored: Local Overview always adds its local panel.
export async function getSettings(): Promise<Settings> {
  return normalizeSettings(await chrome.storage.local.get(Object.keys(DEFAULTS)));
}
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  if (patch.endpoint !== undefined) validateEndpoint(patch.endpoint);
  const normalized = normalizeSettings(patch);
  const safe = Object.fromEntries(
    Object.keys(patch)
      .filter((key) => key in DEFAULTS)
      .map((key) => [key, normalized[key as keyof Settings]]),
  );
  await chrome.storage.local.set(safe);
}
export function watchSettings(listener: (settings: Settings) => void): () => void {
  const changed = (_changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local') void getSettings().then(listener);
  };
  chrome.storage.onChanged.addListener(changed);
  return () => chrome.storage.onChanged.removeListener(changed);
}
