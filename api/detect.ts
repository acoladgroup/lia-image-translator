import { GoogleGenAI } from '@google/genai';
import { checkAuth } from './_auth.ts';

export const config = {
  maxDuration: 15,
};

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
    const { base64Data, mimeType } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            {
              text: [
                'Analyse this image and reply with a single JSON object (no markdown, no extra text) with exactly these fields:',
                '  "language": the dominant language of the text in English (e.g. "French"), or "None" if there is no text,',
                '  "quality": one of "good", "poor", or "none" — good means text is clearly legible and the image is suitable for translation; poor means the image has issues that will likely hurt translation quality (blurry, low-res, heavily obscured, skewed, overexposed, etc.); none means there is no translatable text,',
                '  "reason": a short human-readable explanation only when quality is "poor" or "none", otherwise null.',
                'Example: {"language":"Japanese","quality":"good","reason":null}',
              ].join(' '),
            },
          ],
        },
      ],
    });

    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    let language = 'Unknown';
    let quality: 'good' | 'poor' | 'none' = 'good';
    let reason: string | null = null;

    try {
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
      language = String(json.language || 'Unknown').replace(/[."']/g, '').trim() || 'Unknown';
      quality = ['good', 'poor', 'none'].includes(json.quality) ? json.quality : 'good';
      reason = json.reason ?? null;
    } catch {
      language = raw.replace(/[."']/g, '').trim() || 'Unknown';
    }

    return res.status(200).json({ language, quality, reason });
  } catch (error: any) {
    console.error('Detection error:', error);
    return res.status(500).json({ error: error.message || 'Failed to detect language' });
  }
}
