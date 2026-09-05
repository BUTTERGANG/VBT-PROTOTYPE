#!/usr/bin/env python3
"""Run offline validation of vision-derived velocity vs encoder ground truth.

Iterates data/sample_manifest.json, computes MV/PV per clip via the tracking
pipeline, compares against encoder ground truth when present, prints a table,
and writes a markdown + JSON report to data/reports/.

Usage:
    python scripts/run_validation.py [--manifest data/sample_manifest.json] \
        [--model models/plate_detector.onnx]
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "vision-pipeline" / "src"))

from vbt_vision.dataset import load_dataset
from vbt_vision.metrics import ccc, compute_metrics
from vbt_vision.tracking import track_clip

logging.basicConfig(level=logging.WARNING)
log = logging.getLogger("run_validation")

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path,
                        default=ROOT / "vision-pipeline" / "data" / "sample_manifest.json")
    parser.add_argument("--model", type=Path, default=None)
    parser.add_argument("--out-dir", type=Path,
                        default=ROOT / "vision-pipeline" / "data" / "reports")
    args = parser.parse_args()

    dataset = load_dataset(args.manifest)
    print(dataset.summary())

    per_clip: list[dict] = []
    mv_vision: list[float] = []
    mv_encoder: list[float] = []
    pv_vision: list[float] = []
    pv_encoder: list[float] = []

    for clip in dataset.clips:
        video = ROOT / "vision-pipeline" / clip.video_path
        entry: dict = {
            "clip_id": clip.clip_id,
            "exercise": clip.exercise,
            "video_path": str(clip.video_path),
        }
        if not video.exists():
            entry["status"] = "missing_video"
            print(f"[SKIP] {clip.clip_id}: {video} not found")
            per_clip.append(entry)
            continue
        try:
            result = track_clip(video, model_path=args.model)
        except Exception as exc:  # noqa: BLE001 — report and continue per clip
            entry["status"] = "error"
            entry["error"] = str(exc)
            print(f"[ERR ] {clip.clip_id}: {exc}")
            per_clip.append(entry)
            continue

        entry.update({
            "status": "ok",
            "n_frames": len(result.positions_px),
            "n_oof": len(result.oof_indices),
            "plate_diameter_px": result.plate_diameter_px,
            "vision_mean_velocity": result.mean_velocity,
            "vision_peak_velocity": result.peak_velocity,
            "concentric_range": result.concentric_range,
            "encoder_mean_velocity": clip.encoder_mean_velocity or None,
            "encoder_peak_velocity": clip.encoder_peak_velocity or None,
        })

        if result.mean_velocity is None:
            entry["status"] = "no_concentric_phase"
            print(f"[WARN] {clip.clip_id}: no usable concentric phase")
            per_clip.append(entry)
            continue

        line = (f"{clip.clip_id}: MV={result.mean_velocity:.3f} "
                f"PV={result.peak_velocity:.3f} m/s")
        if clip.encoder_mean_velocity:
            err_mv = result.mean_velocity - clip.encoder_mean_velocity
            line += f"  MV_err={err_mv:+.3f}"
            mv_vision.append(result.mean_velocity)
            mv_encoder.append(clip.encoder_mean_velocity)
            if clip.encoder_peak_velocity and result.peak_velocity is not None:
                pv_vision.append(result.peak_velocity)
                pv_encoder.append(clip.encoder_peak_velocity)
        print(f"[OK  ] {line}")
        per_clip.append(entry)

    # Aggregate metrics over clips with ground truth
    summary: dict = {"n_clips": len(dataset.clips),
                     "n_compared": len(mv_vision)}
    lines = [
        "# Vision validation report",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        f"Dataset: {dataset.name}",
        "",
        "| clip | status | MV vision | MV encoder | MV err | PV vision | PV encoder |",
        "|---|---|---|---|---|---|---|",
    ]
    for e in per_clip:
        lines.append(
            f"| {e['clip_id']} | {e['status']} "
            f"| {_fmt(e.get('vision_mean_velocity'))} "
            f"| {_fmt(e.get('encoder_mean_velocity'))} "
            f"| {_fmt_err(e)} "
            f"| {_fmt(e.get('vision_peak_velocity'))} "
            f"| {_fmt(e.get('encoder_peak_velocity'))} |"
        )

    if len(mv_vision) >= 1:
        m_mv = compute_metrics(np.array(mv_vision), np.array(mv_encoder))
        summary["mv_metrics"] = {
            "rmse": m_mv.rmse, "mae": m_mv.mae, "bias": m_mv.bias,
            "pearson_r": m_mv.pearson_r, "ccc": ccc(np.array(mv_vision), np.array(mv_encoder)),
        }
        lines += ["", "## Mean velocity (vision vs encoder)", "", m_mv.summary()]
    if len(pv_vision) >= 1:
        m_pv = compute_metrics(np.array(pv_vision), np.array(pv_encoder))
        summary["pv_metrics"] = {
            "rmse": m_pv.rmse, "mae": m_pv.mae, "bias": m_pv.bias,
            "pearson_r": m_pv.pearson_r, "ccc": ccc(np.array(pv_vision), np.array(pv_encoder)),
        }
        lines += ["", "## Peak velocity (vision vs encoder)", "", m_pv.summary()]

    args.out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    md_path = args.out_dir / f"validation_{stamp}.md"
    json_path = args.out_dir / f"validation_{stamp}.json"
    md_path.write_text("\n".join(lines) + "\n")
    json_path.write_text(json.dumps({"summary": summary, "clips": per_clip},
                                    indent=2, default=str))

    print("\n".join(lines))
    print(f"\nReport: {md_path}\nJSON:   {json_path}")
    return 0


def _fmt(v) -> str:
    return f"{v:.3f}" if isinstance(v, (int, float)) else "—"


def _fmt_err(e: dict) -> str:
    vm, em = e.get("vision_mean_velocity"), e.get("encoder_mean_velocity")
    if isinstance(vm, (int, float)) and isinstance(em, (int, float)):
        return f"{vm - em:+.3f}"
    return "—"


if __name__ == "__main__":
    sys.exit(main())
