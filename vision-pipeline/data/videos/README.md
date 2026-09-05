Video fixtures live here (not committed — too large for git).

Expected clip format (see ../sample_manifest.json for the schema):

- Side-view lift clips (`camera_angle: "side"`), camera roughly perpendicular
  to the bar path, full ROM visible in frame.
- Known load on the bar with at least one standard 45 cm Olympic plate visible
  at the end of the bar (used for px→m calibration via plate diameter).
- Fixed camera during the set (no pan/zoom); 720p+ preferred, 30–60 fps.
- Filename must match `video_path` in the manifest, e.g. `squat_001.mp4`.

Optional ground truth per clip (fields on each manifest entry):
- `encoder_mean_velocity`, `encoder_peak_velocity` — m/s from a linear
  position transducer attached to the bar, used by scripts/run_validation.py.
- `plate_labels` — optional frame-labeled plate boxes
  (`{frame_number, x1, y1, x2, y2}`) for detector accuracy checks.

Generate a synthetic placeholder clip for smoke-testing the harness:
    python ../../scripts/make_synthetic_clip.py data/videos/squat_001.mp4
