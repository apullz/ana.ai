export type ModelID = 'gemini-2.5-flash';

export interface TranscriptionEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ModelConfig {
  id: ModelID;
  name: string;
  provider: 'google';
}