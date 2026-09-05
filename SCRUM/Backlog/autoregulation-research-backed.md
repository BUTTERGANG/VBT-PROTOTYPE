---
title: Autoregulation — velocity-zone weighting and between-set fatigue
status: backlog
priority: high
source: research-insights.md
created: 2026-06-17
---

# Autoregulation Improvements (Research-Backed)

Based on Grossi 2026, Šagovac 2024, and Sánchez-Medina 2011 findings.

## Problem
Current autoregulate/main.py only analyzes within-set velocity drop (first rep vs last rep) with a flat 15% threshold. Research shows:
- Same absolute error (0.04 m/s) = 4% at submaximal but 25% at near-maximal loads
- Between-set velocity drop is a stronger fatigue signal than within-set drop
- PV is more reliable than MV at slow speeds — should be used for fatigue detection at near-maximal loads
- Sánchez-Medina framework: <10% = minimal, 10-20% = moderate, 20-30% = significant, >30% = high fatigue

## Tasks

- [ ] Add velocity-zone weighting — trust velocity data more at submaximal loads, less at near-maximal
- [ ] Implement between-set fatigue tracking (set N avg velocity vs set 1 avg velocity)
- [ ] Use PV as primary fatigue signal for near-maximal work (<0.3 m/s MV zone)
- [ ] Add graded velocity loss zones (not just binary fatigue/no-fatigue):
  - <10%: "Minimal fatigue — maintain or increase"
  - 10-20%: "Moderate fatigue — maintain"
  - 20-30%: "Significant fatigue — decrease or extended rest"
  - >30%: "High fatigue — end session"
- [ ] Add exercise-specific fatigue thresholds (deadlift typically shows higher VL than bench)
- [ ] Return velocity loss % in autoregulation API response

## Validation
- Compare autoregulation recommendations against expert coach assessment of the same session data
- Test across intensity zones (45%, 60%, 75%, 90%, 100% 1RM)

## References
- Sánchez-Medina & González-Badillo 2011 (MSSE) — Velocity loss thresholds
- Grossi et al. 2026 — Section 4: velocity range affects accuracy
- Šagovac et al. 2024 — ICC values by load intensity
