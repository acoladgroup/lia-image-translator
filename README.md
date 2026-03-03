<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Image Translator

Translate text in images using AI models (Google Gemini, OpenRouter/GPT).

## Run Locally

**Prerequisites:** Node.js, pnpm, [Vercel CLI](https://vercel.com/docs/cli)

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set API keys in `.env.local`:
   ```
   GEMINI_API_KEY=your-key
   OPENROUTER_API_KEY=your-key
   ```

3. Link to a Vercel project (first time only):
   ```bash
   npx vercel link
   ```

4. Start the dev server:
   ```bash
   npx vercel dev
   ```
   This runs the Vite frontend **and** the `/api/translate` serverless function locally at http://localhost:3000.

## Deploy to Vercel

1. Push your code to GitHub.

2. Import the project at [vercel.com/new](https://vercel.com/new).

3. Set environment variables in the Vercel dashboard (Settings → Environment Variables):
   - `GEMINI_API_KEY`
   - `OPENROUTER_API_KEY`

4. Deploy. Vercel builds the frontend from `dist/` and serves `api/translate.ts` as a serverless function.
