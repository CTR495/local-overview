export type Theme = 'auto' | 'light' | 'dark';
export interface Settings {
  enabled: boolean;
  endpoint: string;
  model: string;
  autoGenerate: boolean;
  stream: boolean;
  grounding: boolean;
  maxResults: number;
  responseLength: 'short' | 'balanced' | 'detailed';
  temperature: number | null;
  theme: Theme;
  reducedMotion: boolean;
  showStats: boolean;
  sparkle: boolean;
  interactionOnly: boolean;
  autoRegenerate: boolean;
}
export interface Source {
  id: number;
  title: string;
  url: string;
  snippet: string;
}
export interface Model {
  name: string;
  size?: number;
}
export interface GenerationStats {
  model: string;
  eval_count?: number;
  eval_duration?: number;
  total_duration?: number;
  prompt_eval_duration?: number;
}
export interface GenerationInput {
  query: string;
  sources: Source[];
}
export interface AppError {
  code: string;
  message: string;
}
