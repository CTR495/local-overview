import { describe, expect, it } from 'vitest';
import { MAX_RESPONSE_BYTES, readBoundedJson, readNdjson } from '../src/ollama/stream';

const signal = () => new AbortController().signal;
function bytes(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}
async function collect(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const result: unknown[] = [];
  for await (const value of readNdjson(stream, signal())) result.push(value);
  return result;
}
describe('bounded streaming decoder', () => {
  it('decodes split UTF-8 and JSON lines with CRLF and no final newline', async () => {
    const text = new TextEncoder().encode(' \n{"message":{"content":"Café 🎹"}}\r\n{"done":true}');
    const chunks = Array.from(text, (value) => new Uint8Array([value]));
    expect(await collect(bytes(...chunks))).toEqual([
      { message: { content: 'Café 🎹' } },
      { done: true },
    ]);
  });
  it('rejects malformed JSON records', async () => {
    await expect(collect(bytes(new TextEncoder().encode('{oops}\n')))).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });
  it('rejects invalid UTF-8 rather than silently replacing text', async () => {
    await expect(collect(bytes(new Uint8Array([255])))).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });
  it('bounds a line and total response bytes', async () => {
    await expect(
      collect(bytes(new TextEncoder().encode(' '.repeat(600_000)))),
    ).rejects.toMatchObject({ code: 'response-limit' });
    await expect(
      readBoundedJson(bytes(new Uint8Array(MAX_RESPONSE_BYTES + 1)), signal()),
    ).rejects.toMatchObject({ code: 'response-limit' });
  });
  it('cancels a pending read and releases the stream', async () => {
    let cancelled = false;
    const source = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const abort = new AbortController();
    const iterator = readNdjson(source, abort.signal);
    const pending = iterator.next();
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelled).toBe(true);
    expect(source.locked).toBe(false);
  });
});
