"""Database schema for vision validation results.

Extends the existing VBT Tracker schema with tables for storing
video clip metadata, frame-level detections, and velocity comparisons.
Run alongside the existing schema.sql — these tables are additive.
"""

VISION_SCHEMA_SQL = """
-- ============================================================
-- Vision Validation Pipeline Schema
-- Additive to existing VBT Tracker schema
-- ============================================================

-- Video clips ingested into the pipeline
CREATE TABLE IF NOT EXISTS vision_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path TEXT NOT NULL,
    exercise VARCHAR(100),
    load_kg DECIMAL(6,2),
    encoder_mean_velocity DECIMAL(5,3),    -- ground truth from encoder (m/s)
    encoder_peak_velocity DECIMAL(5,3),
    camera_distance_m DECIMAL(4,2),        -- approximate camera-to-bar distance
    camera_angle VARCHAR(20) DEFAULT 'side', -- 'side', 'front', 'angled'
    lighting VARCHAR(20) DEFAULT 'good',    -- 'good', 'dim', 'bright', 'mixed'
    frame_width INT,
    frame_height INT,
    fps DECIMAL(5,2),
    duration_s DECIMAL(6,2),
    labeled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Frame-level plate detections
CREATE TABLE IF NOT EXISTS vision_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID REFERENCES vision_clips(id) ON DELETE CASCADE,
    frame_number INT NOT NULL,
    timestamp_s DECIMAL(8,3),
    bbox_x INT,       -- top-left x
    bbox_y INT,       -- top-left y
    bbox_w INT,       -- width
    bbox_h INT,       -- height
    confidence DECIMAL(4,3),  -- detection confidence 0-1
    plate_diameter_px DECIMAL(6,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Per-clip velocity comparison results
CREATE TABLE IF NOT EXISTS vision_velocity_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID REFERENCES vision_clips(id) ON DELETE CASCADE,
    vision_mean_velocity DECIMAL(5,3),
    vision_peak_velocity DECIMAL(5,3),
    encoder_mean_velocity DECIMAL(5,3),
    encoder_peak_velocity DECIMAL(5,3),
    rmse DECIMAL(5,4),
    mae DECIMAL(5,4),
    bias DECIMAL(5,4),
    mean_absolute_pct_error DECIMAL(5,3),  -- MAPE as percentage
    concentric_start_frame INT,
    concentric_end_frame INT,
    pause_count INT DEFAULT 0,
    smoothing_window INT DEFAULT 3,
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vision_clips_exercise ON vision_clips(exercise);
CREATE INDEX IF NOT EXISTS idx_vision_clips_labeled ON vision_clips(labeled);
CREATE INDEX IF NOT EXISTS idx_vision_detections_clip ON vision_detections(clip_id, frame_number);
CREATE INDEX IF NOT EXISTS idx_vision_velocity_clip ON vision_velocity_results(clip_id);
"""


def get_schema() -> str:
    """Return the vision schema SQL string."""
    return VISION_SCHEMA_SQL
