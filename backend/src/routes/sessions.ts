// src/routes/sessions.ts

import { Router, Request, Response } from 'express';
import sql from '../db/pool';
import { v4 as uuidv4 } from 'uuid';

export const router = Router();

// GET /api/sessions?athlete_id=&limit=&offset=
router.get('/', async (req: Request, res: Response) => {
  try {
    const athleteId = req.query.athlete_id as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await sql`
      SELECT s.*, 
        json_agg(
          json_build_object(
            'id', st.id,
            'set_number', st.set_number,
            'exercise', st.exercise,
            'target_velocity', st.target_velocity,
            'reps', (
              SELECT json_agg(
                json_build_object(
                  'id', r.id,
                  'rep_number', r.rep_number,
                  'mean_velocity', r.mean_velocity,
                  'peak_velocity', r.peak_velocity,
                  'zone_result', r.zone_result
                ) ORDER BY r.rep_number
              )
              FROM reps r WHERE r.set_id = st.id
            )
          ) ORDER BY st.set_number
        ) FILTER (WHERE st.id IS NOT NULL) as sets
      FROM sessions s
      LEFT JOIN sets st ON st.session_id = s.id
      ${athleteId ? sql`WHERE s.athlete_id = ${athleteId}` : sql``}
      GROUP BY s.id
      ORDER BY s.start_time DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    res.json(result);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await sql`
      SELECT s.*, 
        json_agg(
          json_build_object(
            'id', st.id,
            'set_number', st.set_number,
            'reps', (
              SELECT json_agg(
                json_build_object(
                  'id', r.id,
                  'rep_number', r.rep_number,
                  'mean_velocity', r.mean_velocity,
                  'peak_velocity', r.peak_velocity,
                  'zone_result', r.zone_result,
                  'readings', (
                    SELECT json_agg(
                      json_build_object(
                        'timestamp', vr.timestamp,
                        'velocity', vr.velocity
                      ) ORDER BY vr.timestamp
                    )
                    FROM velocity_readings vr WHERE vr.rep_id = r.id
                  )
                ) ORDER BY r.rep_number
              )
              FROM reps r WHERE r.set_id = st.id
            )
          ) ORDER BY st.set_number
        ) FILTER (WHERE st.id IS NOT NULL) as sets
      FROM sessions s
      LEFT JOIN sets st ON st.session_id = s.id
      WHERE s.id = ${req.params.id}
      GROUP BY s.id
    `;
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// POST /api/sessions
router.post('/', async (req: Request, res: Response) => {
  try {
    const { athlete_id, exercise, start_time } = req.body;
    const id = uuidv4();
    const result = await sql`
      INSERT INTO sessions (id, athlete_id, exercise, start_time)
      VALUES (${id}, ${athlete_id}, ${exercise}, ${start_time || new Date().toISOString()})
      RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// PUT /api/sessions/:id/end
router.put('/:id/end', async (req: Request, res: Response) => {
  try {
    const result = await sql`
      UPDATE sessions SET end_time = NOW() WHERE id = ${req.params.id} RETURNING *
    `;
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(result[0]);
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// GET /api/sessions/:id/analytics
router.get('/:id/analytics', async (req: Request, res: Response) => {
  try {
    const result = await sql`
      SELECT 
        COUNT(DISTINCT st.id) as total_sets,
        COUNT(r.id) as total_reps,
        AVG(r.mean_velocity) as avg_velocity,
        MAX(r.peak_velocity) as max_velocity,
        MIN(r.mean_velocity) as min_velocity,
        STDDEV(r.mean_velocity) as velocity_stddev,
        SUM(CASE WHEN r.zone_result = 'IN_RANGE' THEN 1 ELSE 0 END) as reps_in_zone,
        SUM(CASE WHEN r.zone_result = 'FAST' THEN 1 ELSE 0 END) as reps_too_fast,
        SUM(CASE WHEN r.zone_result = 'SLOW' THEN 1 ELSE 0 END) as reps_too_slow
      FROM sessions s
      LEFT JOIN sets st ON st.session_id = s.id
      LEFT JOIN reps r ON r.set_id = st.id
      WHERE s.id = ${req.params.id}
      GROUP BY s.id
    `;
    res.json(result[0] || {});
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
