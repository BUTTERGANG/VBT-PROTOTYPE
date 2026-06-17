---
title: Validation testing protocol — bench press first, then multi-exercise
status: backlog
priority: medium
source: research-insights.md
created: 2026-06-17
---

# Validation Testing Protocol (Research-Backed)

Based on methodologies from Šagovac 2024, Renner 2024, Grossi 2026, and Metric in-house 2026.

## Goal
Validate VBT Tracker camera VBT pipeline against a reference device with published benchmarks.

## Success Criteria (from research)

| Metric | Phase 1 (Bench) | Phase 2 (Multi) | Phase 3 (Edge) |
|--------|-----------------|-----------------|-----------------|
| MV correlation | r > 0.90 | r > 0.85 | r > 0.60 (1-RM) |
| PV correlation | r > 0.90 | r > 0.90 | r > 0.85 |
| Rep detection | > 95% | > 90% (deadlift) | > 85% |
| Systematic bias | < 0.05 m/s | < 0.05 m/s | < 0.08 m/s |

## Phase 1: Controlled Bench Press
- 10-15 participants, 2+ years training experience
- 3 reps at 45%, 60%, 75% 1RM (90-135 total reps)
- Simultaneous: VBT Tracker + reference device
- Reference options (in order of preference):
  1. Linear position transducer (Vitruve, GymAware, RepOne)
  2. Metric v6.9 app (already validated)
  3. 3D motion capture (gold standard, impractical)

## Phase 2: Multi-Exercise
- Add squat and deadlift
- Same loads and measurements
- Focus on deadlift detection (hardest exercise per Renner 2024)

## Phase 3: Edge Cases
- 1-RM attempts (slowest reps, ~0.12-0.20 m/s MV)
- Low-light conditions
- 30fps recording
- Non-perpendicular angles (30-45°)

## Data Collection
- Record raw video + VBT Tracker output + reference device output
- Per-rep: MV, PV, ROM, rep start/end timestamps
- Per-set: fatigue indicators, zone adherence
- Export to CSV for analysis

## Analysis
- Pearson/Spearman correlation per exercise and load
- Bland-Altman plots (bias + 95% limits of agreement)
- Rep detection: true positive, false positive, false negative rates
- Systematic bias and RMSE

## References
- Šagovac 2024: n=15, 150 reps, bench only, Vitruve reference
- Renner 2024: n=20, 589 reps, 3 exercises, Vicon+RepOne reference
- Grossi 2026: n=18, 1-RM only, Vitruve reference
- Metric in-house 2026: n=1, 95 reps, 4 exercises, GymAware reference
