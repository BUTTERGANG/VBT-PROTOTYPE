// src/components/SyncIndicator.tsx

import { useState, useEffect } from 'react';
import { localCache } from '../services/storage/LocalCache';

/**
 * Shows a small dot in the nav bar indicating sync status.
 * Green = all synced, Yellow = unsynced items, Red = sync error
 */
export function SyncIndicator() {
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      try {
        const sessions = await localCache.getUnsyncedSessions();
        const readings = await localCache.getUnsyncedReadings();
        setUnsyncedCount(sessions.length + readings.length);
      } catch {
        setUnsyncedCount(-1); // error state
      }
    };

    check();
    const interval = setInterval(check, 30_000); // check every 30s
    return () => clearInterval(interval);
  }, []);

  if (unsyncedCount === 0) {
    return <span style={{ color: '#10b981', fontSize: '8px' }}>●</span>;
  }
  if (unsyncedCount < 0) {
    return <span style={{ color: '#ef4444', fontSize: '8px' }}>●</span>;
  }
  return (
    <span style={{ color: '#f59e0b', fontSize: '8px' }} title={`${unsyncedCount} items pending sync`}>
      ●
    </span>
  );
}
