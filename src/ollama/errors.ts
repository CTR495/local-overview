import type { AppError } from '../shared/types';

export class OllamaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}
export function toAppError(error: unknown): AppError {
  if (error instanceof OllamaError) return { code: error.code, message: error.message };
  if (error instanceof DOMException && error.name === 'AbortError')
    return { code: 'cancelled', message: 'Generation stopped.' };
  return {
    code: 'offline',
    message:
      'Ollama is offline or unreachable. Start Ollama on your computer, then click Retry. If it is running, check the endpoint and OLLAMA_ORIGINS in Settings.',
  };
}
