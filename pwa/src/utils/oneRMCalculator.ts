// src/utils/oneRMCalculator.ts

/**
 * Velocity-based 1RM estimation.
 *
 * Uses the load-velocity profile approach:
 *   1RM = load / (% of max velocity for that load)
 *
 * Based on the Jovanovic / Epley relationship between load and mean velocity.
 * For strength-oriented lifts (M1), peak velocity at 1RM ≈ 0.30 m/s.
 * For speed-oriented lifts (M2), it's higher.
 *
 * References:
 * - Jovanovic & Flanagan (2014) - Researched Applications in VBT
 * - Gonzalez-Badillo & Sanchez-Medina (2010) - Load-velocity relationship
 */

// Minimum velocity threshold at 1RM for different lifting modes
const V1RM_BY_MODE: Record<string, number> = {
  M1: 0.30,  // Strength: ~0.30 m/s at 1RM
  M2: 0.50,  // Speed-strength: ~0.50 m/s at 1RM
  M3: 0.75,  // Speed: ~0.75 m/s at 1RM (not really applicable for 1RM)
};

/**
 * Estimate 1RM from a single set using the velocity method.
 *
 * @param load - Weight on the bar (kg)
 * @param meanVelocity - Mean velocity of the set (m/s)
 * @param mode - Lifting mode (M1, M2, M3)
 * @returns Estimated 1RM in kg, or null if inputs are invalid
 */
export function estimate1RM(load: number, meanVelocity: number, mode: string = 'M1'): number | null {
  if (load <= 0 || meanVelocity <= 0) return null;

  const v1rm = V1RM_BY_MODE[mode] || V1RM_BY_MODE.M1;

  // Linear load-velocity profile: V = V0 - (V0 - V1RM) * (load / 1RM)
  // Solving for 1RM: 1RM = load * (V0 - V1RM) / (V0 - meanVelocity)
  // But we don't know V0 (velocity at zero load).
  //
  // Simplified approach using velocity deficit ratio:
  // %1RM = 1 - (meanVelocity - V1RM) / (V0 - V1RM)
  // With V0 ≈ 1.3 m/s for most barbell exercises (Gonzalez-Badillo 2010)
  const V0 = 1.3;

  if (meanVelocity >= V0) return null; // Velocity too high, probably warm-up
  if (meanVelocity <= v1rm) return load; // Already at or below 1RM velocity

  const percentOfMax = 1 - (meanVelocity - v1rm) / (V0 - v1rm);
  if (percentOfMax <= 0) return null;

  return Math.round((load / percentOfMax) * 10) / 10;
}

/**
 * Estimate 1RM from multiple sets using the load-velocity profile.
 * More accurate than single-set estimation.
 *
 * Fits a linear regression to load vs velocity, then finds the load at V1RM.
 *
 * @param sets - Array of { load, meanVelocity } pairs
 * @param mode - Lifting mode
 * @returns Estimated 1RM in kg, or null if insufficient data
 */
export function estimate1RMFromProfile(
  sets: Array<{ load: number; meanVelocity: number }>,
  mode: string = 'M1'
): number | null {
  const validSets = sets.filter(s => s.load > 0 && s.meanVelocity > 0);
  if (validSets.length < 2) {
    // Fall back to single-set estimation using the heaviest set
    const heaviest = validSets.reduce((a, b) => a.load > b.load ? a : b, validSets[0]);
    return heaviest ? estimate1RM(heaviest.load, heaviest.meanVelocity, mode) : null;
  }

  const v1rm = V1RM_BY_MODE[mode] || V1RM_BY_MODE.M1;

  // Linear regression: velocity = a + b * load
  const n = validSets.length;
  const sumX = validSets.reduce((s, p) => s + p.load, 0);
  const sumY = validSets.reduce((s, p) => s + p.meanVelocity, 0);
  const sumXY = validSets.reduce((s, p) => s + p.load * p.meanVelocity, 0);
  const sumX2 = validSets.reduce((s, p) => s + p.load * p.load, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;

  const b = (n * sumXY - sumX * sumY) / denominator;
  const a = (sumY - b * sumX) / n;

  // velocity = a + b * load → load = (velocity - a) / b
  if (b >= 0) return null; // Should be negative (velocity decreases with load)

  const oneRM = (v1rm - a) / b;
  return oneRM > 0 ? Math.round(oneRM * 10) / 10 : null;
}

/**
 * Calculate relative strength (1RM / bodyweight).
 */
export function relativeStrength(oneRM: number, bodyweight: number): number | null {
  if (bodyweight <= 0 || oneRM <= 0) return null;
  return Math.round((oneRM / bodyweight) * 100) / 100;
}
