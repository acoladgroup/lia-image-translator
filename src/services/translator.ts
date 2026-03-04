import { Model, TranslationResult } from './models';

export type { TranslationResult };

let authToken = '';
let onAuthExpired: (() => void) | null = null;

export function setAuthToken(token: string) {
  authToken = token;
}

export function setOnAuthExpired(cb: () => void) {
  onAuthExpired = cb;
}

function handleResponse(response: Response) {
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    authToken = '';
    onAuthExpired?.();
    throw new Error('Session expired — please log in again.');
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return headers;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function detectLanguage(file: File): Promise<string> {
  const base64Data = await fileToBase64(file);

  const response = await fetch('/api/detect', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ base64Data, mimeType: file.type }),
  });

  handleResponse(response);

  if (!response.ok) {
    throw new Error('Language detection failed');
  }

  const data = await response.json();
  return data.language || 'Unknown';
}

export async function translateImage(
  file: File,
  sourceLang: string,
  targetLang: string,
  model: Model
): Promise<TranslationResult> {
  try {
    const base64Data = await fileToBase64(file);

    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        base64Data,
        mimeType: file.type,
        sourceLang,
        targetLang,
        modelId: model.id,
        provider: model.provider,
      }),
    });

    handleResponse(response);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Translation request failed with status ${response.status}`);
    }

    const responseData = await response.json();

    if (!responseData.imageUrl) {
      throw new Error('No image returned from the backend.');
    }

    return {
      modelId: model.id,
      modelName: model.name,
      content: responseData.imageUrl,
      type: 'image',
      cost: responseData.cost,
      usage: responseData.usage,
      detectedLang: responseData.detectedLang,
    };

  } catch (err: any) {
    return {
      modelId: model.id,
      modelName: model.name,
      content: '',
      type: 'image',
      error: err.message || 'Failed to translate image.',
    };
  }
}
