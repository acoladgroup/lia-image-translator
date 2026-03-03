export type ModelProvider = 'google' | 'openrouter';

export interface Model {
  id: string;
  name: string;
  provider: ModelProvider;
  type: 'image';
}

export const MODELS: Model[] = [
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Gemini 3.1 Flash Image',
    provider: 'google',
    type: 'image',
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Gemini 3 Pro Image',
    provider: 'google',
    type: 'image',
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Gemini 2.5 Flash Image',
    provider: 'google',
    type: 'image',
  },
  {
    id: 'openai/gpt-5-image-mini',
    name: 'GPT-5 Image Mini',
    provider: 'openrouter',
    type: 'image',
  },
  {
    id: 'openai/gpt-5-image',
    name: 'GPT-5 Image',
    provider: 'openrouter',
    type: 'image',
  },
];

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TranslationResult {
  modelId: string;
  modelName: string;
  content: string; // Base64 image
  type: 'image';
  cost?: string | number;
  usage?: TokenUsage;
  error?: string;
}
