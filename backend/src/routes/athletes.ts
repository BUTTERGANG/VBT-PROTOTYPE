// src/routes/athletes.ts

import { Router, Request, Response } from 'express';
import sql from '../db/pool';
import { v4 as uuidv4 } from 'uuid';

export const router = Router();

// GET /api/athletes
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await sql`SELECT * FROM athletes ORDER BY created_at DESC`;
    res.json(result);
  } catch (error) {
    console.error('Error fetching athletes:', error);
    res.status(500).json({ error: 'Failed to fetch athletes' });
  }
});

// POST /api/athletes
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, bodyweight, primary_lifts, baseline_velocity, fatigue_threshold } = req.body;
    const id = uuidv4();
    const result = await sql`
      INSERT INTO athletes (id, name, bodyweight, primary_lifts, baseline_velocity, fatigue_threshold)
      VALUES (
        ${id},
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

// PUT /api/athletes/:id
router.put('/:id', async (req: Request, res: Response) => {
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
      WHERE id = ${req.params.id}
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

// DELETE /api/athletes/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await sql`DELETE FROM athletes WHERE id=${req.params.id} RETURNING *`;
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Athlete not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting athlete:', error);
    res.status(500).json({ error: 'Failed to delete athlete' });
  }
});
