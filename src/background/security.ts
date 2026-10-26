import { searchQuery } from '../shared/google';
import { validateInput } from '../ollama/prompt';
import type { ClientEvent } from '../shared/protocol';

export function trustedSender(
  sender: chrome.runtime.MessageSender,
  extensionId: string,
  generation = false,
): boolean {
  if (sender.id !== extensionId || !sender.url) return false;
  const extensionPages = [
    `chrome-extension://${extensionId}/popup.html`,
    `chrome-extension://${extensionId}/options.html`,
  ];
  if (extensionPages.includes(sender.url)) return !generation;
  return sender.frameId === 0 && searchQuery(sender.url) !== null;
}

export function parseClientEvent(value: unknown): ClientEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (event.type === 'ping') return { type: 'ping' };
  if (typeof event.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(event.id)) return null;
  if (event.type === 'cancel') return { type: 'cancel', id: event.id };
  if (event.type !== 'generate') return null;
  try {
    return { type: 'generate', id: event.id, input: validateInput(event.input) };
  } catch {
    return null;
  }
}
