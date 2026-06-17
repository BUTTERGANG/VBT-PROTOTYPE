"""ONNX inference wrapper for plate detection.

Provides a lightweight inference path using ONNX Runtime,
suitable for deployment on resource-constrained devices.
Falls back to PyTorch/ultralytics if ONNX model is unavailable.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# Try to import onnxruntime — optional dependency
try:
    import onnxruntime as ort
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False
    logger.warning("onnxruntime not installed — ONNX inference unavailable")


@dataclass
class Detection:
    """Single object detection result."""
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float
    class_id: int = 0


@dataclass
class DetectionResult:
    """Detections for a single frame."""
    frame_number: int
    detections: list[Detection]
    inference_time_ms: float


class PlateDetectorONNX:
    """ONNX-based plate detection model wrapper.

    Usage:
        detector = PlateDetectorONNX("models/plate_detector.onnx")
        result = detector.detect(frame)
    """

    def __init__(
        self,
        model_path: str,
        confidence_threshold: float = 0.5,
        iou_threshold: float = 0.45,
        input_size: tuple[int, int] = (640, 640),
    ):
        if not HAS_ONNX:
            raise RuntimeError(
                "onnxruntime is required for ONNX inference. "
                "Install with: pip install onnxruntime"
            )

        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        self.input_size = input_size

        self.session = ort.InferenceSession(model_path)
        self.input_name = self.session.get_inputs()[0].name
        logger.info(f"Loaded ONNX model: {model_path}")

    def preprocess(self, frame: np.ndarray) -> np.ndarray:
        """Preprocess a BGR frame for ONNX inference.

        Args:
            frame: (H, W, 3) BGR image

        Returns:
            (1, 3, H, W) normalized float32 tensor
        """
        import cv2

        # Resize
        resized = cv2.resize(frame, self.input_size, interpolation=cv2.INTER_LINEAR)

        # BGR → RGB, normalize to [0, 1]
        rgb = resized[:, :, ::-1].astype(np.float32) / 255.0

        # HWC → CHW
        tensor = np.transpose(rgb, (2, 0, 1))

        # Add batch dimension
        return np.expand_dims(tensor, axis=0)

    def detect(self, frame: np.ndarray, frame_number: int = 0) -> DetectionResult:
        """Run plate detection on a single frame.

        Args:
            frame: (H, W, 3) BGR image
            frame_number: frame index for tracking

        Returns:
            DetectionResult with all detections above threshold
        """
        import time

        input_tensor = self.preprocess(frame)
        h, w = frame.shape[:2]

        start = time.perf_counter()
        outputs = self.session.run(None, {self.input_name: input_tensor})
        elapsed_ms = (time.perf_counter() - start) * 1000

        # Parse YOLOv8 output format: (1, num_detections, 5) where 5 = x, y, w, h, conf
        predictions = outputs[0][0]  # (N, 5) or (N, num_classes + 5)

        detections: list[Detection] = []

        for pred in predictions:
            if pred.shape[0] > 5:
                # Format: [x, y, w, h, obj_conf, class1_conf, ...]
                obj_conf = float(pred[4])
                if obj_conf < self.confidence_threshold:
                    continue
                class_id = int(np.argmax(pred[5:]))
                conf = obj_conf * float(pred[5 + class_id])
            else:
                # Format: [x, y, w, h, conf]
                conf = float(pred[4])
                if conf < self.confidence_threshold:
                    continue
                class_id = 0

            # Convert center format to corner format
            cx, cy, bw, bh = float(pred[0]), float(pred[1]), float(pred[2]), float(pred[3])
            x1 = int((cx - bw / 2) / self.input_size[0] * w)
            y1 = int((cy - bh / 2) / self.input_size[1] * h)
            x2 = int((cx + bw / 2) / self.input_size[0] * w)
            y2 = int((cy + bh / 2) / self.input_size[1] * h)

            detections.append(Detection(
                bbox=(x1, y1, x2, y2),
                confidence=conf,
                class_id=class_id,
            ))

        return DetectionResult(
            frame_number=frame_number,
            detections=detections,
            inference_time_ms=elapsed_ms,
        )


class PlateDetector:
    """High-level plate detector that auto-selects backend.

    Prefers ONNX if model available, falls back to ultralytics.
    """

    def __init__(
        self,
        model_path: str,
        use_onnx: bool = True,
        confidence_threshold: float = 0.5,
    ):
        self._detector = None
        self._use_onnx = use_onnx and HAS_ONNX

        if self._use_onnx and Path(model_path).suffix == ".onnx":
            self._detector = PlateDetectorONNX(
                model_path,
                confidence_threshold=confidence_threshold,
            )
        else:
            # Fall back to ultralytics YOLO
            try:
                from ultralytics import YOLO
                self._detector = YOLO(model_path)
                self._use_onnx = False
                logger.info(f"Using ultralytics YOLO: {model_path}")
            except ImportError:
                raise RuntimeError(
                    "Neither onnxruntime nor ultralytics available. "
                    "Install one: pip install onnxruntime OR pip install ultralytics"
                )

    def detect(self, frame: np.ndarray, frame_number: int = 0) -> DetectionResult:
        """Detect plates in a frame."""
        if self._use_onnx:
            return self._detector.detect(frame, frame_number)

        # Ultralytics path
        import time

        start = time.perf_counter()
        results = self._detector(frame, verbose=False)
        elapsed_ms = (time.perf_counter() - start) * 1000

        detections: list[Detection] = []
        for box in results[0].boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
            detections.append(Detection(
                bbox=(x1, y1, x2, y2),
                confidence=float(box.conf[0]),
                class_id=int(box.cls[0]),
            ))

        return DetectionResult(
            frame_number=frame_number,
            detections=detections,
            inference_time_ms=elapsed_ms,
        )
