-- Migration 001: Add users table and scope athletes to users
-- Run once against your Neon database

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add user_id to athletes (nullable for existing rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE athletes ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX idx_athletes_user ON athletes(user_id);
  END IF;
END$$;
