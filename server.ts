import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import translateHandler from './api/translate.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '50mb' }));

app.post('/api/translate', (req, res) => translateHandler(req, res));

// Serve the built frontend
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
