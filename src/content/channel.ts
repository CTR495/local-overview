import { PORT_NAME } from '../shared/protocol';
import type { ClientEvent, ServerEvent } from '../shared/protocol';
import type { GenerationInput } from '../shared/types';

export class GenerationChannel {
  private port?: chrome.runtime.Port;
  private timer?: ReturnType<typeof setInterval>;
  private id = '';
  start(input: GenerationInput, listener: (event: ServerEvent) => void): void {
    this.cancel();
    const id = crypto.randomUUID();
    this.id = id;
    try {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      this.port = port;
      let lastPong = Date.now();
      const finish = () => {
        if (this.port === port) {
          this.port = undefined;
          clearInterval(this.timer);
        }
        port.disconnect();
      };
      port.onMessage.addListener((event: ServerEvent) => {
        if (this.id !== id) return;
        if (event.type === 'pong') {
          lastPong = Date.now();
          return;
        }
        if (event.id !== id) return;
        listener(event);
        if (['done', 'error', 'cancelled'].includes(event.type)) {
          this.id = '';
          finish();
        }
      });
      port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        if (this.id === id) {
          this.id = '';
          clearInterval(this.timer);
          this.port = undefined;
          listener({
            type: 'error',
            id,
            error: {
              code: 'interrupted',
              message:
                'The extension connection was interrupted. Your partial answer is preserved. Click Retry to start again; reload the Google tab if the extension was updated.',
            },
          });
        }
      });
      this.timer = setInterval(() => {
        if (Date.now() - lastPong > 50_000) {
          listener({
            type: 'error',
            id,
            error: {
              code: 'interrupted',
              message: 'The local connection stopped responding. Click Retry to start again.',
            },
          });
          this.cancel();
          return;
        }
        try {
          port.postMessage({ type: 'ping' } satisfies ClientEvent);
        } catch {
          listener({
            type: 'error',
            id,
            error: {
              code: 'interrupted',
              message: 'The extension connection was interrupted. Click Retry to start again.',
            },
          });
          this.cancel();
        }
      }, 20_000);
      port.postMessage({ type: 'generate', id, input } satisfies ClientEvent);
    } catch {
      this.cancel();
      listener({
        type: 'error',
        id,
        error: {
          code: 'interrupted',
          message:
            'Extension unavailable. Reload this Google tab after installing or updating Local Overview.',
        },
      });
    }
  }
  cancel(): void {
    const port = this.port,
      id = this.id;
    this.id = '';
    this.port = undefined;
    clearInterval(this.timer);
    if (port) {
      try {
        port.postMessage({ type: 'cancel', id } satisfies ClientEvent);
        port.disconnect();
      } catch {
        /* already disconnected */
      }
    }
  }
}
