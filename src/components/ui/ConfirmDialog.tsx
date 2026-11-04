/* oxlint-disable react/only-export-components */
import { useEffect, useReducer } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  /** Isi pesan. Baris baru (\n) ditampilkan sebagai baris terpisah. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = tombol merah (hapus/tolak), primary = aksi lanjut biasa. */
  tone?: 'primary' | 'danger';
}

interface ActiveConfirm {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

/**
 * Pengganti window.confirm() yang tampilannya mengikuti desain aplikasi.
 * Dipakai dengan await: const ok = await confirmDialog({ ... })
 */
let active: ActiveConfirm | null = null;
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

function settle(confirmed: boolean) {
  const current = active;
  active = null;
  publish();
  current?.resolve(confirmed);
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // Hanya satu dialog aktif: yang lama dianggap dibatalkan
  if (active) {
    settle(false);
  }

  return new Promise<boolean>((resolve) => {
    active = { options, resolve };
    publish();
  });
}

export function GlobalConfirmDialog() {
  const [, forceRender] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    listeners.add(forceRender);

    return () => {
      listeners.delete(forceRender);
    };
  }, []);

  // Tutup lewat Esc atau klik latar sudah ditangani Modal (onClose = batal)
  if (!active) return null;

  const { options } = active;

  return (
    <Modal
      isOpen
      onClose={() => settle(false)}
      title={options.title}
      maxWidth="460px"
      footer={
        <>
          <Button variant="ghost" onClick={() => settle(false)}>
            {options.cancelLabel ?? 'Batal'}
          </Button>
          <Button
            variant={options.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => settle(true)}
            autoFocus
          >
            {options.confirmLabel ?? 'Ya, lanjutkan'}
          </Button>
        </>
      }
    >
      <p className="text-body" style={{ whiteSpace: 'pre-line' }}>
        {options.message}
      </p>
    </Modal>
  );
}
