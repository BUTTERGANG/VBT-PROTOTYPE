// src/components/CameraLiveLiftScreen.tsx

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLiftStore } from '../store/liftStore';
import { VisionManager, DEFAULT_VISION_CONFIG } from '../services/vision';
import type { VisionState, VisionError, BarPosition } from '../services/vision';
import { feedbackEngine } from '../services/audio/FeedbackEngine';
import { getExerciseConfig, getExerciseList, type ExerciseCategory } from '../services/vision/exerciseConfigs';
import { getLiftingModeConfig, type LiftingMode } from '../services/vision/liftingModes';
import { acceptVideoFile, SetRecorder } from '../services/recording/SetRecorder';
import type { VelocityReading, ZoneResult } from '../types';
import { getZoneColor } from '../utils/zoneCalculator';
import { calculateZone } from '../utils/zoneCalculator';
import { isIOS, supportsMediaRecorder, getRecommendedFps } from '../utils/iosDetection';
import { CameraFramingGuide } from './CameraFramingGuide';

type CameraPhase = 'setup' | 'calibrating' | 'tracking' | 'processing' | 'error';
type InputMode = 'camera-live' | 'camera-record' | 'upload';

// Weight quick-add options in kg
const QUICK_WEIGHTS = [2.5, 5, 10, 20];

export default function CameraLiveLiftScreen({ initialInputMode }: { initialInputMode?: 'camera-live' | 'camera-record' | 'upload' }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visionRef = useRef<VisionManager | null>(null);
  const recorderRef = useRef<SetRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { currentVelocity, currentZone, zoneConfig, addReading, visionSettings, updateVisionSettings } = useLiftStore();

  const [phase, setPhase] = useState<CameraPhase>('setup');
  const [error, setError] = useState<string | null>(null);
  const [visionState, setVisionState] = useState<VisionState>('uninitialized');
  const [detectedPlateWidth, setDetectedPlateWidth] = useState<number | null>(null);
  const [manualPlateWidth, setManualPlateWidth] = useState<string>(String(visionSettings.plateDiameterMm / 10));
  const [repCount, setRepCount] = useState(0);
  const [exerciseCategory, setExerciseCategory] = useState<ExerciseCategory>(visionSettings.exerciseCategory as ExerciseCategory || 'squat');
  const [inputMode, setInputMode] = useState<InputMode>(initialInputMode || 'camera-record');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showFramingGuide, setShowFramingGuide] = useState(false);

  // iOS-specific state
  const isIOSDevice = isIOS();
  const canRecord = supportsMediaRecorder();
  const [iosWarning, setIosWarning] = useState<string | null>(null);

  // Show iOS warnings on mount
  useEffect(() => {
    const warnings: string[] = [];
    if (isIOSDevice) {
      warnings.push('iOS Safari: camera may be slower. Use upload mode if live tracking lags.');
      if (!canRecord) {
        warnings.push('Video recording not supported on this iOS version. Use live or upload mode.');
      }
    }
    setIosWarning(warnings.length > 0 ? warnings.join(' ') : null);
  }, [isIOSDevice, canRecord]);

  // Pause/resume camera when app goes to background (iOS kills camera on lock)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && visionRef.current) {
        // Could pause tracking here; for now just note it
        console.log('App backgrounded — camera may stop on iOS');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  const [liftingMode, setLiftingMode] = useState<LiftingMode>(2);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [lossCueEnabled, setLossCueEnabled] = useState(true);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [metronomeBpm, setMetronomeBpm] = useState(60);
  const [customTargetVelocity, setCustomTargetVelocity] = useState<number | null>(null);
  const [weight, setWeight] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const prevDirection = useRef<'up' | 'down' | null>(null);
  const prevZone = useRef<ZoneResult | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [barPath, setBarPath] = useState<BarPosition[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // Enumerate available cameras on mount
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setCameras(videoInputs);
    }).catch(() => {});
  }, []);

  // Derived values
  const modeConfig = getLiftingModeConfig(liftingMode);
  const exerciseConfig = getExerciseConfig(exerciseCategory);
  const targetVelocity = customTargetVelocity ?? modeConfig.defaultTargetVelocity;
  const zoneColor = getZoneColor(currentZone);

  // Callback ref — keeps videoRef current AND notifies VisionManager when
  // the element changes (e.g. hidden setup video → visible calibrating video)
  const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (el && visionRef.current) {
      visionRef.current.setVideoElement(el);
    }
  }, []);

  // Initialize vision manager
  const initVision = useCallback(async () => {
    setError(null);

    if (!videoRef.current) {
      setError('Camera not available — please reload and allow camera access');
      setPhase('error');
      return;
    }

    try {
      const vm = VisionManager.getInstance({
        ...DEFAULT_VISION_CONFIG,
        plateDiameterMm: visionSettings.plateDiameterMm,
        movementThreshold: exerciseConfig.minRepDisplacement / 20,
        targetFps: getRecommendedFps(),
      });
      vm.updateConfig({
        deviceId: selectedCameraId || undefined,
        plateDiameterMm: visionSettings.plateDiameterMm,
      });
      visionRef.current = vm;

      // Set up loss tracking
      feedbackEngine.setLossThreshold(modeConfig.lossThreshold);
      feedbackEngine.setLossCueEnabled(lossCueEnabled);
      feedbackEngine.setEnabled(audioEnabled);
      feedbackEngine.resetLossTracking();

      // Subscribe to state changes — show camera as soon as it's ready
      vm.subscribeState((state) => {
        setVisionState(state);
        if (state === 'camera-ready' || state === 'calibrated') {
          setPhase('calibrating'); // transitions from setup → camera view
        }
      });

      vm.subscribeError((err: VisionError) => {
        setError(err.message);
        setPhase('error');
      });

      vm.subscribePosition((position: BarPosition) => {
        setBarPath((prev) => {
          const next = [...prev, position];
          // Count reps from direction changes
          if (next.length >= 3) {
            const last = next[next.length - 1];
            const prev = next[next.length - 3];
            const dy = last.y - prev.y;
            if (Math.abs(dy) > 5) {
              const dir = dy < 0 ? 'up' : 'down';
              if (prevDirection.current === 'down' && dir === 'up') {
                setRepCount((c) => c + 1);
                feedbackEngine.playRepComplete();
              }
              prevDirection.current = dir;
            }
          }
          return next.length > 100 ? next.slice(-100) : next;
        });

        // Feed velocity into the store (same as BLE path)
        const reading: VelocityReading = {
          timestamp: position.timestamp ?? Date.now(),
          velocity: Math.abs(position.velocity),
          source: 'camera',
        };
        addReading(reading);

        // Loss cue check
        feedbackEngine.checkVelocityLoss(reading.velocity);

        // Audio zone feedback on zone change
        const newZone = calculateZone(reading.velocity, zoneConfig);
        if (newZone !== prevZone.current) {
          prevZone.current = newZone;
          feedbackEngine.playZoneTone(newZone);
        }

        // Feed to recorder if active
        if (recorderRef.current?.getIsRecording()) {
          recorderRef.current.addPosition(position);
          recorderRef.current.addReading(reading);
        }
      });

      // Subscribe to frame analysis for plate detection feedback
      vm.subscribeAnalysis((analysis) => {
        if (analysis.barbell) {
          const plateWidth = Math.max(analysis.barbell.width, analysis.barbell.height);
          setDetectedPlateWidth(plateWidth);
        }
      });

      await vm.initialize(videoRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize camera');
      setPhase('error');
    }
  }, [visionSettings.plateDiameterMm, addReading]);

  // Calibrate from auto-detected plate
  const handleAutoCalibrate = useCallback(() => {
    if (!visionRef.current || !detectedPlateWidth) return;
    visionRef.current.calibrateFromDetection(detectedPlateWidth);
    updateVisionSettings({
      isCalibrated: true,
      pixelsPerMm: detectedPlateWidth / visionSettings.plateDiameterMm,
    });
    setPhase('tracking');
  }, [detectedPlateWidth, visionSettings.plateDiameterMm, updateVisionSettings]);

  // Calibrate from manual plate width input
  const handleManualCalibrate = useCallback(() => {
    if (!visionRef.current) return;
    const plateWidth = parseFloat(manualPlateWidth);
    if (isNaN(plateWidth) || plateWidth <= 0) {
      setError('Please enter a valid plate diameter in cm');
      return;
    }
    updateVisionSettings({ plateDiameterMm: plateWidth * 10 });
    // For manual calibration, we need the pixel width from the detection
    // If we have a detection, use it. Otherwise, prompt user to draw a box.
    if (detectedPlateWidth) {
      visionRef.current.calibrateFromDetection(detectedPlateWidth);
      updateVisionSettings({
        isCalibrated: true,
        pixelsPerMm: detectedPlateWidth / (plateWidth * 10),
      });
      setPhase('tracking');
    } else {
      setError('No plate detected. Position the camera so the plate is visible and try again.');
    }
  }, [manualPlateWidth, detectedPlateWidth, updateVisionSettings]);

  // Start tracking (with optional recording)
  const handleStartTracking = useCallback(() => {
    if (!visionRef.current) return;
    visionRef.current.startTracking();
    setPhase('tracking');
    setRepCount(0);
    feedbackEngine.resetLossTracking();

    // Start recording if in camera-record mode
    if (inputMode === 'camera-record' && videoRef.current) {
      const stream = (videoRef.current as HTMLVideoElement & { srcObject?: MediaStream }).srcObject;
      if (stream) {
        const recorder = new SetRecorder();
        recorderRef.current = recorder;
        recorder.start(stream, true);
        setIsRecording(true);
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      }
    }

    // Start metronome if enabled
    if (metronomeEnabled && metronomeBpm > 0) {
      feedbackEngine.startMetronome(metronomeBpm);
    }
  }, [inputMode, metronomeEnabled, metronomeBpm]);

  // Stop tracking + processing
  const handleStopTracking = useCallback(async () => {
    if (!visionRef.current) return;
    visionRef.current.stopTracking();
    feedbackEngine.stopMetronome();

    // Stop recording
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recorderRef.current?.getIsRecording()) {
      await recorderRef.current.stop();
      setIsRecording(false);
    }

    feedbackEngine.playSetComplete();

    // Show processing overlay
    setPhase('processing');

    // Build set review data and transition
    // (In a real implementation, we'd navigate to SetReviewScreen here)
    setTimeout(() => {
      setPhase('setup');
    }, 2000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      visionRef.current?.dispose();
    };
  }, []);

  // Draw overlay on canvas
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw bar path
      if (barPath.length > 1) {
        ctx.strokeStyle = zoneColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(barPath[0].x, barPath[0].y);
        for (let i = 1; i < barPath.length; i++) {
          ctx.lineTo(barPath[i].x, barPath[i].y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Draw current position dot
      if (barPath.length > 0) {
        const last = barPath[barPath.length - 1];
        ctx.fillStyle = zoneColor;
        ctx.beginPath();
        ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [barPath, zoneColor]);

  // --- Render: Setup Phase ---
  if (phase === 'setup') {
    const exerciseConfig = getExerciseConfig(exerciseCategory);
    const exerciseList = getExerciseList();

    const inputStyle = {
      width: '100%' as const,
      padding: 'var(--space-3)',
      backgroundColor: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--color-text-primary)',
      fontSize: '14px',
    };

    return (
      <>
      <div
        className="flex flex-col items-center justify-center"
        style={{
          minHeight: 'calc(100vh - 120px)',
          padding: 'var(--space-4)',
          paddingBottom: '80px',
          overflowY: 'auto',
        }}
      >
        <div className="flex items-center justify-between" style={{ width: '100%', maxWidth: '500px', marginBottom: 'var(--space-4)' }}>
          <div>
            <h1 className="text-heading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
              Camera Mode
            </h1>
            <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Vision-based barbell tracking
            </div>
          </div>
          <button
            onClick={() => setShowFramingGuide(true)}
            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', color: 'var(--color-text-muted)', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          >
            ? Framing
          </button>
        </div>

        {/* iOS warning */}
        {iosWarning && (
          <div style={{ width: '100%', maxWidth: '500px', marginBottom: 'var(--space-3)', padding: 'var(--space-3)', backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #f59e0b', fontSize: '12px', color: '#f59e0b' }}>
            ⚠ {iosWarning}
          </div>
        )}

        {/* Camera Framing Guide Overlay */}
        {showFramingGuide && (
          <CameraFramingGuide
            exerciseCategory={exerciseCategory}
            onDismiss={() => setShowFramingGuide(false)}
          />
        )}

        {/* 1. Exercise selector */}
        <div className="card" style={{ width: '100%', maxWidth: '500px', marginBottom: 'var(--space-4)' }}>
          <div className="text-subheading" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
            1. Select Exercise
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'var(--space-2)',
            }}
          >
            {exerciseList.map(({ category, label, icon }) => (
              <button
                key={category}
                onClick={() => {
                  setExerciseCategory(category);
                  updateVisionSettings({ exerciseCategory: category });
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: exerciseCategory === category ? '2px solid var(--color-brand)' : '1px solid var(--color-border)',
                  backgroundColor: exerciseCategory === category ? 'var(--color-brand)15' : 'transparent',
                  color: exerciseCategory === category ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  minHeight: '60px',
                }}
              >
                <span style={{ fontSize: '20px' }}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Input mode */}
        <div className="card" style={{ width: '100%', maxWidth: '500px', marginBottom: 'var(--space-4)' }}>
          <div className="text-subheading" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
            2. Video Source
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            {([
              { mode: 'camera-record' as InputMode, label: 'Record', desc: 'Record + analyze live', icon: '🎬' },
              { mode: 'camera-live' as InputMode, label: 'Live', desc: 'Analyze only, no video', icon: '⚡' },
              { mode: 'upload' as InputMode, label: 'Upload', desc: 'Process existing video', icon: '📁' },
            ]).map(({ mode, label, desc, icon }) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: inputMode === mode ? '2px solid var(--color-brand)' : '1px solid var(--color-border)',
                  backgroundColor: inputMode === mode ? 'var(--color-brand)15' : 'transparent',
                  color: inputMode === mode ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  minHeight: '60px',
                }}
              >
                <span style={{ fontSize: '18px' }}>{icon}</span>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>{desc}</span>
              </button>
            ))}
          </div>

          {/* Upload file picker */}
          {inputMode === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setUploadError(null);
                  if (file) {
                    const result = acceptVideoFile(file);
                    if (result.valid) {
                      setUploadFile(file);
                    } else {
                      setUploadError(result.error || 'Invalid file');
                      setUploadFile(null);
                    }
                  }
                }}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-pill"
                style={{ width: '100%', padding: 'var(--space-3)', marginBottom: uploadFile ? 'var(--space-2)' : 0 }}
              >
                📁 Choose Video
              </button>
              {uploadFile && (
                <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(1)}MB)
                </div>
              )}
              {uploadError && (
                <div style={{ padding: 'var(--space-2)', color: '#ef4444', fontSize: '12px' }}>
                  {uploadError}
                </div>
              )}
            </div>
          )}

          {/* Camera placement instructions */}
          {inputMode !== 'upload' && (
            <div>
              <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>
                Camera placement ({exerciseConfig.label}):
              </div>
              {exerciseConfig.placementInstructions.map((instruction, i) => (
                <div key={i} className="text-caption" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
                  {instruction}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Plate diameter & settings */}
        <div className="card" style={{ width: '100%', maxWidth: '500px', marginBottom: 'var(--space-4)' }}>
          <div className="text-subheading" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
            3. Settings
          </div>

          {/* Camera selector — shown when multiple cameras or labels are available */}
          {cameras.length > 0 && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
                Camera
              </label>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Default camera</option>
                {cameras.map((cam, i) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
              Plate diameter (cm)
            </label>
            <select
              value={manualPlateWidth}
              onChange={(e) => {
                setManualPlateWidth(e.target.value);
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) updateVisionSettings({ plateDiameterMm: val * 10 });
              }}
              style={inputStyle}
            >
              <option value={String(exerciseConfig.defaultPlateDiameterMm / 10)}>{exerciseConfig.defaultPlateDiameterMm / 10}cm (Default for {exerciseConfig.label})</option>
              <option value="45">45cm (Olympic Bumper)</option>
              <option value="35">35cm (Standard Iron)</option>
              <option value="25">25cm (Small Plates)</option>
              <option value="custom">Custom...</option>
            </select>
            {manualPlateWidth === 'custom' && (
              <input
                type="number"
                placeholder="Enter plate diameter in cm"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) updateVisionSettings({ plateDiameterMm: val * 10 });
                }}
                style={{ ...inputStyle, marginTop: 'var(--space-2)' }}
              />
            )}
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
              Target velocity: {exerciseConfig.defaultTargetVelocity.toFixed(2)} m/s ± {exerciseConfig.defaultTolerance.toFixed(2)}
            </div>
            <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
              Typical range for {exerciseConfig.label}: {exerciseConfig.typicalVelocityRange[0].toFixed(2)} – {exerciseConfig.typicalVelocityRange[1].toFixed(2)} m/s
            </div>
          </div>

          {/* Start button */}
          {inputMode === 'upload' ? (
            <button
              onClick={async () => {
                if (!uploadFile) {
                  setUploadError('Please select a video file first');
                  return;
                }
                setUploadError(null);
                setPhase('processing');
                try {
                  const { VideoProcessor } = await import('../services/recording/VideoProcessor');
                  const proc = new VideoProcessor();
                  const result = await proc.process(
                    uploadFile,
                    visionSettings.plateDiameterMm,
                    (_progress) => { /* could show progress bar */ },
                    (reading) => { addReading(reading); },
                  );
                  if (result.readings.length > 0) {
                    updateVisionSettings({ isCalibrated: result.calibrated });
                    setRepCount(result.repCount);
                  } else {
                    setUploadError('No barbell detected in video. Try a clip with the bar clearly visible.');
                  }
                  setPhase('setup');
                } catch (err: any) {
                  setUploadError(err.message || 'Failed to process video');
                  setPhase('setup');
                }
              }}
              disabled={!uploadFile}
              className="btn btn-pill btn-brand"
              style={{ width: '100%', padding: 'var(--space-3)', opacity: uploadFile ? 1 : 0.5 }}
            >
              Process Video
            </button>
          ) : (
            <button
              onClick={initVision}
              className="btn btn-pill btn-brand"
              style={{ width: '100%', padding: 'var(--space-3)' }}
            >
              {inputMode === 'camera-record' ? 'Record + Analyze' : 'Start Camera'}
            </button>
          )}
        </div>
      </div>

      {/* Hidden video always mounted so videoRef is populated before button click */}
      <video ref={handleVideoRef} autoPlay playsInline muted
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
      </>
    );
  }

  // --- Render: Error ---
  if (phase === 'error') {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{
          minHeight: 'calc(100vh - 120px)',
          padding: 'var(--space-4)',
          paddingBottom: '80px',
        }}
      >
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', maxWidth: '500px' }}>
          <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>⚠️</div>
          <div className="text-body" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
            Camera Error
          </div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            {error || 'An unknown error occurred'}
          </div>
          <button
            onClick={() => {
              setPhase('setup');
              setError(null);
            }}
            className="btn btn-pill btn-brand"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // --- Render: Calibrating ---
  if (phase === 'calibrating') {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{
          minHeight: 'calc(100vh - 120px)',
          padding: 'var(--space-4)',
          paddingBottom: '80px',
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '500px', marginBottom: 'var(--space-4)' }}>
          <video
            ref={handleVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#1a1a1a',
              aspectRatio: '16/9',
              objectFit: 'cover',
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div className="card" style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>
          <div className="text-subheading" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
            Calibrate
          </div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            {visionState === 'calibrated'
              ? 'Plate detected! Confirm to start tracking.'
              : 'Looking for barbell plate...'}
          </div>

          {detectedPlateWidth && (
            <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
              Detected plate width: {detectedPlateWidth.toFixed(0)}px
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={() => {
                handleAutoCalibrate();
                handleStartTracking();
              }}
              disabled={!detectedPlateWidth}
              className="btn btn-pill btn-brand"
              style={{ flex: 1, padding: 'var(--space-3)', opacity: detectedPlateWidth ? 1 : 0.5 }}
            >
              Auto Calibrate
            </button>
            <button
              onClick={() => {
                handleManualCalibrate();
                handleStartTracking();
              }}
              className="btn btn-pill"
              style={{ flex: 1, padding: 'var(--space-3)' }}
            >
              Manual
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Processing (analyzing) ---
  if (phase === 'processing') {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{
          minHeight: 'calc(100vh - 120px)',
          padding: 'var(--space-4)',
          paddingBottom: '80px',
        }}
      >
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', maxWidth: '500px' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🔍</div>
          <div className="text-subheading" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
            Analyzing Set
          </div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            Processing {repCount} reps...
          </div>
          <div style={{ width: '200px', height: '4px', backgroundColor: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden', margin: '0 auto' }}>
            <div style={{ width: '60%', height: '100%', backgroundColor: 'var(--color-brand)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Tracking ---
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      {/* Full-screen camera preview */}
      <div style={{ position: 'relative', width: '100%', height: '100dvh', backgroundColor: '#000' }}>
        <video
          ref={handleVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />

        {/* Tap anywhere to show/hide controls */}
        <div
          onClick={() => setShowControls(!showControls)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
          }}
        />

        {/* Top bar: status + recording indicator */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: 'var(--space-3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 2,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {isRecording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'pulse 1s ease-in-out infinite' }} />
                <span style={{ color: '#ef4444', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>REC</span>
              </div>
            )}
            {isRecording && (
              <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{formatTime(recordingTime)}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ color: '#fff', fontSize: '11px', fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
              {exerciseConfig.icon} {exerciseConfig.label}
            </span>
            <span style={{ color: modeConfig.color, fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              M{liftingMode}
            </span>
          </div>
        </div>

        {/* Center: large velocity display */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: zoneColor,
              fontSize: 'clamp(48px, 15vw, 96px)',
              lineHeight: 1,
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            {currentVelocity.toFixed(2)}
          </div>
          <div style={{ color: '#fff', fontSize: '14px', opacity: 0.7, marginTop: '4px' }}>m/s</div>
          <div
            style={{
              marginTop: 'var(--space-2)',
              padding: '4px 12px',
              backgroundColor: `${zoneColor}30`,
              borderRadius: '999px',
              border: `1px solid ${zoneColor}50`,
              color: zoneColor,
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              display: 'inline-block',
            }}
          >
            {currentZone === 'IN_RANGE' ? '✓ IN ZONE' : currentZone === 'FAST' ? '↑ TOO FAST' : '↓ TOO SLOW'}
          </div>
        </div>

        {/* Bottom: rep counter + stop button */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 'var(--space-3)',
            zIndex: 2,
            background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#fff', fontSize: '10px', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>REPS</div>
              <div style={{ color: '#fff', fontSize: '32px', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{repCount}</div>
            </div>
            <button
              onClick={handleStopTracking}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Stop
            </button>
          </div>
        </div>

        {/* Controls overlay (toggled by tap) */}
        {showControls && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: 'var(--space-4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
              {/* Close button */}
              <button
                onClick={() => setShowControls(false)}
                style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>

              {/* Lifting mode selector */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)' }}>MODE</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {([1, 2, 3] as LiftingMode[]).map((mode) => {
                    const cfg = getLiftingModeConfig(mode);
                    return (
                      <button
                        key={mode}
                        onClick={() => setLiftingMode(mode)}
                        style={{
                          flex: 1,
                          padding: 'var(--space-2)',
                          borderRadius: 'var(--radius-md)',
                          border: liftingMode === mode ? `2px solid ${cfg.color}` : '1px solid rgba(255,255,255,0.2)',
                          backgroundColor: liftingMode === mode ? `${cfg.color}20` : 'transparent',
                          color: liftingMode === mode ? '#fff' : 'rgba(255,255,255,0.6)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>M{mode}</div>
                        <div style={{ fontSize: '10px', opacity: 0.7 }}>{cfg.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target velocity slider */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>TARGET VELOCITY</span>
                  <span style={{ color: modeConfig.color }}>{targetVelocity.toFixed(2)} m/s</span>
                </div>
                <input
                  type="range"
                  min={modeConfig.velocityRange[0]}
                  max={modeConfig.velocityRange[1]}
                  step={0.01}
                  value={customTargetVelocity ?? modeConfig.defaultTargetVelocity}
                  onChange={(e) => setCustomTargetVelocity(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: modeConfig.color }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                  <span>{modeConfig.velocityRange[0].toFixed(2)}</span>
                  <span>{modeConfig.velocityRange[1].toFixed(2)}</span>
                </div>
                {customTargetVelocity !== null && (
                  <button
                    onClick={() => setCustomTargetVelocity(null)}
                    style={{ marginTop: 'var(--space-1)', fontSize: '10px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Reset to mode default
                  </button>
                )}
              </div>

              {/* Weight input */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)' }}>WEIGHT (kg)</div>
                <input
                  type="number"
                  value={weight || ''}
                  onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '16px',
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'center',
                  }}
                />
                <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
                  {QUICK_WEIGHTS.map((w) => (
                    <button
                      key={w}
                      onClick={() => setWeight(prev => prev + w)}
                      style={{
                        flex: 1,
                        padding: 'var(--space-1)',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fff',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      +{w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio controls */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)' }}>AUDIO</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <ToggleButton label="Cues" active={audioEnabled} onClick={() => {
                    setAudioEnabled(!audioEnabled);
                    feedbackEngine.setEnabled(!audioEnabled);
                  }} />
                  <ToggleButton label="Loss Alert" active={lossCueEnabled} onClick={() => {
                    setLossCueEnabled(!lossCueEnabled);
                    feedbackEngine.setLossCueEnabled(!lossCueEnabled);
                  }} />
                  <ToggleButton label="Metronome" active={metronomeEnabled} onClick={() => {
                    const next = !metronomeEnabled;
                    setMetronomeEnabled(next);
                    if (next) feedbackEngine.startMetronome(metronomeBpm);
                    else feedbackEngine.stopMetronome();
                  }} />
                </div>
                {metronomeEnabled && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <input
                      type="range"
                      min={30}
                      max={120}
                      step={5}
                      value={metronomeBpm}
                      onChange={(e) => {
                        const bpm = parseInt(e.target.value);
                        setMetronomeBpm(bpm);
                        feedbackEngine.setMetronomeBpm(bpm);
                      }}
                      style={{ width: '100%', accentColor: '#10b981' }}
                    />
                    <div style={{ textAlign: 'center', color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{metronomeBpm} BPM</div>
                  </div>
                )}
              </div>

              {/* Camera controls */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)' }}>CAMERA</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    onClick={() => {
                      // Toggle front/back camera
                      // This would require re-initializing the camera stream
                    }}
                    style={{
                      flex: 1,
                      padding: 'var(--space-2)',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    🔄 Flip
                  </button>
                  <button
                    onClick={() => setShowControls(false)}
                    style={{
                      flex: 1,
                      padding: 'var(--space-2)',
                      backgroundColor: 'var(--color-brand)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: '#000',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: '999px',
        border: active ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.2)',
        backgroundColor: active ? '#10b98120' : 'transparent',
        color: active ? '#10b981' : 'rgba(255,255,255,0.5)',
        fontSize: '11px',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
