import { getSettings } from '../shared/settings';
import { PORT_NAME, type Reply, type ServerEvent } from '../shared/protocol';
import { OllamaClient } from '../ollama/client';
import { OllamaError, toAppError } from '../ollama/errors';
import { parseClientEvent, trustedSender } from './security';

chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse: (reply: Reply) => void) => {
    if (!trustedSender(sender, chrome.runtime.id) || !message || typeof message !== 'object')
      return false;
    const type = (message as Record<string, unknown>).type;
    if (type === 'open-options') {
      void chrome.runtime.openOptionsPage().then(
        () => sendResponse({ ok: true }),
        (error) => sendResponse({ ok: false, error: toAppError(error) }),
      );
      return true;
    }
    if (type !== 'models') return false;
    void getSettings()
      .then((settings) => new OllamaClient(settings.endpoint).listModels())
      .then(
        (models) => sendResponse({ ok: true, models }),
        (error) => sendResponse({ ok: false, error: toAppError(error) }),
      );
    return true;
  },
);

chrome.runtime.onConnect.addListener((port) => {
  if (
    port.name !== PORT_NAME ||
    !port.sender ||
    !trustedSender(port.sender, chrome.runtime.id, true)
  ) {
    port.disconnect();
    return;
  }
  let active: { id: string; controller: AbortController } | null = null;
  let disconnected = false;
  const send = (event: ServerEvent): void => {
    if (!disconnected) {
      try {
        port.postMessage(event);
      } catch {
        active?.controller.abort();
      }
    }
  };
  const cancel = (): void => {
    active?.controller.abort(new DOMException('Aborted', 'AbortError'));
    active = null;
  };
  const settingsChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local' || !active) return;
    if (
      [
        'enabled',
        'endpoint',
        'model',
        'grounding',
        'maxResults',
        'stream',
        'responseLength',
        'temperature',
      ].some((key) => key in changes)
    ) {
      const id = active.id;
      cancel();
      send({ type: 'cancelled', id });
    }
  };
  chrome.storage.onChanged.addListener(settingsChanged);
  port.onDisconnect.addListener(() => {
    disconnected = true;
    cancel();
    chrome.storage.onChanged.removeListener(settingsChanged);
  });
  port.onMessage.addListener((value: unknown) => {
    const event = parseClientEvent(value);
    if (!event) {
      cancel();
      port.disconnect();
      return;
    }
    if (event.type === 'ping') {
      send({ type: 'pong' });
      return;
    }
    if (event.type === 'cancel') {
      if (active?.id === event.id) {
        cancel();
        send({ type: 'cancelled', id: event.id });
      }
      return;
    }
    cancel();
    const request = { id: event.id, controller: new AbortController() };
    active = request;
    void (async () => {
      const settings = await getSettings();
      request.controller.signal.throwIfAborted();
      if (!settings.enabled)
        throw new OllamaError(
          'disabled',
          'Local Overview is disabled. Enable it in the extension popup.',
        );
      const client = new OllamaClient(settings.endpoint);
      const models = await client.listModels(request.controller.signal);
      if (!models.length)
        throw new OllamaError(
          'no-models',
          'No local models are installed. Run ollama pull llama3.2 (or another chat model), then click Retry. Cloud models are excluded.',
        );
      const model = settings.model || models[0].name;
      if (!models.some((item) => item.name === model))
        throw new OllamaError(
          'model-unavailable',
          'The selected model is unavailable locally. Open Settings, refresh the model list, and choose an installed chat model.',
        );
      request.controller.signal.throwIfAborted();
      const input = {
        query: event.input.query,
        sources: settings.grounding ? event.input.sources.slice(0, settings.maxResults) : [],
      };
      const stats = await client.chat(model, input, settings, request.controller.signal, (text) => {
        if (active === request) send({ type: 'delta', id: request.id, text });
      });
      if (active === request) send({ type: 'done', id: request.id, stats });
    })()
      .catch((error) => {
        if (active !== request) return;
        const appError = toAppError(error);
        if (appError.code === 'cancelled') send({ type: 'cancelled', id: request.id });
        else send({ type: 'error', id: request.id, error: appError });
      })
      .finally(() => {
        if (active === request) active = null;
      });
  });
});
