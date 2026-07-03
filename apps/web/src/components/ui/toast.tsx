'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { cn } from '@/lib/cn';

/**
 * Toast / inline notification (UI/UX §2.5, voice §7: plain, active, no apology).
 * Announced via an aria-live region so screen readers hear it without focus theft (§6).
 */
export type ToastTone = 'default' | 'live' | 'alert';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

let seq = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, tone = 'default') =>
    set((s) => ({ toasts: [...s.toasts, { id: `t${++seq}`, message, tone }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience hook: `const toast = useToast(); toast('Published');` */
export function useToast() {
  return useToastStore((s) => s.push);
}

const TONE_CLASSES: Record<ToastTone, string> = {
  default: 'border-neutral-200 bg-surface-0 text-ink-900',
  live: 'border-accent-live bg-surface-0 text-ink-900',
  alert: 'border-accent-alert bg-surface-0 text-accent-alert',
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center justify-between gap-3 rounded-card border px-4 py-3 text-sm shadow-sm',
        TONE_CLASSES[toast.tone],
      )}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-neutral-600 hover:text-ink-900"
      >
        ✕
      </button>
    </div>
  );
}

/** Mount once near the root (added to the design-system demo and later app shells). */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
