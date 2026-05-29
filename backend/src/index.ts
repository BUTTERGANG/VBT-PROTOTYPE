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

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/athletes', athleteRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/analytics', analyticsRoutes);

// In production, serve the built PWA from dist/
if (process.env.NODE_ENV === 'production') {
  const pwaDist = path.join(__dirname, '../../pwa/dist');
  app.use(express.static(pwaDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(pwaDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`VBT Tracker API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
