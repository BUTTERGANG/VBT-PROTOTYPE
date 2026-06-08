// src/routes/athletes.ts

import { Router, Response } from 'express';
import sql from '../db/pool';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';

export const router = Router();

// GET /api/athletes — list athletes belonging to the authenticated user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await sql`
      SELECT * FROM athletes WHERE user_id = ${req.user!.id} ORDER BY created_at DESC
    `;
    res.json(result);
  } catch (error) {
    console.error('Error fetching athletes:', error);
    res.status(500).json({ error: 'Failed to fetch athletes' });
  }
});

// POST /api/athletes — create athlete scoped to authenticated user
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, bodyweight, primary_lifts, baseline_velocity, fatigue_threshold } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = uuidv4();
    const result = await sql`
      INSERT INTO athletes (id, user_id, name, bodyweight, primary_lifts, baseline_velocity, fatigue_threshold)
      VALUES (
        ${id},
        ${req.user!.id},
        ${name},
        ${bodyweight},
        ${primary_lifts || []},
        ${baseline_velocity},
        ${fatigue_threshold || 0.15}
      )
      RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating athlete:', error);
    res.status(500).json({ error: 'Failed to create athlete' });
  }
});

// PUT /api/athletes/:id — update own athlete
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, bodyweight, primary_lifts, baseline_velocity, fatigue_threshold } = req.body;
    const result = await sql`
      UPDATE athletes SET
        name = ${name},
        bodyweight = ${bodyweight},
        primary_lifts = ${primary_lifts},
        baseline_velocity = ${baseline_velocity},
        fatigue_threshold = ${fatigue_threshold},
        updated_at = NOW()
      WHERE id = ${req.params.id} AND user_id = ${req.user!.id}
      RETURNING *
    `;
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Athlete not found' });
    }
    res.json(result[0]);
  } catch (error) {
    console.error('Error updating athlete:', error);
    res.status(500).json({ error: 'Failed to update athlete' });
  }
});

// DELETE /api/athletes/:id — delete own athlete
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await sql`
      DELETE FROM athletes WHERE id = ${req.params.id} AND user_id = ${req.user!.id} RETURNING *
    `;
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Athlete not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting athlete:', error);
    res.status(500).json({ error: 'Failed to delete athlete' });
  }
});
