import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaClient, isLocalModel } from '../src/ollama/client';
import { toAppError } from '../src/ollama/errors';
import { DEFAULTS } from '../src/shared/settings';

const settings = { ...DEFAULTS };
const input = { query: 'why is the sky blue?', sources: [] };
const signal = () => new AbortController().signal;
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status });
}
function stream(...records: unknown[]): Response {
  return new Response(records.map((value) => JSON.stringify(value)).join('\n'));
}
const chat = (client: OllamaClient, onText = vi.fn(), config = settings, abort = signal()) =>
  client.chat('test:latest', input, config, abort, onText);
afterEach(() => vi.useRealTimers());

describe('Ollama client', () => {
  it('calls fetch without binding it to the API client, as required by native Chrome workers', async () => {
    const fetcher: typeof fetch = async function (this: unknown) {
      expect(this).toBeUndefined();
      return json({ models: [{ name: 'local:latest' }] });
    };
    expect(await new OllamaClient(settings.endpoint, fetcher).listModels()).toEqual([
      { name: 'local:latest' },
    ]);
  });
  it('lists dynamic local models, deduplicates and excludes cloud aliases and upstreams', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        models: [
          { name: 'qwen3:4b', size: 123 },
          { name: 'llama3.2:latest' },
          { name: 'qwen3:4b' },
          { name: 'gpt-oss:120b-cloud' },
          { name: 'my-alias', remote_model: 'remote' },
          { name: 'alias2', remote_host: 'https://ollama.com' },
          null,
        ],
      }),
    );
    const result = await new OllamaClient('http://localhost:11434', fetcher).listModels();
    expect(result).toEqual([{ name: 'qwen3:4b', size: 123 }, { name: 'llama3.2:latest' }]);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        method: 'GET',
      }),
    );
  });
  it('returns an empty local list when none are installed', async () => {
    const client = new OllamaClient(
      'http://127.0.0.1:11434',
      vi.fn<typeof fetch>().mockResolvedValue(json({ models: [] })),
    );
    expect(await client.listModels()).toEqual([]);
  });
  it('streams text immediately and reads only genuine final statistics', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
        },
      }),
    );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    const client = new OllamaClient(settings.endpoint, fetcher);
    const onText = vi.fn();
    const promise = chat(client, onText);
    controller.enqueue(new TextEncoder().encode('{"message":{"content":"Blue "},"done":false}\n'));
    await vi.waitFor(() => expect(onText).toHaveBeenCalledWith('Blue '));
    controller.enqueue(
      new TextEncoder().encode(
        '{"message":{"content":"sky"},"done":true,"eval_count":2,"eval_duration":1000000000,"total_duration":2000000000,"prompt_eval_duration":100,"invented":999}\n',
      ),
    );
    controller.close();
    expect(await promise).toEqual({
      model: 'test:latest',
      eval_count: 2,
      eval_duration: 1e9,
      total_duration: 2e9,
      prompt_eval_duration: 100,
    });
    expect(onText.mock.calls.flat().join('')).toBe('Blue sky');
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body.stream).toBe(true);
    expect(body.messages).toHaveLength(2);
    expect(body.options.num_predict).toBe(512);
  });
  it('supports nonstreaming and optional temperature', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ message: { content: 'Answer' }, done: true }));
    const client = new OllamaClient(settings.endpoint, fetcher);
    const onText = vi.fn();
    expect(await chat(client, onText, { ...settings, stream: false, temperature: 0.2 })).toEqual({
      model: 'test:latest',
    });
    expect(onText).toHaveBeenCalledWith('Answer');
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      stream: false,
      options: { temperature: 0.2 },
    });
  });
  it('reports missing models, origin denial, incompatible models and server failures helpfully', async () => {
    for (const [status, code] of [
      [404, 'model-unavailable'],
      [403, 'origin-denied'],
      [500, 'api-error'],
    ] as const) {
      await expect(
        chat(
          new OllamaClient(
            settings.endpoint,
            vi.fn<typeof fetch>().mockResolvedValue(json({}, status)),
          ),
        ),
      ).rejects.toMatchObject({ code });
    }
    await expect(
      chat(
        new OllamaClient(
          settings.endpoint,
          vi.fn<typeof fetch>().mockResolvedValue(stream({ error: 'does not support chat' })),
        ),
      ),
    ).rejects.toMatchObject({ code: 'generation-failed' });
  });
  it('reports interrupted streams while retaining emitted partial text', async () => {
    const onText = vi.fn();
    await expect(
      chat(
        new OllamaClient(
          settings.endpoint,
          vi
            .fn<typeof fetch>()
            .mockResolvedValue(stream({ message: { content: 'Partial' }, done: false })),
        ),
        onText,
      ),
    ).rejects.toMatchObject({ code: 'interrupted' });
    expect(onText).toHaveBeenCalledWith('Partial');
  });
  it('rejects an empty successful response', async () => {
    await expect(
      chat(
        new OllamaClient(
          settings.endpoint,
          vi.fn<typeof fetch>().mockResolvedValue(stream({ done: true })),
        ),
      ),
    ).rejects.toMatchObject({ code: 'empty-response' });
  });
  it('handles initial HTTP timeouts and caller cancellation', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const client = new OllamaClient(settings.endpoint, fetcher);
    const timeout = expect(chat(client)).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(25_001);
    await timeout;
    const abort = new AbortController();
    const cancelled = expect(chat(client, vi.fn(), settings, abort.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    abort.abort();
    await cancelled;
  });
  it('aborts a stalled stream after the idle deadline', async () => {
    vi.useFakeTimers();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode('{"done":false}\n'));
        },
      }),
    );
    const result = expect(
      chat(new OllamaClient(settings.endpoint, vi.fn<typeof fetch>().mockResolvedValue(response))),
    ).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(120_001);
    await result;
  });
  it('rejects arbitrary destinations before performing a fetch', () => {
    for (const endpoint of [
      'https://example.com',
      'http://127.1:11434',
      'http://localhost:11434/path',
      'http://localhost.evil:11434',
      'http://user@localhost:11434',
    ]) {
      expect(() => new OllamaClient(endpoint)).toThrow();
    }
  });
  it('maps network and cancellation errors to useful errors', () => {
    expect(toAppError(new TypeError('Failed to fetch'))).toMatchObject({
      code: 'offline',
      message: expect.stringContaining('Start Ollama'),
    });
    expect(toAppError(new DOMException('Aborted', 'AbortError')).code).toBe('cancelled');
    expect(isLocalModel({ name: 'qwen:cloud' })).toBe(false);
  });
});
