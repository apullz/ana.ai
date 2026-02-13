
export type ModelID = 'gemini-2.5-flash' | 'gemma-3-4b';

export interface TranscriptionEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ModelConfig {
  id: ModelID;
  name: string;
  provider: 'google' | 'local';
  huggingFaceId?: string;
}
