// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { applyAppearance, connectionState, renderModelOptions } from '../src/pages/common';
import { DEFAULTS } from '../src/shared/settings';

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
});

describe('settings UI helpers', () => {
  it('lists every installed model without interpreting names as HTML', () => {
    const select = document.createElement('select');
    renderModelOptions(
      select,
      [{ name: 'qwen3:4b' }, { name: '<img src=x onerror=alert(1)>' }],
      'qwen3:4b',
    );
    expect(select.options).toHaveLength(3);
    expect(select.value).toBe('qwen3:4b');
    expect(select.querySelector('img')).toBeNull();
    expect(select.options[2].textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('keeps an unavailable selected model visible for recovery', () => {
    const select = document.createElement('select');
    renderModelOptions(select, [], 'removed:model');
    expect(select.value).toBe('removed:model');
    expect(select.selectedOptions[0].textContent).toContain('unavailable');
    expect(select.disabled).toBe(false);
  });
  it('handles no installed models without a hardcoded list', () => {
    const select = document.createElement('select');
    renderModelOptions(select, [], '');
    expect(select.options).toHaveLength(1);
    expect(select.disabled).toBe(true);
    expect(select.textContent).toContain('No local models found');
  });
  it('applies light, dark, automatic, and reduced animation preferences', () => {
    for (const theme of ['light', 'dark', 'auto'] as const) {
      applyAppearance({ ...DEFAULTS, theme, reducedMotion: true });
      expect(document.documentElement.dataset.theme).toBe(theme);
      expect(document.body.dataset.reducedMotion).toBe('true');
    }
  });
  it('renders offline errors as safe text with recovery guidance', () => {
    for (const id of ['connection-title', 'status-dot', 'connection-detail']) {
      const node = document.createElement('div');
      node.id = id;
      document.body.append(node);
    }
    connectionState('error');
    expect(document.getElementById('connection-detail')?.textContent).toContain('Start Ollama');
    connectionState('error', '<script>not markup</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(document.getElementById('connection-detail')?.textContent).toBe(
      '<script>not markup</script>',
    );
  });
});
