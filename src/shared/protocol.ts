import type { AppError, GenerationInput, GenerationStats, Model } from './types';
export const PORT_NAME = 'local-overview-generation-v1';
export type RequestMessage = { type: 'models' } | { type: 'open-options' };
export type Reply = { ok: true; models?: Model[] } | { ok: false; error: AppError };
export type ClientEvent =
  | { type: 'generate'; id: string; input: GenerationInput }
  | { type: 'cancel'; id: string }
  | { type: 'ping' };
export type ServerEvent =
  | { type: 'delta'; id: string; text: string }
  | { type: 'done'; id: string; stats: GenerationStats }
  | { type: 'error'; id: string; error: AppError }
  | { type: 'cancelled'; id: string }
  | { type: 'pong' };
export async function requestModels(): Promise<Model[]> {
  const reply = (await chrome.runtime.sendMessage({
    type: 'models',
  } satisfies RequestMessage)) as Reply;
  if (!reply?.ok)
    throw new Error(
      reply && 'error' in reply
        ? reply.error.message
        : 'The extension connection was interrupted. Reload this page and retry.',
    );
  return reply.models ?? [];
}
export function openOptions(): void {
  void chrome.runtime.sendMessage({ type: 'open-options' } satisfies RequestMessage);
}
