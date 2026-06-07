// src/utils/iosDetection.ts

/**
 * iOS Safari detection and capability helpers.
 * iOS Safari is the most restrictive browser for camera PWAs.
 */

/** Detect iOS Safari (not Chrome-on-iOS, not iPadOS desktop mode) */
export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iOS Safari: has Safari but NOT CriOS (Chrome) or FxiOS (Firefox)
  return /iP(hone|od|ad)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
}

/** Detect any iOS browser (Safari, Chrome, Firefox — all use WKWebView) */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|od|ad)/.test(navigator.userAgent) 
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS desktop mode
}

/** Check if MediaRecorder is available (iOS Safari ≥14.6) */
export function supportsMediaRecorder(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

/** Check if Web Bluetooth is available (not on iOS) */
export function supportsWebBluetooth(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Get recommended FPS for the current platform.
 * iOS Safari's WASM backend is slower — lower FPS helps.
 */
export function getRecommendedFps(): number {
  if (isIOS()) return 20;
  return 30;
}

/**
 * Get the iOS version number, or null if not iOS.
 * Parses from userAgent: "CPU iPhone OS 16_5 like Mac OS X"
 */
export function getIOSVersion(): number | null {
  if (!isIOS()) return null;
  const match = navigator.userAgent.match(/OS (\d+)[_\d]* like Mac OS X/);
  return match ? parseInt(match[1], 10) : null;
}

/** Whether this device needs the manual "Add to Home Screen" flow */
export function needsManualInstall(): boolean {
  // iOS doesn't show the beforeinstallprompt event
  return isIOS() || (!('BeforeInstallPromptEvent' in window));
}
