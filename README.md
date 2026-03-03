# Image Translator

Translate text in images using AI models (Google Gemini, OpenRouter/GPT). Password-protected, with auto language detection and multi-model comparison.

## Run Locally

**Prerequisites:** Node.js, pnpm, [Railway CLI](https://docs.railway.com/cli)

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Link to your Railway project (first time only):
   ```bash
   railway login
   railway link
   ```

3. Start the dev server:
   ```bash
   railway run pnpm dev
   ```
   Runs the Express server with Vite HMR at http://localhost:3000 (frontend + API). Environment variables are pulled from Railway.

   **Without Railway CLI:** Create a `.env` file with your keys and run `pnpm dev` directly.

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `ACCESS_PASSWORD` | Shared password to protect access (optional — if unset, no login required) |

## Deploy to Railway

1. Push your code to GitHub.

2. Create a new project at [railway.app](https://railway.app) and connect your repo.

3. Add environment variables in the Railway dashboard (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `ACCESS_PASSWORD`).

4. Set the build and start commands (Settings → Build):
   - **Build:** `pnpm install && pnpm build`
   - **Start:** `pnpm start`

5. Deploy. Railway builds the frontend, then runs the Express server. No timeout limits.

## Deploy to Vercel

1. Push your code to GitHub.

2. Import the project at [vercel.com/new](https://vercel.com/new).

3. Set environment variables in the Vercel dashboard (Settings → Environment Variables).

4. Deploy. Vercel builds the frontend from `dist/` and serves `api/*.ts` as serverless functions (60s timeout on Hobby plan).
