import { OllamaError } from './errors';

export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_LINE_CHARS = 512 * 1024;
function decode(decoder: TextDecoder, bytes?: Uint8Array, stream = false): string {
  try {
    return decoder.decode(bytes, { stream });
  } catch {
    throw new OllamaError('invalid-response', 'Ollama returned invalid UTF-8. Retry generation.');
  }
}

async function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    reader
      .read()
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

/** Decodes UTF-8 across byte boundaries and JSON records across network chunks. */
export async function* readNdjson(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onActivity: () => void = () => {},
): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = '';
  let bytes = 0;
  try {
    while (true) {
      const chunk = await readChunk(reader, signal);
      if (chunk.done) {
        pending += decode(decoder);
        break;
      }
      onActivity();
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES)
        throw new OllamaError(
          'response-limit',
          'The response exceeded the safe size limit. Try a shorter response.',
        );
      pending += decode(decoder, chunk.value, true);
      let newline: number;
      while ((newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line.length > MAX_LINE_CHARS)
          throw new OllamaError('response-limit', 'Ollama returned an oversized stream record.');
        if (line) yield parseJson(line);
      }
      if (pending.length > MAX_LINE_CHARS)
        throw new OllamaError('response-limit', 'Ollama returned an oversized stream record.');
    }
    if (pending.trim()) yield parseJson(pending);
  } catch (error) {
    if (error instanceof TypeError)
      throw new OllamaError(
        'interrupted',
        'The response stream was interrupted. Your partial answer is shown; click Regenerate to try again.',
      );
    throw error;
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new OllamaError(
      'invalid-response',
      'Ollama returned an invalid JSON response. Retry generation or update Ollama.',
    );
  }
}

export async function readBoundedJson(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onActivity: () => void = () => {},
): Promise<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let result = '';
  let bytes = 0;
  try {
    while (true) {
      const chunk = await readChunk(reader, signal);
      if (chunk.done) break;
      onActivity();
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES)
        throw new OllamaError(
          'response-limit',
          'Ollama returned a response larger than the safe size limit.',
        );
      result += decode(decoder, chunk.value, true);
    }
    result += decode(decoder);
    return parseJson(result);
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
