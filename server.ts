import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import detectHandler from './api/detect.ts';
import translateHandler from './api/translate.ts';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';
const app = express();

app.use(express.json({ limit: '50mb' }));

app.post('/api/detect', (req, res) => detectHandler(req, res));
app.post('/api/translate', (req, res) => translateHandler(req, res));

const port = Number(process.env.PORT) || 3000;

async function start() {
  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port} (${isDev ? 'dev' : 'production'})`);
  });
}

start();
