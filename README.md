# Image Translator

Translate text in images using AI models (Google Gemini, OpenRouter/GPT).

## Run Locally

**Prerequisites:** Node.js, pnpm

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Create `.env` (or `.env.local`) with your API keys:
   ```
   GEMINI_API_KEY=your-key
   OPENROUTER_API_KEY=your-key
   ```

3. Start the dev server:
   ```bash
   pnpm dev:server
   ```
   Runs the Express server with Vite at http://localhost:3000 (frontend + API).

   **Alternative (Vercel CLI):** `npx vercel dev` if you have the Vercel CLI installed.

## Deploy to Railway

1. Push your code to GitHub.

2. Create a new project at [railway.app](https://railway.app) and connect your repo.

3. Add environment variables in the Railway dashboard:
   - `GEMINI_API_KEY`
   - `OPENROUTER_API_KEY`

4. Set the build and start commands in Railway (Settings → Build):
   - **Build:** `pnpm install && pnpm build`
   - **Start:** `pnpm start`

5. Deploy. Railway builds the frontend, then runs the Express server. No timeout limits.

## Deploy to Vercel

1. Push your code to GitHub.

2. Import the project at [vercel.com/new](https://vercel.com/new).

3. Set environment variables in the Vercel dashboard (Settings → Environment Variables):
   - `GEMINI_API_KEY`
   - `OPENROUTER_API_KEY`

4. Deploy. Vercel builds the frontend from `dist/` and serves `api/translate.ts` as a serverless function (60s timeout on Hobby plan).
