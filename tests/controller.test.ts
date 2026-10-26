// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.google.com/search?q=alpha"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewController } from '../src/content/controller';
import { DEFAULTS } from '../src/shared/settings';
import { HOST_ID } from '../src/google/detector';
import type { ClientEvent, ServerEvent } from '../src/shared/protocol';
import type { Model, Settings } from '../src/shared/types';

interface TestPort {
  messages: ClientEvent[];
  emit(event: ServerEvent): void;
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onMessage: { addListener(listener: (event: ServerEvent) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
}
let values: Settings;
let changes: Array<(changes: object, area: string) => void>;
let ports: TestPort[];
let controllers: OverviewController[];
let modelReply: () => Promise<Model[]>;
let sendMessage: ReturnType<typeof vi.fn>;

function makePort(): TestPort {
  const messages: ClientEvent[] = [];
  const listeners: Array<(event: ServerEvent) => void> = [];
  const disconnects: Array<() => void> = [];
  const port: TestPort = {
    messages,
    emit: (event) => listeners.forEach((listener) => listener(event)),
    postMessage: vi.fn((event: ClientEvent) => messages.push(event)),
    disconnect: vi.fn(() => disconnects.forEach((listener) => listener())),
    onMessage: {
      addListener: (listener) => {
        listeners.push(listener);
      },
    },
    onDisconnect: {
      addListener: (listener) => {
        disconnects.push(listener);
      },
    },
  };
  ports.push(port);
  return port;
}
async function start(patch: Partial<Settings> = {}): Promise<OverviewController> {
  Object.assign(values, patch);
  const controller = new OverviewController();
  controllers.push(controller);
  await controller.start();
  await vi.advanceTimersByTimeAsync(0);
  return controller;
}
async function setStored(patch: Partial<Settings>): Promise<void> {
  Object.assign(values, patch);
  changes.forEach((listener) => listener({}, 'local'));
  await vi.advanceTimersByTimeAsync(0);
}
function shadow(): ShadowRoot {
  return document.getElementById(HOST_ID)!.shadowRoot!;
}
function click(selector: string): void {
  shadow().querySelector<HTMLButtonElement>(selector)!.click();
}
function generations(): Array<Extract<ClientEvent, { type: 'generate' }>> {
  return ports.flatMap((port) =>
    port.messages.filter(
      (message): message is Extract<ClientEvent, { type: 'generate' }> =>
        message.type === 'generate',
    ),
  );
}
async function navigate(query: string): Promise<void> {
  history.pushState({}, '', `/search?q=${query}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  await vi.advanceTimersByTimeAsync(0);
}
function defer<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  values = { ...DEFAULTS };
  changes = [];
  ports = [];
  controllers = [];
  modelReply = async () => [{ name: 'qwen:local' }, { name: 'llama:local' }];
  sendMessage = vi.fn(async (message: { type: string }) =>
    message.type === 'models' ? { ok: true, models: await modelReply() } : { ok: true },
  );
  vi.stubGlobal('chrome', {
    runtime: { sendMessage, connect: vi.fn(makePort), lastError: undefined },
    storage: {
      local: {
        get: vi.fn(async () => ({ ...values })),
        set: vi.fn(async (patch: Partial<Settings>) => {
          Object.assign(values, patch);
          changes.forEach((listener) => listener({}, 'local'));
        }),
      },
      onChanged: {
        addListener: (listener: (changes: object, area: string) => void) => {
          changes.push(listener);
        },
        removeListener: (listener: (changes: object, area: string) => void) => {
          changes = changes.filter((item) => item !== listener);
        },
      },
    },
  });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => clearTimeout(handle));
  history.replaceState({}, '', '/search?q=alpha');
  document.body.innerHTML =
    '<main id="search"><section id="native" data-ai-overview="true" style="display: flex !important"><h2>AI Overview</h2><p>Google’s original answer.</p><button id="native-button">Expand</button></section><div id="rso"><div><a href="https://example.com/alpha"><h3>Alpha source</h3></a><p>A relevant public snippet.</p></div></div></main>';
});
afterEach(() => {
  controllers.forEach((controller) => controller.destroy());
  const scope = globalThis as typeof globalThis & {
    __localOverviewController_v1__?: OverviewController;
  };
  scope.__localOverviewController_v1__?.destroy();
  delete scope.__localOverviewController_v1__;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('Google page controller', () => {
  it('shows a persistent toggle without making an Ollama request in Google mode', async () => {
    await start();
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
    expect(shadow().querySelector('[data-mode="google"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(document.getElementById('native')?.style.display).toBe('flex');
    await vi.advanceTimersByTimeAsync(2000);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(generations()).toHaveLength(0);
  });
  it('keeps Local AI functional with no native overview', async () => {
    document.getElementById('native')!.remove();
    await start({ autoGenerate: false });
    expect(shadow().querySelector('.google-note')?.textContent).toContain('unavailable');
    click('[data-mode="local"]');
    await vi.advanceTimersByTimeAsync(0);
    click('.generate');
    await vi.advanceTimersByTimeAsync(0);
    expect(generations()).toHaveLength(1);
  });
  it('switches both ways, restoring native display priority and original event handlers', async () => {
    const handler = vi.fn();
    document.getElementById('native-button')!.addEventListener('click', handler);
    const native = document.getElementById('native')!;
    await start({ autoGenerate: false });
    click('[data-mode="local"]');
    await vi.advanceTimersByTimeAsync(0);
    expect(native.style.getPropertyValue('display')).toBe('none');
    click('[data-mode="google"]');
    await vi.advanceTimersByTimeAsync(0);
    expect(native.style.getPropertyValue('display')).toBe('flex');
    expect(native.style.getPropertyPriority('display')).toBe('important');
    document.getElementById('native-button')!.click();
    expect(handler).toHaveBeenCalledOnce();
    expect(values.mode).toBe('google');
    expect(generations()).toHaveLength(0);
  });
  it('honors interaction-only and explicit generation', async () => {
    await start({ mode: 'local', interactionOnly: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(generations()).toHaveLength(0);
    click('.generate');
    await vi.advanceTimersByTimeAsync(0);
    expect(generations()).toHaveLength(1);
  });
  it('allows selecting the already-active Local AI mode to satisfy interaction-only', async () => {
    await start({ mode: 'local', interactionOnly: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(generations()).toHaveLength(0);
    click('[data-mode="local"]');
    await vi.advanceTimersByTimeAsync(710);
    expect(generations()).toHaveLength(1);
    expect(generations()[0].input.query).toBe('alpha');
  });
  it('honors autoGenerate=false when switching modes', async () => {
    await start({ autoGenerate: false });
    click('[data-mode="local"]');
    await vi.advanceTimersByTimeAsync(1000);
    expect(generations()).toHaveLength(0);
    click('.generate');
    await vi.advanceTimersByTimeAsync(0);
    expect(generations()).toHaveLength(1);
  });
  it('honors autoRegenerate=false after navigating without a page reload', async () => {
    await start({ mode: 'local', autoRegenerate: false });
    await vi.advanceTimersByTimeAsync(710);
    expect(generations()).toHaveLength(1);
    await navigate('beta');
    await vi.advanceTimersByTimeAsync(1000);
    expect(generations()).toHaveLength(1);
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
    click('.generate');
    await vi.advanceTimersByTimeAsync(0);
    expect(generations().at(-1)?.input.query).toBe('beta');
  });
  it('cancels the old query and ignores late stream messages during rapid navigation', async () => {
    await start({ mode: 'local' });
    await vi.advanceTimersByTimeAsync(710);
    const oldPort = ports[0],
      oldId = generations()[0].id;
    oldPort.emit({ type: 'delta', id: oldId, text: 'Old query response' });
    await vi.advanceTimersByTimeAsync(20);
    expect(shadow().querySelector('.answer')?.textContent).toContain('Old query');
    await navigate('beta');
    await navigate('gamma');
    oldPort.emit({ type: 'delta', id: oldId, text: 'STALE RESPONSE' });
    await vi.advanceTimersByTimeAsync(710);
    expect(generations()).toHaveLength(2);
    expect(generations()[1].input.query).toBe('gamma');
    expect(oldPort.messages.some((event) => event.type === 'cancel')).toBe(true);
    expect(shadow().querySelector('.answer')?.textContent).not.toContain('STALE');
    expect(shadow().querySelector('.answer')?.textContent).not.toContain('Old query');
  });
  it('disables cleanly and restores the native overview', async () => {
    await start({ mode: 'local' });
    await vi.advanceTimersByTimeAsync(710);
    expect(document.getElementById('native')?.style.display).toBe('none');
    await setStored({ enabled: false });
    expect(document.getElementById(HOST_ID)).toBeNull();
    expect(document.getElementById('native')?.style.display).toBe('flex');
    expect(ports[0].messages.some((event) => event.type === 'cancel')).toBe(true);
  });
  it('does not begin generation if stopped while model discovery is delayed', async () => {
    await start({ mode: 'local', autoGenerate: false });
    const deferred = defer<Model[]>();
    modelReply = () => deferred.promise;
    click('.generate');
    await vi.advanceTimersByTimeAsync(0);
    expect((shadow().querySelector('.stop') as HTMLElement).hidden).toBe(false);
    click('.stop');
    deferred.resolve([{ name: 'qwen:local' }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(generations()).toHaveLength(0);
    expect((shadow().querySelector('.stop') as HTMLElement).hidden).toBe(true);
    expect(shadow().querySelector('.notice')?.textContent).toContain('stopped');
  });
  it('prefers the configured initial mode when remembering is off', async () => {
    await start({ mode: 'local', preferredMode: 'google', rememberMode: false });
    await vi.advanceTimersByTimeAsync(1000);
    expect(shadow().querySelector('[data-mode="google"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it('restores a delayed native overview and prevents duplicate interfaces after repeated DOM changes', async () => {
    document.getElementById('native')!.remove();
    await start({ mode: 'local', autoGenerate: false });
    const native = document.createElement('section');
    native.dataset.aiOverview = 'true';
    native.textContent = 'Delayed native answer';
    document.getElementById('search')!.append(native);
    await vi.advanceTimersByTimeAsync(200);
    expect(native.style.display).toBe('none');
    for (let i = 0; i < 4; i++) {
      document.getElementById('rso')!.append(document.createElement('p'));
      await vi.advanceTimersByTimeAsync(200);
    }
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
    click('[data-mode="google"]');
    await vi.advanceTimersByTimeAsync(0);
    expect(native.style.display).toBe('');
    expect(native.isConnected).toBe(true);
  });
  it('replaces the old isolated-world controller during duplicate script injection', async () => {
    vi.resetModules();
    await import('../src/content/index');
    await vi.advanceTimersByTimeAsync(0);
    const firstHost = document.getElementById(HOST_ID);
    vi.resetModules();
    await import('../src/content/index');
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
    expect(document.getElementById(HOST_ID)).not.toBe(firstHost);
    expect(changes).toHaveLength(1);
  });
});
