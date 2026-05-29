# VBT Autoregulation Service
# FastAPI service for velocity-based training recommendations
#
# Run: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import statistics

app = FastAPI(title="VBT Autoregulation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request/Response Models ────────────────────────────────────────────────

class SessionData(BaseModel):
    exercise: str
    sets: list[dict]  # [{ set_number, reps: [{ mean_velocity, peak_velocity, zone_result }] }]
    target_velocity: Optional[float] = None
    target_tolerance: Optional[float] = 0.05


class AthleteProfile(BaseModel):
    baseline_velocity: Optional[float] = None
    fatigue_threshold: Optional[float] = 0.15
    bodyweight: Optional[float] = None


class AutoregulateRequest(BaseModel):
    athlete_id: str
    athlete_profile: Optional[AthleteProfile] = None
    session_data: SessionData


class SetRecommendation(BaseModel):
    set_number: int
    recommendation: str  # "increase_load", "decrease_load", "maintain", "stop"
    reason: str
    suggested_velocity_target: Optional[float] = None
    confidence: float  # 0-1


class AutoregulateResponse(BaseModel):
    session_summary: dict
    set_recommendations: list[SetRecommendation]
    overall_recommendation: str
    overall_confidence: float
    fatigue_detected: bool
    velocity_drop: Optional[float] = None
    message: str


# ─── Autoregulation Engine ───────────────────────────────────────────────────

def analyze_fatigue(reps: list[dict], fatigue_threshold: float) -> tuple[bool, float]:
    """Detect fatigue by measuring velocity drop within a set."""
    if len(reps) < 2:
        return False, 0.0

    velocities = [r["mean_velocity"] for r in reps]
    v_first = velocities[0]
    v_last = velocities[-1]

    if v_first <= 0:
        return False, 0.0

    drop = (v_first - v_last) / v_first
    return drop > fatigue_threshold, round(drop, 3)


def analyze_zone_adherence(reps: list[dict], target: float, tolerance: float) -> dict:
    """Analyze how well reps hit the target velocity zone."""
    lower = target - tolerance
    upper = target + tolerance

    in_zone = sum(1 for r in reps if lower <= r["mean_velocity"] <= upper)
    too_fast = sum(1 for r in reps if r["mean_velocity"] > upper)
    too_slow = sum(1 for r in reps if r["mean_velocity"] < lower)
    total = len(reps)

    return {
        "in_zone_pct": round(in_zone / total * 100, 1) if total else 0,
        "too_fast_pct": round(too_fast / total * 100, 1) if total else 0,
        "too_slow_pct": round(too_slow / total * 100, 1) if total else 0,
        "avg_velocity": round(statistics.mean([r["mean_velocity"] for r in reps]), 3) if reps else 0,
    }


def get_set_recommendation(
    set_data: dict,
    set_number: int,
    total_sets: int,
    athlete_profile: Optional[AthleteProfile],
    prev_sets: list[dict],
) -> SetRecommendation:
    """Generate a recommendation for the next set based on current set data."""
    reps = set_data.get("reps", [])
    target = set_data.get("target_velocity", 0.45)
    tolerance = set_data.get("target_tolerance", 0.05)
    fatigue_threshold = athlete_profile.fatigue_threshold if athlete_profile else 0.15

    if not reps:
        return SetRecommendation(
            set_number=set_number,
            recommendation="maintain",
            reason="No reps recorded — maintain current load",
            confidence=0.3,
        )

    # Fatigue analysis
    is_fatigue, velocity_drop = analyze_fatigue(reps, fatigue_threshold)

    # Zone analysis
    adherence = analyze_zone_adherence(reps, target, tolerance)

    # Determine recommendation
    if is_fatigue and velocity_drop > 0.25:
        return SetRecommendation(
            set_number=set_number,
            recommendation="stop",
            reason=f"Significant velocity drop ({velocity_drop:.0%}). End session — fatigue threshold exceeded.",
            confidence=0.9,
        )

    if is_fatigue:
        return SetRecommendation(
            set_number=set_number,
            recommendation="decrease_load",
            reason=f"Velocity dropped {velocity_drop:.0%}. Reduce load by 2-5% or take extended rest.",
            suggested_velocity_target=round(target * 0.97, 3),
            confidence=0.8,
        )

    if adherence["in_zone_pct"] >= 80:
        # Hitting target — progressive overload
        if set_number < total_sets:
            return SetRecommendation(
                set_number=set_number,
                recommendation="maintain",
                reason=f"Great set! {adherence['in_zone_pct']:.0f}% in zone. Maintain load for next set.",
                suggested_velocity_target=target,
                confidence=0.85,
            )
        else:
            return SetRecommendation(
                set_number=set_number,
                recommendation="increase_load",
                reason=f"All sets hit target. Increase load by 2-5% next session. Avg velocity: {adherence['avg_velocity']:.2f} m/s",
                suggested_velocity_target=round(target * 1.03, 3),
                confidence=0.75,
            )

    if adherence["too_fast_pct"] > adherence["in_zone_pct"]:
        return SetRecommendation(
            set_number=set_number,
            recommendation="increase_load",
            reason=f"Velocity too fast ({adherence['too_fast_pct']:.0f}% above zone). Increase load to stay in target zone.",
            suggested_velocity_target=target,
            confidence=0.7,
        )

    if adherence["too_slow_pct"] > adherence["in_zone_pct"]:
        return SetRecommendation(
            set_number=set_number,
            recommendation="decrease_load",
            reason=f"Velocity too slow ({adherence['too_slow_pct']:.0f}% below zone). Consider reducing load slightly.",
            suggested_velocity_target=target,
            confidence=0.6,
        )

    return SetRecommendation(
        set_number=set_number,
        recommendation="maintain",
        reason=f"Mixed results — {adherence['in_zone_pct']:.0f}% in zone. Maintain load and focus on execution.",
        confidence=0.5,
    )


# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "vbt-autoregulate", "version": "1.0.0"}


@app.post("/api/autoregulate", response_model=AutoregulateResponse)
async def autoregulate(req: AutoregulateRequest):
    """Analyze session data and provide autoregulation recommendations."""
    session = req.session_data
    profile = req.athlete_profile
    sets = session.sets

    if not sets:
        raise HTTPException(status_code=400, detail="No sets in session data")

    set_recommendations = []
    total_velocity = 0
    total_reps = 0
    max_velocity_drop = 0
    any_fatigue = False

    for i, set_data in enumerate(sets):
        # Determine target for this set
        target = set_data.get("target_velocity", session.target_velocity)
        if target:
            set_data["target_velocity"] = target
        if session.target_tolerance:
            set_data["target_tolerance"] = session.target_tolerance

        rec = get_set_recommendation(set_data, i + 1, len(sets), profile, sets[:i])
        set_recommendations.append(rec)

        reps = set_data.get("reps", [])
        total_velocity += sum(r["mean_velocity"] for r in reps)
        total_reps += len(reps)

        # Track fatigue across all sets
        fatigue_threshold = profile.fatigue_threshold if profile else 0.15
        is_fat, drop = analyze_fatigue(reps, fatigue_threshold)
        if is_fat:
            any_fatigue = True
        max_velocity_drop = max(max_velocity_drop, drop)

    overall_avg = round(total_velocity / total_reps, 3) if total_reps else 0

    # Overall recommendation
    stop_recs = [r for r in set_recommendations if r.recommendation == "stop"]
    fatigue_recs = [r for r in set_recommendations if r.recommendation == "decrease_load"]
    maintain_recs = [r for r in set_recommendations if r.recommendation == "maintain"]

    if stop_recs:
        overall_rec = "Session should be ended — significant fatigue detected."
        overall_conf = 0.9
    elif len(fatigue_recs) >= len(sets) / 2:
        overall_rec = "Consider ending session soon — fatigue building across multiple sets."
        overall_conf = 0.7
    elif len(maintain_recs) >= len(sets) * 0.7:
        overall_rec = "Good session — maintain current training plan. Ready for progressive overload."
        overall_conf = 0.8
    else:
        overall_rec = "Mixed session — review set recommendations for next workout adjustments."
        overall_conf = 0.5

    return AutoregulateResponse(
        session_summary={
            "exercise": session.exercise,
            "total_sets": len(sets),
            "total_reps": total_reps,
            "overall_avg_velocity": overall_avg,
            "max_peak_velocity": max(
                (r.get("peak_velocity", 0) for s in sets for r in s.get("reps", [])),
                default=0,
            ),
        },
        set_recommendations=set_recommendations,
        overall_recommendation=overall_rec,
        overall_confidence=overall_conf,
        fatigue_detected=any_fatigue,
        velocity_drop=max_velocity_drop if max_velocity_drop > 0 else None,
        message=overall_rec,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
