// src/index.ts

import express from 'express';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';

import { router as sessionRoutes } from './routes/sessions';
import { router as athleteRoutes } from './routes/athletes';
import { router as syncRoutes } from './routes/sync';
import { router as programRoutes } from './routes/programs';
import { router as analyticsRoutes } from './routes/analytics';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// --- Middleware ---

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Global JSON parse error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }
  next(err);
});

// --- Health check ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API Routes ---

app.use('/api/sessions', sessionRoutes);
app.use('/api/athletes', athleteRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/analytics', analyticsRoutes);

// --- Static file serving (production only) ---

// In production, serve the built PWA from dist/
if (process.env.NODE_ENV === 'production') {
  const pwaDist = path.join(__dirname, '../../pwa/dist');
  app.use(express.static(pwaDist));
  // Catch-all: serve index.html for SPA routing (must be after API routes)
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(pwaDist, 'index.html'));
  });
}

// --- Graceful shutdown ---

let server: ReturnType<typeof app.listen> | null = null;

server = app.listen(PORT, () => {
  console.log(`VBT Tracker API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

const shutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server?.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // Force exit after 10s if close hangs
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
