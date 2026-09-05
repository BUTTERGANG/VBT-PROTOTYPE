# VBT Validation Research Insights

> **Purpose:** Extract actionable insights from published VBT validation studies to guide development of the VBT Tracker vision pipeline, rep detection, autoregulation, and validation testing.
> **Last updated:** 2026-06-17
> **Sources:** 3 peer-reviewed studies + Metric Coach internal validation (2026)

---

## Studies Reviewed

| # | Study | Year | Device | Reference | Exercises | Reps |
|---|-------|------|--------|-----------|-----------|------|
| 1 | Šagovac et al. — Zagreb | 2024 | Metric v4.5 | Vitruve LPT | Bench press (45-75% 1RM) | 150 |
| 2 | Renner, Mitter, Baca — Vienna | 2024 | Metric v2.3.1 | Vicon mocap + RepOne LPT | Squat, bench, deadlift (45-90% 1RM) | 589 |
| 3 | Grossi et al. — Urbino | 2026 | Metric ~v5-6 | Vitruve LPT | Bench press 1-RM (Smith machine) | 18 |
| 4 | Metric in-house | 2026 | Metric v6.9/v1.2 | GymAware LPT | Bench, deadlift, squat, cleans | 95 |

---

## 1. Accuracy Benchmarks (What "Good Enough" Looks Like)

### Concordance Correlation Coefficient (CCC)

| Study | Metric | CCC | Systematic bias |
|-------|--------|-----|-----------------|
| Metric in-house 2026 | Mean velocity | **0.982** | +0.02 m/s |
| Metric in-house 2026 | Peak velocity | **0.975** | −0.05 m/s |

**Target for VBT Tracker:** CCC > 0.95 for MV and > 0.97 for PV vs a reference device. This is the Metric v6.9 benchmark.

### Pearson / Spearman Correlation by Velocity Zone

| Velocity zone | Study | MV correlation | PV correlation |
|---------------|-------|----------------|----------------|
| Submaximal (0.3–1.0 m/s) | Šagovac 2024 (45-75% 1RM) | **r = 0.93** | **r = 0.91** |
| Near-maximal (0.12–0.20 m/s) | Grossi 2026 (1-RM) | ρ = 0.65 | **r = 0.91** |
| Mixed (0.11–1.04 m/s) | Renner 2024 (45-90% 1RM) | Mixed* | — |

*Renner showed bench was good (SMB 0.07, RMSE 0.04 m/s), deadlift moderate, squat had underestimation (SMB −0.28).

### Key Insight: Velocity Range Matters Enormously

The same absolute error has very different implications:
- **0.04 m/s error at 1.0 m/s** = 4% error (submaximal — fine)
- **0.04 m/s error at 0.16 m/s** = 25% error (near-maximal — significant)

**→ Development implication:** Your autoregulation algorithms should weight velocity data differently based on intensity zone. A 0.05 m/s drop means something very different at 60% 1RM vs 95% 1RM.

### Mean Absolute Error (MAE)

| Study | MV MAE | PV MAE |
|-------|--------|--------|
| Metric in-house 2026 | +0.044 m/s | −0.088 m/s |

**→ Development implication:** Systematic bias of ±0.05 m/s is the current state-of-the-art. Design your calibration to minimize this.

---

## 2. Peak Velocity vs Mean Velocity

**Finding: Peak velocity is consistently the most robust metric across all studies and all velocity ranges.**

| Study | PV correlation | MV correlation |
|-------|----------------|----------------|
| Šagovac 2024 (submaximal) | r = 0.91 | r = 0.93 |
| Grossi 2026 (1-RM) | **r = 0.91** | ρ = 0.65 |

At 1-RM, PV correlation held at 0.91 while MV dropped to 0.65. PV is less affected by slow-speed tracking noise because it captures the instantaneous peak rather than averaging over the full concentric phase.

**→ Development implication:**
- **Prioritize PV accuracy in your vision pipeline.** If you have to choose where to spend optimization effort, PV gives the most reliable signal across all intensity zones.
- Report both MV and PV to users, but use PV as the primary autoregulation input for near-maximal work.
- Note: Metric reports MV, not MPV (mean propulsive velocity). MPV excludes the braking phase and is considered more accurate for load-velocity profiling. Consider adding MPV as a future metric.

---

## 3. Rep Detection — Failure Modes and Benchmarks

Renner 2024 is the only study that systematically counted missed reps across exercises:

| Device | Squat | Bench press | Deadlift | Ghost reps |
|--------|-------|-------------|----------|------------|
| **Metric v2.3.1** | ~4-6% missed | ~4-6% missed | **17% missed** | 16 total (2 squat, 14 bench) |
| **Qwik v0.94** | 0% | 0% | 0% | 0 |
| **MyLift v3.2.9** | ~2% | **84% missed** | ~2% | — |
| **RepOne LPT** | 0% | 0% | 0% | 0 |

### Key Failure Modes

1. **Deadlift is the hardest exercise** — 17% miss rate for Metric v2.3.1. The bar starts on the floor, has a different trajectory, and the lifter's body occludes the bar more.

2. **Ghost reps from unracking/reracking** — Metric v2.3.1 registered 16 ghost reps, all during unracking (2) or reracking (14). These are bar movements that aren't actual reps.

3. **Version matters enormously** — Metric v2.3.1 (2024) had significant rep detection issues. By v4.5 (Šagovac 2024), Metric detected 100% of 150 bench press reps. The algorithm improved substantially.

### Benchmarks for VBT Tracker

| Metric | Target | Source |
|--------|--------|--------|
| Rep detection rate (bench) | ≥ 98% | Šagovac 2024 (v4.5 achieved 100%) |
| Rep detection rate (squat) | ≥ 95% | Renner 2024 (v2.3.1 achieved ~94-96%) |
| Rep detection rate (deadlift) | ≥ 90% | Renner 2024 (v2.3.1 achieved ~83%) |
| Ghost rep rate | < 2% | Renner 2024 (v2.3.1 had ~3%) |

**→ Development implications for RepDetector.ts:**
- Implement **exercise-specific detection profiles** — deadlift needs different handling than bench/squat
- Add **unrack/rerack filtering** — detect when the bar is being placed on/removed from the rack (short movement at the top of the range, followed by extended stillness)
- Use a **configurable minimum velocity threshold** — Grossi notes Metric uses 0.01 m/s to define repetition onset/termination. Make this tunable per exercise.
- Consider the **sticking region** — during 1-RM bench press, the bar slows dramatically in the sticking region. Your detector should not interpret this as a rep completion.

---

## 4. Range of Motion (ROM) — Consistently Weak

**Finding: ROM is the weakest metric across ALL studies. Do not rely on it as a primary metric.**

| Study | ROM ICC | ROM correlation | Mean bias | 95% LoA |
|-------|---------|-----------------|-----------|---------|
| Grossi 2026 | 0.236 (poor) | ρ = 0.55 | +1.64 cm | −13.82 to +17.10 cm |
| Šagovac 2024 | — | r = 0.75 | 4.38 cm | ±4.14 cm |

Even in the best case (Šagovac, submaximal bench), ROM had the lowest correlation of the three metrics. At 1-RM, it was essentially unusable (ICC 0.236).

**→ Development implication:** Track ROM if you can, but set user expectations low. Don't use ROM for autoregulation decisions. Small errors in position tracking compound over the full range of motion.

---

## 5. Fatigue Detection — What the Research Uses

The Sánchez-Medina & González-Badillo framework (cited by multiple studies) defines velocity loss thresholds:

| Velocity loss | Interpretation |
|---------------|----------------|
| < 10% | Minimal fatigue — maintain or increase load |
| 10–20% | Moderate fatigue — maintain load |
| 20–30% | Significant fatigue — consider decreasing load |
| > 30% | High fatigue — end session |

**Current VBT Tracker implementation** (`autoregulate/main.py`):
- Uses 15% fatigue threshold (reasonable for general training)
- Triggers "stop" at >25% velocity drop
- Only analyzes within-set velocity drop (first rep vs last rep)

**→ Development improvements:**
1. **Add between-set fatigue tracking** — compare average velocity of set N vs set 1. A 15% drop across sets is a stronger fatigue signal than within-set drop.
2. **Exercise-specific thresholds** — deadlift typically shows higher velocity loss than bench press at the same relative intensity.
3. **Use PV for fatigue detection** — since PV is more reliable at slow speeds, it may give cleaner fatigue signals at near-maximal loads.
4. **Add velocity loss zones** to the autoregulation response (not just binary fatigue/no-fatigue).

---

## 6. Camera Setup Requirements (from Metric Internal Study)

Metric's internal validation tested multiple setups. The gold standard and acceptable variations:

| Parameter | Gold standard | Acceptable range |
|-----------|---------------|-----------------|
| **Frame rate** | 60 fps | 30 fps (more noise but usable) |
| **Resolution** | 1080p | 720p–4K |
| **Angle** | Perpendicular to barbell plane | Up to 45° |
| **Distance** | ~1.5 m lateral | 1.2 m – 5 m |
| **Height** | Lens at barbell mid-range (~1.3 m) | Floor-level to overhead |
| **Lighting** | Well-lit | Low-light and glare conditions tested |

**→ Development implication for CameraFramingGuide.ts:**
- Guide users to perpendicular setup as default
- Warn when angle exceeds 45°
- 60fps should be the target; 30fps is acceptable but flag it
- Low-light and glare are handled by the tracking algorithm but should trigger user warnings

---

## 7. Version Evolution — What Improved

Metric's tracking has improved significantly across versions. Key changes relevant to VBT Tracker:

| Version | Timeframe | Key improvements |
|---------|-----------|-----------------|
| v0.5.4 | 2023 (Taber study) | Basic computer vision tracking |
| v0.6.0 | 2024 (Trowell study) | Improved ROM accuracy |
| v2.3.1 | 2024 (Renner study) | Rep detection issues, especially deadlift |
| v4.5 | 2024 (Šagovac study) | 100% rep detection on bench, r=0.93 MV |
| v5-6 | 2025-26 (Grossi study) | Improved PV accuracy |
| v6.9 | 2026 (in-house) | CCC 0.982 MV, CCC 0.975 PV, 100% rep detection across exercises |

**→ Development implication:** Rep detection and PV accuracy are the areas that saw the most improvement. These should be your primary optimization targets.

---

## 8. Validation Testing Plan for VBT Tracker

Based on the methodologies used in these studies, here's a recommended validation protocol:

### Phase 1: Controlled Bench Press (Easiest)
- 10-15 participants, 3 reps at 45%, 60%, 75% 1RM
- Simultaneous recording: VBT Tracker + reference device (linear transducer or known-valid app)
- Measure: MV correlation, PV correlation, rep detection rate, systematic bias
- **Success criteria:** r > 0.90 for MV, r > 0.90 for PV, > 95% rep detection

### Phase 2: Multi-Exercise
- Add squat and deadlift
- Same loads and measurements
- **Success criteria:** r > 0.85 for MV, r > 0.90 for PV, > 90% rep detection (deadlift will be hardest)

### Phase 3: Edge Cases
- 1-RM attempts (slowest reps)
- Low-light conditions
- 30fps recording
- Non-perpendicular angles (30-45°)
- **Success criteria:** PV r > 0.85, MV r > 0.60, > 85% rep detection

### Reference Devices (in order of preference)
1. Linear position transducer (Vitruve, GymAware, RepOne) — most practical
2. Known-validated app (Metric v6.9) — easiest to set up
3. 3D motion capture — gold standard but impractical for most settings

---

## 9. Open Questions for Future Research

These are gaps in the current literature that could inform VBT Tracker development:

1. **No study tests the same device across multiple sessions (test-retest reliability).** All studies are single-session. How stable is the tracking over days/weeks?

2. **No study tests free-weight vs Smith machine systematically.** Grossi used Smith machine at 1-RM; Šagovac used free weight at submaximal. The bar path difference matters for vision tracking.

3. **No study reports per-rep velocity data** — only summary statistics. We don't know if rep 1 is tracked more accurately than rep 5 in a fatigued set.

4. **No study tests Olympic lifts or explosive movements.** All studies are slow, controlled lifts. Clean/snatch tracking is untested.

5. **No study tests real-time tracking accuracy** — all use post-processed video. The latency/accuracy tradeoff of real-time tracking is unknown.

---

## 10. Key Citations

1. Šagovac, A., & Baković, M. (2024). Validity and reliability of a mobile application for velocity-based training (VBT) in the bench press exercise. *Hrvatski športskomedicinski vjesnik*, 39, 109–117.

2. Renner, A., Mitter, B., & Baca, A. (2024). Concurrent validity of novel smartphone-based apps monitoring barbell velocity in powerlifting exercises. *PLOS ONE*, 19(11), e0313919. https://doi.org/10.1371/journal.pone.0313919

3. Grossi, T., Micheli, L., Magnoni, M., Shoaei, V., Benelli, P., Ferri Marini, C., & Lucertini, F. (2026). Comparison of the MetricVBT App and the Vitruve Linear Position Transducer for Assessing Execution Velocity and ROM. *Journal of Functional Morphology and Kinesiology*, 11(2), 197. https://doi.org/10.3390/jfmk11020197

4. Taber, C., Patterson, E., Shah, J., Francis, P., & Wager, J.C. (2023). Validity and reliability of a computer vision system to determine bar displacement and velocity. *International Journal of Strength and Conditioning*, 3. https://doi.org/10.47206/ijsc.v3i1.198

5. Trowell, D.A., Collins, A.G.C., Hendy, A.M., Drinkwater, E.J., & Kenneally-Dabrowski, C. (2024). Validation of a commercially available mobile application for velocity-based resistance training. *PeerJ*, 12, e17789. https://doi.org/10.7717/peerj.17789

6. Sánchez-Medina, L., & González-Badillo, J.J. (2011). Velocity loss as an indicator of neuromuscular fatigue during resistance training. *Medicine and Science in Sports and Exercise*, 43(9), 1725–1734. https://doi.org/10.1249/MSS.0b013e318213f889
