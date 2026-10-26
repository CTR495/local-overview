import { searchQuery } from '../shared/google';
import { getSettings, saveSettings, watchSettings } from '../shared/settings';
import { openOptions, requestModels } from '../shared/protocol';
import type { Mode, Settings } from '../shared/types';
import {
  findNativeOverviews,
  findResultsRoot,
  HOST_ID,
  NativeVisibility,
  placeHost,
} from '../google/detector';
import { collectSources } from '../google/sources';
import { GenerationChannel } from './channel';
import { OverviewView } from './view';
import { isGoogleDark } from './theme';

export class OverviewController {
  private settings!: Settings;
  private mode: Mode = 'google';
  private query: string | null = null;
  private signature = '';
  private view?: OverviewView;
  private native = new NativeVisibility();
  private channel = new GenerationChannel();
  private observer?: MutationObserver;
  private observed?: HTMLElement;
  private themeObserver?: MutationObserver;
  private poll?: ReturnType<typeof setInterval>;
  private debounce?: ReturnType<typeof setTimeout>;
  private autoTimer?: ReturnType<typeof setTimeout>;
  private unwatch?: () => void;
  private epoch = 0;
  private modelEpoch = 0;
  private busy = false;
  private dead = false;
  async start(): Promise<void> {
    this.settings = await getSettings();
    if (this.dead) return;
    this.mode = this.settings.rememberMode ? this.settings.mode : this.settings.preferredMode;
    this.unwatch = watchSettings((settings) => this.updateSettings(settings));
    this.themeObserver = new MutationObserver(() =>
      this.view?.settings(this.settings, isGoogleDark()),
    );
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    if (document.body)
      this.themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    window.addEventListener('popstate', this.tick);
    window.addEventListener('pageshow', this.tick);
    window.addEventListener('pagehide', this.pageHide);
    // Isolated scripts cannot safely patch the page's History API. Poll only URL/root identity.
    this.poll = setInterval(this.tick, 1000);
    this.tick();
  }
  private pageHide = (event: PageTransitionEvent): void => {
    if (event.persisted) this.stop(false);
    else this.destroy();
  };
  private pageSignature(query = searchQuery(location.href)): string {
    const url = new URL(location.href);
    return JSON.stringify([
      query,
      url.searchParams.get('start'),
      url.searchParams.get('tbs'),
      url.searchParams.get('udm'),
    ]);
  }
  private tick = (): void => {
    if (this.dead) return;
    const query = searchQuery(location.href);
    const signature = this.pageSignature(query);
    if (signature !== this.signature) {
      const first = !this.signature;
      this.signature = signature;
      this.query = query;
      this.stop(false);
      this.view?.clear();
      this.native.restore();
      if (!this.settings.rememberMode) this.mode = this.settings.preferredMode;
      this.refreshDOM();
      if (query && this.settings.enabled && this.mode === 'local') {
        void this.loadModels();
        if (
          this.settings.autoGenerate &&
          !this.settings.interactionOnly &&
          (first || this.settings.autoRegenerate)
        )
          this.scheduleGenerate();
      }
    } else if (
      (this.settings.enabled && query && !this.view?.host.isConnected) ||
      this.observed !== findResultsRoot() ||
      this.observed?.isConnected === false
    )
      this.refreshDOM();
  };
  private scheduleGenerate(): void {
    clearTimeout(this.autoTimer);
    // Give navigation/delayed result DOM a chance to settle before optional grounding.
    this.autoTimer = setTimeout(() => {
      if (this.mode === 'local') void this.generate();
    }, 700);
  }
  private refreshDOM(): void {
    if (!this.settings.enabled || !this.query) {
      this.native.restore();
      this.view?.destroy();
      this.view = undefined;
      this.observer?.disconnect();
      this.observed = undefined;
      return;
    }
    if (!this.view) {
      // Avoid claiming or deleting an unrelated page element with the same ID.
      if (document.getElementById(HOST_ID)) return;
      this.view = new OverviewView({
        mode: (mode) => this.setMode(mode, true),
        generate: () => {
          void this.generate();
        },
        stop: () => this.stop(true),
        settings: openOptions,
        model: (model) => {
          void saveSettings({ model }).catch((error) => this.view?.notice(String(error), true));
        },
        refresh: () => {
          void this.loadModels();
        },
      });
      this.view.context([], this.settings.grounding);
    }
    placeHost(this.view.host);
    const native = findNativeOverviews(findResultsRoot() ?? document);
    if (this.mode === 'local') this.native.hide(native);
    else this.native.restore();
    this.view.settings(this.settings, isGoogleDark());
    this.view.mode(this.mode, native.length > 0);
    const root = findResultsRoot();
    if (root !== this.observed) {
      this.observer?.disconnect();
      this.observed = root ?? undefined;
      if (root) {
        this.observer = new MutationObserver((records) => {
          if (
            records.every((record) =>
              [...record.addedNodes, ...record.removedNodes].every(
                (node) => node === this.view?.host,
              ),
            )
          )
            return;
          clearTimeout(this.debounce);
          this.debounce = setTimeout(() => {
            this.tick();
            this.refreshDOM();
          }, 180);
        });
        this.observer.observe(root, { childList: true, subtree: true });
      }
    }
  }
  private setMode(mode: Mode, interaction: boolean): void {
    const changed = this.mode !== mode;
    this.mode = mode;
    if (changed) this.stop(false);
    this.refreshDOM();
    if (interaction)
      void saveSettings({ mode }).catch((error) =>
        this.view?.notice(`Could not save mode: ${String(error)}`, true),
      );
    if (mode === 'local' && (changed || (interaction && !this.busy && !this.view?.hasAnswer))) {
      void this.loadModels();
      if (
        this.settings.autoGenerate &&
        (interaction || !this.settings.interactionOnly) &&
        !this.view?.hasAnswer
      )
        this.scheduleGenerate();
    }
  }
  private async loadModels(): Promise<boolean> {
    if (!this.view || this.mode !== 'local') return false;
    const id = ++this.modelEpoch,
      view = this.view;
    view.connection('Connecting to Ollama…');
    try {
      const models = await requestModels();
      if (id !== this.modelEpoch || this.view !== view || this.mode !== 'local') return false;
      view.models(models, this.settings.model);
      if (!models.length) {
        view.connection('No local models');
        view.notice(
          'No local models are installed. Download a chat model with “ollama pull llama3.2”, then refresh models or click Retry. Cloud-backed models are excluded.',
          true,
        );
        return false;
      }
      if (this.settings.model && !models.some((model) => model.name === this.settings.model)) {
        view.connection('Model unavailable', true);
        view.notice(
          'The selected model is unavailable. Choose an installed local chat model from the model menu.',
          true,
        );
        return false;
      }
      view.connection('Ollama connected', true);
      return true;
    } catch (error) {
      if (id === this.modelEpoch && this.view === view) {
        view.connection('Connection unavailable');
        view.notice(
          error instanceof Error
            ? error.message
            : 'Start Ollama on your computer, then click Retry.',
          true,
        );
      }
      return false;
    }
  }
  private async generate(): Promise<void> {
    this.tick();
    clearTimeout(this.autoTimer);
    if (!this.query || this.mode !== 'local' || !this.settings.enabled || !this.view) return;
    this.stop(false);
    const epoch = ++this.epoch,
      view = this.view;
    // Capture query before async work; every navigation invalidates this epoch.
    const query = this.query,
      signature = this.signature;
    this.busy = true;
    view.start();
    view.connection('Connecting to Ollama…');
    const online = await this.loadModels();
    if (epoch !== this.epoch || this.view !== view) return;
    if (this.pageSignature() !== signature) {
      this.tick();
      return;
    }
    if (!online) {
      this.busy = false;
      view.finish();
      return;
    }
    const sources = this.settings.grounding
      ? collectSources(findResultsRoot() ?? document, this.settings.maxResults)
      : [];
    view.context(sources, this.settings.grounding);
    view.connection('Generating on your device', true);
    this.channel.start({ query, sources }, (event) => {
      if (epoch !== this.epoch || this.view !== view) return;
      if (this.pageSignature() !== signature) {
        this.tick();
        return;
      }
      if (event.type === 'delta') view.delta(event.text);
      else if (event.type === 'done') {
        this.busy = false;
        view.finish(event.stats, this.settings.showStats);
        view.connection('Ollama connected', true);
        if (!view.hasAnswer)
          view.notice(
            'The model returned no answer text. Try another chat model or regenerate.',
            true,
          );
      } else if (event.type === 'error') {
        this.busy = false;
        view.finish();
        view.connection('Generation interrupted');
        view.notice(event.error.message, true);
      } else if (event.type === 'cancelled') {
        this.busy = false;
        view.finish();
        view.notice('Generation stopped. You can regenerate at any time.');
      }
    });
  }
  private stop(notify: boolean): void {
    this.epoch++;
    this.modelEpoch++;
    clearTimeout(this.autoTimer);
    this.channel.cancel();
    if (this.busy) {
      this.busy = false;
      this.view?.finish();
      if (notify) this.view?.notice('Generation stopped. Your partial response is kept.');
    }
  }
  private updateSettings(next: Settings): void {
    if (this.dead) return;
    const before = this.settings;
    this.settings = next;
    const generationChanged = (
      [
        'endpoint',
        'model',
        'stream',
        'grounding',
        'maxResults',
        'responseLength',
        'temperature',
      ] as const
    ).some((key) => next[key] !== before[key]);
    if (!next.enabled || generationChanged) {
      this.stop(false);
      this.view?.clear();
      this.view?.context([], next.grounding);
    }
    if (next.mode !== before.mode) this.setMode(next.mode, false);
    else if (next.preferredMode !== before.preferredMode && !next.rememberMode)
      this.setMode(next.preferredMode, false);
    this.refreshDOM();
    if (generationChanged && next.enabled && this.mode === 'local') {
      void this.loadModels();
      if (next.autoGenerate && !next.interactionOnly) this.scheduleGenerate();
    } else if (next.enabled && !before.enabled && this.mode === 'local') {
      void this.loadModels();
      if (next.autoGenerate && !next.interactionOnly) this.scheduleGenerate();
    }
  }
  destroy(): void {
    this.dead = true;
    this.stop(false);
    clearInterval(this.poll);
    clearTimeout(this.debounce);
    this.unwatch?.();
    this.observer?.disconnect();
    this.themeObserver?.disconnect();
    this.native.restore();
    this.view?.destroy();
    window.removeEventListener('popstate', this.tick);
    window.removeEventListener('pageshow', this.tick);
    window.removeEventListener('pagehide', this.pageHide);
  }
}
