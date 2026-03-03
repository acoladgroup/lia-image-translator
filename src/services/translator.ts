import { Model, TranslationResult } from './models';

export type { TranslationResult };

export async function translateImage(
  file: File, 
  sourceLang: string, 
  targetLang: string,
  model: Model
): Promise<TranslationResult> {
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    };

  } catch (err: any) {
    return {
      modelId: model.id,
      modelName: model.name,
      content: '',
      type: 'image',
      error: err.message || 'Failed to translate image.'
    };
  }
}


