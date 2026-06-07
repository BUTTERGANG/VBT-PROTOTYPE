// src/hooks/usePWAInstall.ts

import { useState, useEffect } from 'react';
import { isIOS, needsManualInstall } from '../utils/iosDetection';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOSDevice] = useState(isIOS());
  const [showIOSBanner, setShowIOSBanner] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // iOS: never gets beforeinstallprompt, show manual instructions instead
    if (needsManualInstall()) {
      // Check if we've already shown the banner (don't be annoying)
      try {
        const dismissed = localStorage.getItem('vbt_ios_banner_dismissed');
        if (!dismissed) {
          setIsInstallable(true); // Show the install UI (with iOS-specific flow)
          setShowIOSBanner(true);
        }
      } catch {}
      return;
    }

    // Android/Chrome: standard beforeinstallprompt flow
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const promptInstall = async () => {
    // iOS: can't programmatically install
    if (needsManualInstall()) {
      // The banner is already showing; nothing more to do programmatically
      // User must manually: Safari > Share > Add to Home Screen
      return;
    }

    if (!deferredPrompt) return;
    // @ts-expect-error BeforeInstallPromptEvent not in TS lib
    await deferredPrompt.prompt();
    // @ts-expect-error
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const dismissIOSBanner = () => {
    setShowIOSBanner(false);
    setIsInstallable(false);
    try { localStorage.setItem('vbt_ios_banner_dismissed', 'true'); } catch {}
  };

  return { isInstallable, isInstalled, promptInstall, isIOSDevice, showIOSBanner, dismissIOSBanner };
}
