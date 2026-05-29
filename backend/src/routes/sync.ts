// src/routes/sync.ts

import { Router, Request, Response } from 'express';
import sql from '../db/pool';
import { v4 as uuidv4 } from 'uuid';

export const router = Router();

// POST /api/sync/batch
// Batch upload of cached readings from local storage
// Note: Neon serverless doesn't support multi-statement transactions.
// We execute queries sequentially and track counts for best-effort sync.
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { sessions, readings } = req.body;
    let sessionsSynced = 0;
    let readingsSynced = 0;

    // Upsert sessions
    for (const session of sessions || []) {
      try {
        await sql`
          INSERT INTO sessions (id, athlete_id, exercise, start_time, end_time)
          VALUES (
            ${session.id},
            ${session.athleteId},
            ${session.exercise},
            ${new Date(session.startTime).toISOString()},
            ${session.endTime ? new Date(session.endTime).toISOString() : null}
          )
          ON CONFLICT (id) DO UPDATE SET end_time = EXCLUDED.end_time
        `;
        sessionsSynced++;
      } catch (err) {
        console.error(`Failed to sync session ${session.id}:`, err);
      }
    }

    // Group readings by rep
    const readingsByRep: Record<string, any[]> = {};
    for (const r of readings || []) {
      const key = `${r.sessionId}_${r.setNumber}_${r.repNumber}`;
      if (!readingsByRep[key]) readingsByRep[key] = [];
      readingsByRep[key].push(r);
    }

    // Process each rep's readings
    for (const [, repReadings] of Object.entries(readingsByRep)) {
      if (repReadings.length === 0) continue;
      const first = repReadings[0];

      try {
        // Find or create set
        let setId: string;
        const setResult = await sql`
          INSERT INTO sets (id, session_id, set_number, exercise)
          VALUES (${uuidv4()}, ${first.sessionId}, ${first.setNumber}, ${first.exercise || 'Squat'})
          ON CONFLICT DO NOTHING
          RETURNING id
        `;

        if (setResult.length > 0) {
          setId = setResult[0].id;
        } else {
          const existing = await sql`
            SELECT id FROM sets WHERE session_id = ${first.sessionId} AND set_number = ${first.setNumber}
          `;
          setId = existing[0].id;
        }

        // Find or create rep
        let repId: string;
        const repResult = await sql`
          INSERT INTO reps (id, set_id, rep_number, mean_velocity, peak_velocity, zone_result)
          VALUES (${uuidv4()}, ${setId}, ${first.repNumber}, 0, 0, 'IN_RANGE')
          ON CONFLICT DO NOTHING
          RETURNING id
        `;

        if (repResult.length > 0) {
          repId = repResult[0].id;
        } else {
          const existing = await sql`
            SELECT id FROM reps WHERE set_id = ${setId} AND rep_number = ${first.repNumber}
          `;
          repId = existing[0].id;
        }

        // Insert all velocity readings for this rep
        for (const reading of repReadings) {
          try {
            await sql`
              INSERT INTO velocity_readings (id, rep_id, timestamp, velocity, source)
              VALUES (${uuidv4()}, ${repId}, ${reading.timestamp}, ${reading.velocity}, ${reading.source || 'ble'})
              ON CONFLICT DO NOTHING
            `;
            readingsSynced++;
          } catch (err) {
            console.error(`Failed to sync reading:`, err);
          }
        }

        // Update rep with calculated stats
        const velocities = repReadings.map((r: any) => r.velocity);
        const meanVel = velocities.reduce((a: number, b: number) => a + b, 0) / velocities.length;
        const peakVel = Math.max(...velocities);
        const zone = meanVel > 0.85 ? 'FAST' : meanVel > 0.75 ? 'IN_RANGE' : 'SLOW';

        await sql`
          UPDATE reps SET mean_velocity = ${meanVel.toFixed(3)}, peak_velocity = ${peakVel.toFixed(3)}, zone_result = ${zone}
          WHERE id = ${repId}
        `;
      } catch (err) {
        console.error(`Failed to sync rep:`, err);
      }
    }

    res.json({ success: true, sessionsSynced, readingsSynced });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});
