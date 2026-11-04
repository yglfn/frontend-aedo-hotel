/* oxlint-disable react/only-export-components */
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import './Toast.css';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  /** Judul pendek, boleh dikosongkan bila pesan sudah cukup jelas. */
  title?: string;
  /** Lamanya tampil dalam ms. 0 = tidak auto-close. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
  variant: ToastVariant;
}

/**
 * Toast global berbasis store kecil (bukan React context) supaya bisa dipanggil
 * dari mana saja, termasuk dari axios interceptor di lib/api.ts.
 */
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 3500,
  info: 4000,
  warning: 6000,
  error: 7000,
};

const MAX_VISIBLE = 4;

let sequence = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function publish() {
  listeners.forEach((listener) => listener(toasts));
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  publish();
}

function push(variant: ToastVariant, message: string, options: ToastOptions = {}) {
  const id = ++sequence;
  const duration = options.duration ?? DEFAULT_DURATION[variant];

  toasts = [...toasts, { id, variant, message, title: options.title, duration }].slice(-MAX_VISIBLE);
  publish();

  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }

  return id;
}

/** Ambil pesan berbahasa Indonesia dari response API (errors[field] > message > error). */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  const errors = data?.errors as Record<string, string[]> | undefined;
  const firstField = errors ? Object.keys(errors)[0] : null;

  if (firstField && Array.isArray(errors?.[firstField]) && errors[firstField].length > 0) {
    return String(errors[firstField][0]);
  }

  return String(data?.message || data?.error || fallback);
}

export const toast = {
  success: (message: string, options?: ToastOptions) => push('success', message, options),
  error: (message: string, options?: ToastOptions) => push('error', message, options),
  warning: (message: string, options?: ToastOptions) => push('warning', message, options),
  info: (message: string, options?: ToastOptions) => push('info', message, options),
  /** Notifikasi gagal dari error axios, memakai pesan server bila ada. */
  apiError: (error: unknown, fallback: string, options?: ToastOptions) =>
    push('error', apiErrorMessage(error, fallback), options),
  dismiss,
};

function subscribe(listener: (items: ToastItem[]) => void) {
  listeners.add(listener);
  listener(toasts);

  return () => {
    listeners.delete(listener);
  };
}

function iconFor(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return <CheckCircle2 size={18} />;
    case 'error':
      return <XCircle size={18} />;
    case 'warning':
      return <AlertTriangle size={18} />;
    default:
      return <Info size={18} />;
  }
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribe(setItems), []);

  if (items.length === 0) return null;

  return (
    <div className="toast-stack" aria-label="Notifikasi">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.variant}`}
          role={t.variant === 'error' || t.variant === 'warning' ? 'alert' : 'status'}
        >
          <span className="toast-icon">{iconFor(t.variant)}</span>
          <div className="toast-text">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-message">{t.message}</div>
          </div>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Tutup notifikasi">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
