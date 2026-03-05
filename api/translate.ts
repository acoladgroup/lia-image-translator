import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { checkAuth } from './_auth.ts';

export const config = {
  maxDuration: 60,
};

// Pricing per million tokens (USD) — update when Google changes prices
// outputImage: image generation tokens rate; outputText: same as base model text output rate
const GOOGLE_PRICING: Record<string, { input: number; outputText: number; outputImage: number }> = {
  'gemini-3.1-flash-image-preview': { input: 0.50, outputText: 3.00,  outputImage: 60.00  },
  'gemini-3-pro-image-preview':     { input: 2.00, outputText: 12.00, outputImage: 120.00 },
  'gemini-2.5-flash-image':         { input: 0.30, outputText: 3.50,  outputImage: 30.00  },
};

async function detectLanguage(ai: InstanceType<typeof GoogleGenAI>, base64Data: string, mimeType: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: 'What language is the text in this image written in? Reply with ONLY the language name in English (e.g. "French", "Japanese", "Arabic"). If multiple languages, reply with the dominant one.' },
        ],
      },
    ],
  });
  const raw = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  return raw.replace(/[."']/g, '').trim() || 'Unknown';
}

function estimateGoogleCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): { inputCost: number; outputCost: number; totalCost: number } | undefined {
  const pricing = GOOGLE_PRICING[modelId];
  if (!pricing) return undefined;
  const inputCost = (promptTokens * pricing.input) / 1_000_000;
  const outputCost = (completionTokens * pricing.outputImage) / 1_000_000;
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, totalCost };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { base64Data, mimeType, sourceLang, targetLang, modelId, provider } = req.body;

    if (!base64Data || !mimeType || !targetLang || !modelId || !provider) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    let detectedLang: string | undefined;
    let resolvedSourceLang = sourceLang;
    if (!sourceLang || sourceLang === 'Auto-detect') {
      detectedLang = await detectLanguage(getAI(), base64Data, mimeType);
      resolvedSourceLang = detectedLang;
    }

    const prompt = [
      `Generate a new version of this image where every piece of visible text has been translated from ${resolvedSourceLang} to ${targetLang}.`,
      'Translate all text regardless of type: printed, handwritten, typed, stamped, watermarked, titles, headers, labels, captions, footnotes, form fields, and margin notes.',
      'Keep the entire visual layout exactly as-is: same background, colors, fonts, font sizes, positions, and all non-text elements.',
      'Change only the text content to its translation — everything else stays identical.',
      'If a word is illegible, keep it as-is.',
      'Output only the translated image.',
    ].join(' ');

    let imageUrl = '';

    if (provider === 'google') {
      const ai = getAI();
      const contentParts = [
        { inlineData: { data: base64Data, mimeType } },
        { text: prompt },
      ];

      const attempts = [
        { modalities: ["TEXT", "IMAGE"], promptText: prompt },
        { modalities: ["IMAGE"], promptText: `Generate this image with all text translated from ${resolvedSourceLang} to ${targetLang}. Preserve the original layout, background, and visual style exactly. Only the text changes.` },
        { modalities: ["TEXT", "IMAGE"], promptText: `Translate text from ${resolvedSourceLang} to ${targetLang} in this image. Keep the layout unchanged.` },
      ];

      let response: any = null;
      let lastError = '';

      for (const attempt of attempts) {
        try {
          response = await ai.models.generateContent({
            model: modelId,
            contents: [{ role: 'user', parts: [contentParts[0], { text: attempt.promptText }] }],
            config: {
              responseModalities: attempt.modalities,
              safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              ],
            },
          });

          const blockReason = (response as any).promptFeedback?.blockReason;
          if (blockReason) {
            lastError = `Request blocked by Google safety filter: ${blockReason}`;
            response = null;
            continue;
          }

          const parts = response.candidates?.[0]?.content?.parts || [];
          if (parts.some((p: any) => p.inlineData)) break;

          const textFallback = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ?? '';
          lastError = `No image (finishReason: ${response.candidates?.[0]?.finishReason ?? 'none'})`;
          if (textFallback) console.warn(`[translate] Model returned text instead of image: ${textFallback.slice(0, 200)}`);
          response = null;
        } catch (e: any) {
          lastError = e.message;
          response = null;
        }
      }

      if (!response) {
        throw new Error(`Failed after ${attempts.length} attempts: ${lastError}`);
      }

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        throw new Error('No image in response after retries. The model may not support this content.');
      }

      const usage = (response as any).usageMetadata;
      const promptTokens = usage?.promptTokenCount ?? 0;
      const completionTokens = usage?.candidatesTokenCount ?? 0;
      const costBreakdown = estimateGoogleCost(modelId, promptTokens, completionTokens);

      return res.status(200).json({
        imageUrl,
        detectedLang,
        cost: costBreakdown ? costBreakdown.totalCost.toFixed(5) : 'Free tier',
        inputCost: costBreakdown ? costBreakdown.inputCost.toFixed(5) : undefined,
        outputCost: costBreakdown ? costBreakdown.outputCost.toFixed(5) : undefined,
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
        detectedLang,
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
