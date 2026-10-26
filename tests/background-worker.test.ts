import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS } from '../src/shared/settings';
import { PORT_NAME } from '../src/shared/protocol';
import type { Settings } from '../src/shared/types';

type Callback = (...args: any[]) => any; // Chrome events deliberately have varied callback signatures.
function event() {
  const listeners = new Set<Callback>();
  return {
    addListener: (fn: Callback) => listeners.add(fn),
    removeListener: (fn: Callback) => listeners.delete(fn),
    emit: (...args: unknown[]) => [...listeners].map((fn) => fn(...args)),
    listeners,
  };
}
const extensionId = 'abcdefghijklmnop';
const sender = { id: extensionId, frameId: 0, url: 'https://www.google.com/search?q=test' };
const generate = (id: string) => ({ type: 'generate', id, input: { query: 'test', sources: [] } });
const tags = () => new Response(JSON.stringify({ models: [{ name: 'model:local' }] }));
const answer = (text = 'Answer') =>
  new Response(JSON.stringify({ message: { content: text }, done: true, eval_count: 4 }) + '\n');

describe('background generation lifecycle', () => {
  let settings: Settings;
  let runtime: {
    id: string;
    onMessage: ReturnType<typeof event>;
    onConnect: ReturnType<typeof event>;
    openOptionsPage: ReturnType<typeof vi.fn>;
  };
  let storage: { local: { get: ReturnType<typeof vi.fn> }; onChanged: ReturnType<typeof event> };
  let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
  function port() {
    const result = {
      name: PORT_NAME,
      sender,
      onMessage: event(),
      onDisconnect: event(),
      postMessage: vi.fn(),
      disconnect: vi.fn(),
    };
    runtime.onConnect.emit(result);
    return result;
  }
  beforeEach(async () => {
    vi.resetModules();
    settings = { ...DEFAULTS, model: 'model:local' };
    runtime = {
      id: extensionId,
      onMessage: event(),
      onConnect: event(),
      openOptionsPage: vi.fn().mockResolvedValue(undefined),
    };
    storage = { local: { get: vi.fn(async () => ({ ...settings })) }, onChanged: event() };
    fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) => (String(url).endsWith('/api/tags') ? tags() : answer()));
    vi.stubGlobal('chrome', { runtime, storage });
    vi.stubGlobal('fetch', fetcher);
    await import('../src/background/index');
  });
  afterEach(() => vi.unstubAllGlobals());
  it('lists models through a validated one-shot request', async () => {
    const reply = vi.fn();
    runtime.onMessage.emit({ type: 'models' }, sender, reply);
    await vi.waitFor(() =>
      expect(reply).toHaveBeenCalledWith({ ok: true, models: [{ name: 'model:local' }] }),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects unauthorized senders before any HTTP access', () => {
    const reply = vi.fn();
    runtime.onMessage.emit({ type: 'models' }, { ...sender, id: 'other' }, reply);
    const result = {
      name: PORT_NAME,
      sender: { ...sender, url: 'https://evil.test/' },
      disconnect: vi.fn(),
    };
    runtime.onConnect.emit(result);
    expect(result.disconnect).toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('loads current settings and streams a completion with actual stats', async () => {
    const result = port();
    result.onMessage.emit(generate('one'));
    await vi.waitFor(() =>
      expect(result.postMessage).toHaveBeenCalledWith({
        type: 'done',
        id: 'one',
        stats: { model: 'model:local', eval_count: 4 },
      }),
    );
    expect(result.postMessage).toHaveBeenCalledWith({ type: 'delta', id: 'one', text: 'Answer' });
    settings.model = '';
    result.onMessage.emit(generate('two'));
    await vi.waitFor(() =>
      expect(result.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'done', id: 'two' }),
      ),
    );
    expect(storage.local.get).toHaveBeenCalledTimes(2);
  });
  it('does not issue chat requests when disabled, empty, missing or cloud models', async () => {
    for (const [kind, code] of [
      ['disabled', 'disabled'],
      ['empty', 'no-models'],
      ['missing', 'model-unavailable'],
      ['cloud', 'no-models'],
    ] as const) {
      const result = port();
      settings.enabled = kind !== 'disabled';
      settings.model = kind === 'missing' ? 'missing' : 'model:local';
      fetcher.mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              models:
                kind === 'empty'
                  ? []
                  : kind === 'cloud'
                    ? [{ name: 'alias', remote_host: 'https://ollama.com' }]
                    : [{ name: 'model:local' }],
            }),
          ),
      );
      const before = fetcher.mock.calls.length;
      result.onMessage.emit(generate(kind));
      await vi.waitFor(() =>
        expect(result.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            id: kind,
            error: expect.objectContaining({ code }),
          }),
        ),
      );
      expect(
        fetcher.mock.calls.slice(before).every(([url]) => String(url).endsWith('/api/tags')),
      ).toBe(true);
      result.onDisconnect.emit();
    }
  });
  it('reports Ollama offline without issuing an untrusted fallback request', async () => {
    fetcher.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = port();
    result.onMessage.emit(generate('offline'));
    await vi.waitFor(() =>
      expect(result.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: expect.objectContaining({ code: 'offline' }),
        }),
      ),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('aborts requests on cancel, disconnect and network-affecting settings changes', async () => {
    for (const reason of ['cancel', 'disconnect', 'settings']) {
      let requestSignal: AbortSignal | null | undefined;
      fetcher.mockImplementation(async (url, init) => {
        if (String(url).endsWith('/api/tags')) return tags();
        requestSignal = init?.signal;
        return new Promise((_resolve, reject) =>
          requestSignal?.addEventListener('abort', () => reject(requestSignal?.reason)),
        );
      });
      const result = port();
      result.onMessage.emit(generate(reason));
      await vi.waitFor(() => expect(requestSignal).toBeTruthy());
      if (reason === 'cancel') result.onMessage.emit({ type: 'cancel', id: reason });
      else if (reason === 'disconnect') result.onDisconnect.emit();
      else storage.onChanged.emit({ enabled: { newValue: false } }, 'local');
      expect(requestSignal?.aborted).toBe(true);
      expect(
        result.postMessage.mock.calls.some(
          ([value]) => value.type === 'done' || value.type === 'delta',
        ),
      ).toBe(false);
      if (reason !== 'disconnect')
        expect(result.postMessage).toHaveBeenCalledWith({ type: 'cancelled', id: reason });
      result.onDisconnect.emit();
    }
    expect(storage.onChanged.listeners.size).toBe(0);
  });
  it('suppresses stale answers after a newer query replaces a request', async () => {
    let finishFirst!: (response: Response) => void;
    let chats = 0;
    fetcher.mockImplementation(async (url) => {
      if (String(url).endsWith('/api/tags')) return tags();
      chats++;
      if (chats === 1)
        return new Promise((resolve) => {
          finishFirst = resolve;
        });
      return answer('New query answer');
    });
    const result = port();
    result.onMessage.emit(generate('old'));
    await vi.waitFor(() => expect(chats).toBe(1));
    result.onMessage.emit(generate('new'));
    await vi.waitFor(() =>
      expect(result.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'done', id: 'new' }),
      ),
    );
    finishFirst(answer('Stale answer'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(result.postMessage.mock.calls.some(([value]) => value.id === 'old')).toBe(false);
    result.onDisconnect.emit();
  });
  it('responds to heartbeats and rejects invalid protocol messages', () => {
    const result = port();
    result.onMessage.emit({ type: 'ping' });
    expect(result.postMessage).toHaveBeenCalledWith({ type: 'pong' });
    result.onMessage.emit({ type: 'fetch', url: 'https://evil.test' });
    expect(result.disconnect).toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    result.onDisconnect.emit();
  });
});
