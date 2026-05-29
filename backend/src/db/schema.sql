-- VBT Tracker PostgreSQL Schema v2
-- Compatible with Neon (https://neon.tech)
-- Adds: programs, session indexes for history/dashboard queries, autoregulation support

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Athletes
CREATE TABLE IF NOT EXISTS athletes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    bodyweight DECIMAL(5,2),
    primary_lifts TEXT[] DEFAULT '{}',
    -- Autoregulation baseline
    baseline_velocity DECIMAL(5,3),       -- athlete's typical mean velocity for primary lift
    fatigue_threshold DECIMAL(5,3),       -- velocity drop % that triggers fatigue flag (e.g. 0.15 = 15%)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Programs (training programs assigned to athletes)
CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID REFERENCES athletes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Program structure: array of program weeks
    weeks JSONB DEFAULT '[]',
    -- Example week structure:
    -- [{ week: 1, sessions: [{ day: 1, exercise: "Squat", sets: 3, reps: 5, target_velocity: 0.45 }] }]
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions (a workout session)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID REFERENCES athletes(id) ON DELETE SET NULL,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    exercise VARCHAR(100) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    notes TEXT,
    -- Session-level autoregulation result
    autoreg_score DECIMAL(4,3),           -- 0-1 score: how well the session matched targets
    fatigue_flag BOOLEAN DEFAULT false,   -- true if velocity dropped significantly
    tags TEXT[] DEFAULT '{}',             -- e.g. ['meet-prep', 'deload', 'testing']
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sets within a session
CREATE TABLE IF NOT EXISTS sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    exercise VARCHAR(100) NOT NULL,
    target_velocity DECIMAL(4,3),
    tolerance DECIMAL(4,3),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reps within a set
CREATE TABLE IF NOT EXISTS reps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID REFERENCES sets(id) ON DELETE CASCADE,
    rep_number INTEGER NOT NULL,
    mean_velocity DECIMAL(5,3) NOT NULL DEFAULT 0,
    peak_velocity DECIMAL(5,3) NOT NULL DEFAULT 0,
    zone_result VARCHAR(20) NOT NULL DEFAULT 'IN_RANGE' CHECK (zone_result IN ('FAST', 'IN_RANGE', 'SLOW')),
    -- Optional: estimated 1RM from velocity
    estimated_1rm DECIMAL(6,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Individual velocity readings within a rep
CREATE TABLE IF NOT EXISTS velocity_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id UUID REFERENCES reps(id) ON DELETE CASCADE,
    timestamp BIGINT NOT NULL,
    velocity DECIMAL(6,4) NOT NULL,
    source VARCHAR(10) DEFAULT 'ble',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Unique constraints for upsert support (sync endpoint)
-- ============================================================

-- Sets: one set_number per session
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_sets_session_setnum'
  ) THEN
    ALTER TABLE sets ADD CONSTRAINT uq_sets_session_setnum UNIQUE (session_id, set_number);
  END IF;
END$$;

-- Reps: one rep_number per set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_reps_set_repnum'
  ) THEN
    ALTER TABLE reps ADD CONSTRAINT uq_reps_set_repnum UNIQUE (set_id, rep_number);
  END IF;
END$$;

-- ============================================================
-- Indexes for history/dashboard/analytics query patterns
-- ============================================================

-- Session history: filter by athlete + date range
CREATE INDEX IF NOT EXISTS idx_sessions_athlete_date ON sessions(athlete_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_exercise ON sessions(exercise);
CREATE INDEX IF NOT EXISTS idx_sessions_tags ON sessions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_sessions_program ON sessions(program_id);

-- Program lookups
CREATE INDEX IF NOT EXISTS idx_programs_athlete ON programs(athlete_id);
CREATE INDEX IF NOT EXISTS idx_programs_active ON programs(athlete_id, is_active);

-- Analytics: velocity trends over time
CREATE INDEX IF NOT EXISTS idx_reps_zone ON reps(set_id, zone_result);
CREATE INDEX IF NOT EXISTS idx_reps_velocity ON reps(mean_velocity DESC);

-- Existing indexes
CREATE INDEX IF NOT EXISTS idx_sessions_athlete ON sessions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sets_session ON sets(session_id);
CREATE INDEX IF NOT EXISTS idx_reps_set ON reps(set_id);
CREATE INDEX IF NOT EXISTS idx_velocity_readings_rep ON velocity_readings(rep_id);
