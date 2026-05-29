// src/routes/programs.ts

import { Router, Request, Response } from 'express';
import sql from '../db/pool';
import { v4 as uuidv4 } from 'uuid';

export const router = Router();

// GET /api/programs?athlete_id=&active=
router.get('/', async (req: Request, res: Response) => {
  try {
    const athleteId = req.query.athlete_id as string | undefined;
    const activeOnly = req.query.active === 'true';

    let query = sql`SELECT * FROM programs`;
    const conditions: string[] = [];

    if (athleteId) {
      query = sql`${query} WHERE athlete_id = ${athleteId}`;
    }
    if (activeOnly) {
      query = athleteId
        ? sql`${query} AND is_active = true`
        : sql`${query} WHERE is_active = true`;
    }
    query = sql`${query} ORDER BY created_at DESC`;

    const result = await query;
    res.json(result);
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

// GET /api/programs/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await sql`SELECT * FROM programs WHERE id = ${req.params.id}`;
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching program:', error);
    res.status(500).json({ error: 'Failed to fetch program' });
  }
});

// POST /api/programs
router.post('/', async (req: Request, res: Response) => {
  try {
    const { athlete_id, name, description, weeks, start_date, end_date } = req.body;
    const id = uuidv4();
    const result = await sql`
      INSERT INTO programs (id, athlete_id, name, description, weeks, start_date, end_date)
      VALUES (${id}, ${athlete_id}, ${name}, ${description}, ${weeks || []}, ${start_date}, ${end_date})
      RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating program:', error);
    res.status(500).json({ error: 'Failed to create program' });
  }
});

// PUT /api/programs/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, weeks, start_date, end_date, is_active } = req.body;
    const result = await sql`
      UPDATE programs SET
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        weeks = COALESCE(${weeks}, weeks),
        start_date = COALESCE(${start_date}, start_date),
        end_date = COALESCE(${end_date}, end_date),
        is_active = COALESCE(${is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.json(result[0]);
  } catch (error) {
    console.error('Error updating program:', error);
    res.status(500).json({ error: 'Failed to update program' });
  }
});

// DELETE /api/programs/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await sql`DELETE FROM programs WHERE id = ${req.params.id} RETURNING *`;
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting program:', error);
    res.status(500).json({ error: 'Failed to delete program' });
  }
});
