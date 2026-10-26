import { validateEndpoint } from '../shared/endpoint';
import type { GenerationInput, GenerationStats, Model, Settings } from '../shared/types';
import { OllamaError } from './errors';
import { buildMessages } from './prompt';
import { readBoundedJson, readNdjson } from './stream';

const HEADER_TIMEOUT = 25_000;
const IDLE_TIMEOUT = 120_000;
const GENERATION_TIMEOUT = 10 * 60_000;
const MAX_TEXT = 300_000;
type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

class RequestScope {
  readonly controller = new AbortController();
  private idle?: ReturnType<typeof setTimeout>;
  private total: ReturnType<typeof setTimeout>;
  private abortParent: () => void;
  constructor(
    private parent: AbortSignal,
    total: number,
  ) {
    this.abortParent = () => this.controller.abort(parent.reason);
    parent.addEventListener('abort', this.abortParent, { once: true });
    if (parent.aborted) this.abortParent();
    this.total = setTimeout(() => this.timeout(), total);
    this.touch(HEADER_TIMEOUT);
  }
  private timeout(): void {
    this.controller.abort(
      new OllamaError(
        'timeout',
        'Ollama timed out. Try a smaller model, wait for it to load, then click Retry.',
      ),
    );
  }
  touch(ms = IDLE_TIMEOUT): void {
    clearTimeout(this.idle);
    this.idle = setTimeout(() => this.timeout(), ms);
  }
  dispose(): void {
    clearTimeout(this.idle);
    clearTimeout(this.total);
    this.parent.removeEventListener('abort', this.abortParent);
  }
  error(error: unknown): never {
    if (this.controller.signal.aborted) throw this.controller.signal.reason;
    throw error;
  }
}

/** Defensively excludes Ollama cloud aliases as well as explicit upstream metadata. */
export function isLocalModel(value: unknown): value is JsonRecord & { name: string } {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 200 ||
    /[\x00-\x1f\x7f]/.test(value.name)
  )
    return false;
  if (value.remote_model || value.remote_host || /(?:^|[/:_-])cloud(?:$|[/:_-])/i.test(value.name))
    return false;
  return true;
}

export class OllamaClient {
  private readonly endpoint: string;
  constructor(
    endpoint: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.endpoint = validateEndpoint(endpoint);
  }
  private async response(
    path: '/api/tags' | '/api/chat',
    init: RequestInit,
    scope: RequestScope,
  ): Promise<Response> {
    let response: Response;
    try {
      // Native WorkerGlobalScope.fetch rejects an OllamaClient as its receiver.
      const fetcher = this.fetcher;
      response = await fetcher(`${this.endpoint}${path}`, {
        ...init,
        signal: scope.controller.signal,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    } catch (error) {
      return scope.error(error);
    }
    scope.touch();
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      if (response.status === 403)
        throw new OllamaError(
          'origin-denied',
          'Ollama denied this extension. Allow its chrome-extension:// origin in OLLAMA_ORIGINS, restart Ollama, then Retry. See Settings for your extension origin.',
        );
      if (response.status === 404 && path === '/api/chat')
        throw new OllamaError(
          'model-unavailable',
          'The selected model is unavailable. Refresh the model list in Settings and select an installed chat model.',
        );
      throw new OllamaError(
        'api-error',
        `Ollama returned HTTP ${response.status}. Check that the endpoint is Ollama and the selected model supports chat, then Retry.`,
      );
    }
    if (!response.body)
      throw new OllamaError(
        'invalid-response',
        'Ollama returned an empty response. Retry generation.',
      );
    return response;
  }
  async listModels(signal: AbortSignal = new AbortController().signal): Promise<Model[]> {
    const scope = new RequestScope(signal, 10_000);
    try {
      const response = await this.response('/api/tags', { method: 'GET' }, scope);
      const json = await readBoundedJson(response.body!, scope.controller.signal, () =>
        scope.touch(),
      );
      if (!isRecord(json) || !Array.isArray(json.models) || json.models.length > 10_000)
        throw new OllamaError(
          'invalid-response',
          'Ollama returned an invalid model list. Update Ollama and Retry.',
        );
      const seen = new Set<string>();
      return json.models
        .filter(isLocalModel)
        .filter((model) => {
          if (seen.has(model.name)) return false;
          seen.add(model.name);
          return true;
        })
        .map((model) => ({
          name: model.name,
          ...(typeof model.size === 'number' && Number.isFinite(model.size) && model.size >= 0
            ? { size: model.size }
            : {}),
        }));
    } catch (error) {
      return scope.error(error);
    } finally {
      scope.dispose();
    }
  }
  async chat(
    model: string,
    input: GenerationInput,
    settings: Settings,
    signal: AbortSignal,
    onText: (text: string) => void,
  ): Promise<GenerationStats> {
    const scope = new RequestScope(signal, GENERATION_TIMEOUT);
    let count = 0;
    let done = false;
    let stats: GenerationStats = { model };
    const accept = (value: unknown): void => {
      if (!isRecord(value))
        throw new OllamaError('invalid-response', 'Ollama returned an invalid chat record.');
      if (typeof value.error === 'string')
        throw new OllamaError(
          'generation-failed',
          `Ollama could not generate an answer: ${value.error.slice(0, 400)}. Try another installed chat model.`,
        );
      if (done) return;
      if (isRecord(value.message) && typeof value.message.content === 'string') {
        count += value.message.content.length;
        if (count > MAX_TEXT)
          throw new OllamaError(
            'response-limit',
            'The generated response was too long. Try a shorter response.',
          );
        if (value.message.content) onText(value.message.content);
      }
      if (value.done === true) {
        done = true;
        stats = { model };
        for (const key of [
          'eval_count',
          'eval_duration',
          'total_duration',
          'prompt_eval_duration',
        ] as const) {
          if (typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0)
            stats[key] = value[key];
        }
      }
    };
    try {
      const response = await this.response(
        '/api/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: buildMessages(input, settings),
            stream: settings.stream,
            options: {
              num_predict: { short: 256, balanced: 512, detailed: 1024 }[settings.responseLength],
              ...(settings.temperature === null ? {} : { temperature: settings.temperature }),
            },
          }),
        },
        scope,
      );
      if (settings.stream) {
        for await (const item of readNdjson(response.body!, scope.controller.signal, () =>
          scope.touch(),
        )) {
          accept(item);
          if (done) break;
        }
      } else
        accept(await readBoundedJson(response.body!, scope.controller.signal, () => scope.touch()));
      if (!done)
        throw new OllamaError(
          'interrupted',
          'The response stream was interrupted before Ollama finished. Your partial answer is shown; click Regenerate to try again.',
        );
      if (!count)
        throw new OllamaError(
          'empty-response',
          'The model returned no answer. Try a different installed chat model or a longer response preference.',
        );
      return stats;
    } catch (error) {
      return scope.error(error);
    } finally {
      scope.dispose();
    }
  }
}
