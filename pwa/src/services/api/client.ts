// src/services/api/client.ts

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Sessions
  getSessions: (params?: { athlete_id?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return request<any[]>(`/sessions?${q}`);
  },
  getSession: (id: string) => request<any>(`/sessions/${id}`),

  // Athletes
  getAthletes: () => request<any[]>('/athletes'),
  createAthlete: (data: any) => request<any>('/athletes', { method: 'POST', body: JSON.stringify(data) }),
  updateAthlete: (id: string, data: any) => request<any>(`/athletes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAthlete: (id: string) => request<any>(`/athletes/${id}`, { method: 'DELETE' }),

  // Programs
  getPrograms: (params?: { athlete_id?: string; active?: boolean }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return request<any[]>(`/programs?${q}`);
  },
  createProgram: (data: any) => request<any>('/programs', { method: 'POST', body: JSON.stringify(data) }),
  updateProgram: (id: string, data: any) => request<any>(`/programs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProgram: (id: string) => request<any>(`/programs/${id}`, { method: 'DELETE' }),

  // Analytics
  getDashboard: (params?: { athlete_id?: string; days?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return request<any>(`/analytics/dashboard?${q}`);
  },
  getHistory: (params?: { athlete_id?: string; exercise?: string; from?: string; to?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return request<any>(`/analytics/history?${q}`);
  },

  // Sync
  syncBatch: (data: any) => request<any>('/sync/batch', { method: 'POST', body: JSON.stringify(data) }),

  // Autoregulation
  autoregulate: (data: {
    athlete_id: string;
    athlete_profile?: { baseline_velocity?: number; fatigue_threshold?: number; bodyweight?: number };
    session_data: {
      exercise: string;
      sets: Array<{ set_number: number; reps: Array<{ mean_velocity: number; peak_velocity: number; zone_result: string }>; target_velocity?: number; target_tolerance?: number }>;
      target_velocity?: number;
      target_tolerance?: number;
    };
  }) => request<any>('/autoregulate', { method: 'POST', body: JSON.stringify(data) }),
};
