import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 15,
};

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
            { text: 'What language is the text in this image written in? Reply with ONLY the language name in English (e.g. "French", "Japanese", "Arabic"). If multiple languages, reply with the dominant one.' },
          ],
        },
      ],
    });

    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    const language = raw.replace(/[."']/g, '').trim() || 'Unknown';

    return res.status(200).json({ language });
  } catch (error: any) {
    console.error('Detection error:', error);
    return res.status(500).json({ error: error.message || 'Failed to detect language' });
  }
}
