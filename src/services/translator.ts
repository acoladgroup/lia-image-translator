import { Model, TranslationResult } from './models';

export type { TranslationResult };

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType: file.type }),
  });

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Data,
        mimeType: file.type,
        sourceLang,
        targetLang,
        modelId: model.id,
        provider: model.provider,
      }),
    });

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
