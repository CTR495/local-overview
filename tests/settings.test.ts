import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  DEFAULTS,
  getSettings,
  normalizeSettings,
  saveSettings,
  watchSettings,
} from '../src/shared/settings';
import { validateEndpoint } from '../src/shared/endpoint';

afterEach(() => vi.unstubAllGlobals());

describe('settings validation', () => {
  it('returns independent safe defaults for absent or invalid storage', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULTS);
    expect(
      normalizeSettings({
        endpoint: 'https://attacker.example',
        enabled: 'false',
        mode: 'attacker',
        temperature: Infinity,
      }),
    ).toEqual(DEFAULTS);
    const first = normalizeSettings({});
    first.model = 'changed';
    expect(DEFAULTS.model).toBe('');
  });
  it('bounds result count, temperature, and validates enums and model values', () => {
    expect(
      normalizeSettings({
        maxResults: 100,
        temperature: 30,
        theme: 'dark',
        responseLength: 'detailed',
        model: '  qwen:4b  ',
      }),
    ).toMatchObject({
      maxResults: 8,
      temperature: 2,
      theme: 'dark',
      responseLength: 'detailed',
      model: 'qwen:4b',
    });
    expect(normalizeSettings({ maxResults: -1, temperature: -1 })).toMatchObject({
      maxResults: 1,
      temperature: 0,
    });
  });
  it('keeps behavioral switches distinct', () => {
    expect(
      normalizeSettings({
        mode: 'local',
        preferredMode: 'google',
        interactionOnly: true,
        autoGenerate: false,
        autoRegenerate: true,
        rememberMode: false,
      }),
    ).toMatchObject({
      mode: 'local',
      preferredMode: 'google',
      interactionOnly: true,
      autoGenerate: false,
      autoRegenerate: true,
      rememberMode: false,
    });
  });
  it('reads persistent settings and writes only provided known keys', async () => {
    const get = vi.fn().mockResolvedValue({ model: 'local:model', mode: 'local' });
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { storage: { local: { get, set } } });
    expect(await getSettings()).toMatchObject({ model: 'local:model', mode: 'local' });
    await saveSettings({ mode: 'google' });
    expect(set).toHaveBeenCalledWith({ mode: 'google' });
    await expect(saveSettings({ endpoint: 'https://example.com' })).rejects.toThrow('loopback');
    expect(set).toHaveBeenCalledTimes(1);
  });
  it('updates listeners on local changes and supports cleanup', async () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        local: { get: vi.fn().mockResolvedValue({ theme: 'dark' }) },
        onChanged: { addListener, removeListener },
      },
    });
    const listener = vi.fn();
    const cleanup = watchSettings(listener);
    const handler = addListener.mock.calls[0][0] as (changes: object, area: string) => void;
    handler({}, 'sync');
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
    handler({}, 'local');
    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' })),
    );
    cleanup();
    expect(removeListener).toHaveBeenCalledWith(handler);
  });
});

describe('loopback endpoint validation', () => {
  it.each(['http://localhost:11434', 'http://127.0.0.1:11434/', 'https://localhost:443'])(
    'accepts %s',
    (value) => {
      expect(validateEndpoint(value)).toBe(new URL(value).origin);
    },
  );
  it.each([
    'http://example.com',
    'http://localhost.evil:11434',
    'http://127.1:11434',
    'http://2130706433:11434',
    'http://0x7f000001:11434',
    'http://user:pass@localhost:11434',
    'http://localhost:11434/path',
    'http://localhost:11434?query=1',
    'http://localhost:11434#hash',
    'http://localhost:0',
    'http://localhost:65536',
    'file:///localhost',
  ])('rejects %s', (value) => {
    expect(() => validateEndpoint(value)).toThrow();
  });
});
