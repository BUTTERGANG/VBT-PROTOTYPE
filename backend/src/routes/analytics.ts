// src/routes/analytics.ts

import { Router, Request, Response } from 'express';
import sql from '../db/pool';

export const router = Router();

// GET /api/analytics/dashboard?athlete_id=&days=30
// Dashboard summary: recent velocity trends, zone distribution, fatigue alerts
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const athleteId = req.query.athlete_id as string | undefined;
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Velocity trend: avg mean_velocity per session, by exercise
    const velocityTrend = await sql`
      SELECT 
        s.exercise,
        DATE(s.start_time) as session_date,
        AVG(r.mean_velocity) as avg_velocity,
        MAX(r.peak_velocity) as max_peak,
        COUNT(r.id) as total_reps
      FROM sessions s
      JOIN sets st ON st.session_id = s.id
      JOIN reps r ON r.set_id = st.id
      WHERE s.start_time >= ${since}
      ${athleteId ? sql`AND s.athlete_id = ${athleteId}` : sql``}
      GROUP BY s.exercise, DATE(s.start_time)
      ORDER BY session_date ASC
    `;

    // Zone distribution: % IN_RANGE / FAST / SLOW across all recent sessions
    const zoneDistribution = await sql`
      SELECT
        r.zone_result,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
      FROM reps r
      JOIN sets st ON st.id = r.set_id
      JOIN sessions s ON s.id = st.session_id
      WHERE s.start_time >= ${since}
      ${athleteId ? sql`AND s.athlete_id = ${athleteId}` : sql``}
      GROUP BY r.zone_result
    `;

    // Fatigue alerts: sessions where velocity dropped > threshold within a set
    const fatigueAlerts = await sql`
      SELECT
        s.id as session_id,
        s.exercise,
        s.start_time,
        s.fatigue_flag,
        s.autoreg_score,
        st.set_number,
        MIN(r.mean_velocity) as min_set_velocity,
        MAX(r.mean_velocity) as max_set_velocity,
        CASE WHEN MAX(r.mean_velocity) > 0 
          THEN ROUND(((MAX(r.mean_velocity) - MIN(r.mean_velocity)) / MAX(r.mean_velocity))::numeric, 3)
          ELSE 0 
        END as velocity_drop_pct
      FROM sessions s
      JOIN sets st ON st.session_id = s.id
      JOIN reps r ON r.set_id = st.id
      WHERE s.start_time >= ${since}
      ${athleteId ? sql`AND s.athlete_id = ${athleteId}` : sql``}
      GROUP BY s.id, s.exercise, s.start_time, s.fatigue_flag, s.autoreg_score, st.set_number
      HAVING COUNT(r.id) > 1
      ORDER BY s.start_time DESC
      LIMIT 20
    `;

    // Program adherence: sessions completed vs planned (if program assigned)
    const programAdherence = await sql`
      SELECT
        p.name as program_name,
        COUNT(s.id) as sessions_completed,
        p.start_date,
        p.end_date,
        p.is_active
      FROM programs p
      LEFT JOIN sessions s ON s.program_id = p.id
      WHERE p.athlete_id = ${athleteId || null}
      GROUP BY p.id, p.name, p.start_date, p.end_date, p.is_active
      ORDER BY p.created_at DESC
      LIMIT 5
    `;

    res.json({
      velocity_trend: velocityTrend,
      zone_distribution: zoneDistribution,
      fatigue_alerts: fatigueAlerts,
      program_adherence: programAdherence,
      period_days: days,
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

// GET /api/analytics/history?athlete_id=&exercise=&from=&to=&limit=&offset=
// Paginated session history with filters
router.get('/history', async (req: Request, res: Response) => {
  try {
    const athleteId = req.query.athlete_id as string | undefined;
    const exercise = req.query.exercise as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await sql`
      SELECT
        s.id,
        s.exercise,
        s.start_time,
        s.end_time,
        s.fatigue_flag,
        s.autoreg_score,
        s.tags,
        a.name as athlete_name,
        p.name as program_name,
        COALESCE(json_agg(
          json_build_object(
            'set_number', st.set_number,
            'reps', (
              SELECT json_agg(
                json_build_object(
                  'rep_number', r.rep_number,
                  'mean_velocity', r.mean_velocity,
                  'peak_velocity', r.peak_velocity,
                  'zone_result', r.zone_result
                ) ORDER BY r.rep_number
              )
              FROM reps r WHERE r.set_id = st.id
            )
          ) ORDER BY st.set_number
        ) FILTER (WHERE st.id IS NOT NULL), '[]'::json) as sets,
        (SELECT COUNT(*) FROM reps r2 JOIN sets st2 ON st2.id = r2.set_id WHERE st2.session_id = s.id) as total_reps,
        (SELECT AVG(r3.mean_velocity) FROM reps r3 JOIN sets st3 ON st3.id = r3.set_id WHERE st3.session_id = s.id) as avg_velocity
      FROM sessions s
      LEFT JOIN athletes a ON a.id = s.athlete_id
      LEFT JOIN programs p ON p.id = s.program_id
      LEFT JOIN sets st ON st.session_id = s.id
      WHERE 1=1
      ${athleteId ? sql`AND s.athlete_id = ${athleteId}` : sql``}
      ${exercise ? sql`AND s.exercise ILIKE ${'%' + exercise + '%'}` : sql``}
      ${from ? sql`AND s.start_time >= ${from}` : sql``}
      ${to ? sql`AND s.start_time <= ${to}` : sql``}
      GROUP BY s.id, s.exercise, s.start_time, s.end_time, s.fatigue_flag, s.autoreg_score, s.tags, a.name, p.name
      ORDER BY s.start_time DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    res.json({
      sessions: result,
      pagination: { limit, offset, count: result.length },
    });
  } catch (error) {
    console.error('Error fetching session history:', error);
    res.status(500).json({ error: 'Failed to fetch session history' });
  }
});

// POST /api/analytics/autoregulate
// Receives session data and returns autoregulation recommendations
// Delegates to Python FastAPI service
router.post('/autoregulate', async (req: Request, res: Response) => {
  try {
    const { athlete_id, session_data } = req.body;

    // Call Python FastAPI autoregulation service
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    const response = await fetch(`${fastApiUrl}/api/autoregulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athlete_id, session_data }),
    });

    if (!response.ok) {
      throw new Error(`FastAPI returned ${response.status}`);
    }

    const recommendations = await response.json();
    res.json(recommendations);
  } catch (error) {
    console.error('Autoregulation error:', error);
    // Fallback: return a basic recommendation
    res.json({
      recommendation: 'continue',
      confidence: 0.5,
      message: 'Autoregulation service unavailable. Proceed with planned program.',
    });
  }
});
