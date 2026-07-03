'use client';

import { create } from 'zustand';
import { apiFetch, type ApiError } from './api';

/** Public user shape returned by the API (mirrors domain PublicUser). */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'instructor' | 'student' | 'alumnus';
  status: string;
  emailVerified: boolean;
  notificationPreferences: { email: boolean; sms: boolean; inApp: boolean };
}

interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
  /** 'unknown' until the initial refresh attempt resolves. */
  status: 'unknown' | 'anon' | 'authed';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  setUser: (user: SessionUser) => void;
  /** Authenticated fetch that transparently refreshes the access token once on 401. */
  authedFetch: <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  status: 'unknown',

  login: async (email, password) => {
    const data = await apiFetch<{ user: SessionUser; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    set({ user: data.user, accessToken: data.accessToken, status: 'authed' });
  },

  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      set({ user: null, accessToken: null, status: 'anon' });
    }
  },

  // On app load, try to mint an access token from the httpOnly refresh cookie.
  loadSession: async () => {
    try {
      const { accessToken } = await apiFetch<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      });
      const user = await apiFetch<SessionUser>('/users/me', { accessToken });
      set({ user, accessToken, status: 'authed' });
    } catch {
      set({ user: null, accessToken: null, status: 'anon' });
    }
  },

  setUser: (user) => set({ user }),

  authedFetch: async <T,>(path: string, options: { method?: string; body?: unknown } = {}) => {
    const attempt = (token: string | null) =>
      apiFetch<T>(path, { ...options, accessToken: token });
    try {
      return await attempt(get().accessToken);
    } catch (err) {
      if ((err as ApiError).status !== 401) throw err;
      // Refresh once, then retry.
      const { accessToken } = await apiFetch<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      });
      set({ accessToken, status: 'authed' });
      return attempt(accessToken);
    }
  },
}));
