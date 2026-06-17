---
title: Rep detection — exercise-specific profiles and unrack filtering
status: backlog
priority: high
source: research-insights.md
created: 2026-06-17
---

# Rep Detection Improvements (Research-Backed)

Based on Renner 2024 and Grossi 2026 findings.

## Problem
Current RepDetector.ts uses a single algorithm for all exercises. Research shows:
- Deadlift has 3-4x higher miss rate than bench/squat (Renner 2024: 17% vs 4-6%)
- Unracking/reracking causes ghost reps (16 ghost reps in Renner 2024, all from rack movements)
- Minimum velocity threshold of 0.01 m/s is used by Metric to define rep onset/termination

## Tasks

- [ ] Add exercise-specific detection profiles (bench, squat, deadlift)
- [ ] Implement unrack/rerack filtering — detect short movement at top of range + extended stillness
- [ ] Make minimum velocity threshold configurable per exercise (default 0.01 m/s per Grossi 2026)
- [ ] Add sticking region handling for slow reps (1-RM range ~0.12-0.20 m/s)
- [ ] Target: >95% detection on bench/squat, >90% on deadlift, <2% ghost reps

## Validation
- Record 30+ reps per exercise with simultaneous reference (video review or known-valid app)
- Compare detected rep count and rep boundaries against ground truth
- Measure per-exercise detection rate

## References
- Renner et al. 2024 (PLOS ONE) — Table: rep detection rates by exercise
- Grossi et al. 2026 (JF MK) — Section 3: recording errors and outlier analysis
