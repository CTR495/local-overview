import { describe, expect, it } from 'vitest';
import { parseClientEvent, trustedSender } from '../src/background/security';

const id = 'abcdefghijklmnop';
describe('extension request boundary', () => {
  it('accepts only this extension, known settings pages, and top-level supported Google searches', () => {
    expect(trustedSender({ id, url: `chrome-extension://${id}/options.html` }, id)).toBe(true);
    expect(
      trustedSender({ id, frameId: 0, url: 'https://www.google.com/search?q=test' }, id, true),
    ).toBe(true);
    expect(
      trustedSender({ id, frameId: 0, url: 'https://www.google.com.au/search?q=test' }, id, true),
    ).toBe(true);
    for (const sender of [
      { id: 'other', url: 'https://www.google.com/search?q=test', frameId: 0 },
      { id, frameId: 1, url: 'https://www.google.com/search?q=test' },
      { id, url: 'https://www.google.com.evil/search?q=test', frameId: 0 },
      { id, url: 'https://example.com/search?q=test', frameId: 0 },
      { id },
    ]) {
      expect(trustedSender(sender, id)).toBe(false);
    }
    expect(trustedSender({ id, url: `chrome-extension://${id}/popup.html` }, id, true)).toBe(false);
  });
  it('accepts only the narrow generation/cancel/heartbeat protocol', () => {
    expect(parseClientEvent({ type: 'ping' })).toEqual({ type: 'ping' });
    expect(parseClientEvent({ type: 'cancel', id: 'id-1' })).toEqual({
      type: 'cancel',
      id: 'id-1',
    });
    expect(
      parseClientEvent({ type: 'generate', id: 'id-1', input: { query: 'Q', sources: [] } }),
    ).toMatchObject({ type: 'generate' });
    for (const value of [
      { type: 'fetch', url: 'https://evil.test' },
      { type: 'generate', id: 'bad id', input: {} },
      { type: 'generate', id: 'id', input: { query: 'Q', sources: [{ url: 'javascript:x' }] } },
      null,
    ]) {
      expect(parseClientEvent(value)).toBeNull();
    }
  });
});
