import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 60,
};

// Pricing per million tokens (USD) — update when Google changes prices
const GOOGLE_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-3.1-flash-image-preview': { input: 0.50, output: 60.00 },
  'gemini-3-pro-image-preview':     { input: 2.00, output: 120.00 },
  'gemini-2.5-flash-image':         { input: 0.30, output: 30.00 },
};

function estimateGoogleCost(modelId: string, promptTokens: number, completionTokens: number): string | undefined {
  const pricing = GOOGLE_PRICING[modelId];
  if (!pricing) return undefined;
  const cost = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
  return cost.toFixed(5);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data, mimeType, sourceLang, targetLang, modelId, provider } = req.body;

    if (!base64Data || !mimeType || !targetLang || !modelId || !provider) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const prompt = `You are an expert image translator. Translate EVERY single piece of text in this image ${
      sourceLang !== 'Auto-detect' ? `from ${sourceLang} ` : ''
    }to ${targetLang}. This includes titles, subtitles, body text, labels, small print, and background text. Return a new image that is visually identical to the original but with ALL text replaced by the translation. Preserve the original layout, fonts, colors, formatting, and positioning exactly. Do not leave any original text untranslated. Only change the language of the text.`;

    let imageUrl = '';

    if (provider === 'google') {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

      const response = await ai.models.generateContent({
        model: modelId,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
              { text: prompt },
            ],
          }
        ],
        config: {
          responseModalities: ["IMAGE"],
        }
      });

      let foundImage = false;
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        console.error('Model returned parts:', JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
        throw new Error('No image returned from the model. The model might have returned text instead.');
      }

      const usage = (response as any).usageMetadata;
      const promptTokens = usage?.promptTokenCount ?? 0;
      const completionTokens = usage?.candidatesTokenCount ?? 0;

      return res.status(200).json({
        imageUrl,
        cost: estimateGoogleCost(modelId, promptTokens, completionTokens) ?? 'Free tier',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
      });

    } else if (provider === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not configured.');
      }

      const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://image-translator.vercel.app',
          'X-Title': 'ImageTranslator',
        },
        body: JSON.stringify({
          model: modelId,
          modalities: ['image', 'text'],
          max_tokens: 8192,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      const json = await orResponse.json();

      if (!orResponse.ok) {
        const errMsg = json?.error?.message || JSON.stringify(json?.error) || `OpenRouter returned ${orResponse.status}`;
        throw new Error(errMsg);
      }

      const choice = json.choices?.[0];
      const cost = json.usage?.cost;
      let foundImage = false;

      // Check for images array (OpenRouter's image generation response format)
      const images = choice?.message?.images;
      if (images?.length) {
        imageUrl = images[0].image_url?.url || images[0].url || '';
        if (imageUrl) foundImage = true;
      }

      // Fallback: check message content for inline base64 data URL
      if (!foundImage) {
        const content = choice?.message?.content || '';
        const match = content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/);
        if (match?.[1]) {
          imageUrl = match[1];
          foundImage = true;
        }
      }

      if (!foundImage) {
        console.error('OpenRouter full response:', JSON.stringify(json, null, 2));
        throw new Error('No image returned from OpenRouter. The model may not support image generation.');
      }

      const usage = json.usage;

      return res.status(200).json({
        imageUrl,
        cost: cost != null ? Number(cost).toFixed(5) : undefined,
        usage: {
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
      });

    } else {
      return res.status(400).json({ error: 'Unsupported provider' });
    }

  } catch (error: any) {
    console.error('Translation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to translate image' });
  }
}
