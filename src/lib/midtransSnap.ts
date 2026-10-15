/**
 * Membuka halaman bayar Midtrans secara OTOMATIS di dalam aplikasi.
 *
 * Perilaku SDK Snap (dibaca langsung dari https://app.sandbox.midtrans.com/snap/snap.js):
 *  - SDK membuat <iframe id="snap-midtrans"> di dokumen kita, lalu menampilkannya
 *    sebagai overlay (showPopup) atau di dalam container (showEmbedded, opsi embedId).
 *  - API-nya snap.pay(token, options) dengan events camelCase:
 *    onSuccess / onPending / onError / onClose. Opsi nama lain tidak dikenal SDK.
 *  - SDK mengambil client key dari atribut data-client-key pada tag script-nya sendiri.
 *
 * Jadi tidak ada window.open dan tidak terkena popup blocker. Yang dulu membuat
 * "Menyiapkan halaman pembayaran..." menggantung selamanya: snap.pay melempar error
 * (opsi tak dikenal) dan janjinya tidak pernah selesai tanpa timeout. Keduanya kini
 * ditangani, dan setiap kegagalan ditampilkan apa adanya.
 */

export interface MidtransPaymentInfo {
  token?: string | null;
  client_key?: string | null;
  snap_js_url?: string | null;
  redirect_url?: string | null;
}

export interface SnapHandlers {
  onSuccess?: (result?: unknown) => void;
  onPending?: (result?: unknown) => void;
  onError?: (result?: unknown) => void;
  onClose?: () => void;
}

export type SnapOpenResult = 'snap' | 'redirect' | 'blocked' | 'nothing';

export interface SnapOpenOutcome {
  result: SnapOpenResult;
  /** Alasan teknis singkat untuk ditampilkan ke staf bila jalur otomatis gagal */
  error?: string;
}

/** Snap JS tidak boleh membuat kita menunggu selamanya: overlay atau fallback. */
const SCRIPT_TIMEOUT_MS = 6000;

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: Record<string, unknown>) => void;
      init?: (clientKey: string) => void;
      hide?: () => void;
      show?: () => void;
    };
  }
}

const loadedScripts = new Map<string, Promise<boolean>>();

// Satu token hanya boleh dibuka sekali: effect React (StrictMode/dev) dapat berjalan dua kali,
// dan pay() ganda membuat overlay Midtrans saling menimpa.
const openedTokens = new Set<string>();

function hasSnapReady(): boolean {
  return typeof window.snap?.pay === 'function';
}

function loadSnapScript(url: string, clientKey: string): Promise<boolean> {
  const cacheKey = `${url}|${clientKey}`;
  const existing = loadedScripts.get(cacheKey);
  if (existing) return existing;

  const loading = new Promise<boolean>((resolve) => {
    if (hasSnapReady()) {
      resolve(true);
      return;
    }

    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ready);
    };

    const timer = window.setTimeout(() => finish(hasSnapReady()), SCRIPT_TIMEOUT_MS);

    const script = document.createElement('script');
    // src dan data-client-key harus ada sebelum script disisipkan: SDK membaca atribut
    // itu dari tag script-nya sendiri saat dieksekusi.
    script.async = true;
    script.src = url;
    script.setAttribute('data-client-key', clientKey);
    script.onload = () => finish(hasSnapReady());
    script.onerror = () => {
      loadedScripts.delete(cacheKey);
      finish(false);
    };
    document.body.appendChild(script);
  });

  loadedScripts.set(cacheKey, loading);
  return loading;
}

/**
 * Buka pembayaran Midtrans sebagai overlay di dalam halaman ini.
 */
export async function openMidtransPayment(
  info: MidtransPaymentInfo | null | undefined,
  handlers: SnapHandlers = {}
): Promise<SnapOpenOutcome> {
  if (!info) return { result: 'nothing', error: 'Data pembayaran tidak ada.' };

  const token = info.token;
  const clientKey = info.client_key;
  const snapJsUrl = info.snap_js_url;
  const redirectUrl = info.redirect_url;

  if (token && clientKey && snapJsUrl) {
    if (openedTokens.has(token)) {
      return { result: 'snap' };
    }

    const ready = await loadSnapScript(snapJsUrl, clientKey);

    if (ready) {
      try {
        window.snap!.pay(token, {
          onSuccess: (result?: unknown) => handlers.onSuccess?.(result),
          onPending: (result?: unknown) => handlers.onPending?.(result),
          onError: (result?: unknown) => handlers.onError?.(result),
          onClose: () => handlers.onClose?.(),
        });

        openedTokens.add(token);

        return { result: 'snap' };
      } catch (error) {
        console.error('snap.pay() gagal', error);

        return {
          result: 'nothing',
          error: 'Popup gagal dibuka - tekan Bayar.',
        };
      }
    }

    console.warn('Snap.js tidak siap dalam batas waktu, memakai tautan pembayaran.');

    if (redirectUrl) {
      return openRedirect(redirectUrl, 'Popup gagal dimuat - dibuka di tab baru.');
    }

    return { result: 'nothing', error: 'Popup gagal dimuat.' };
  }

  if (redirectUrl) {
    // Bayar di tab lain: normal untuk pembayaran yang dibuat sebelum frontend Snap tersedia.
    return openRedirect(redirectUrl, 'Dibuka di tab baru.');
  }

  return { result: 'nothing', error: 'Tautan pembayaran tidak ditemukan.' };
}

function openRedirect(url: string, reason?: string): SnapOpenOutcome {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');

  return opened
    ? { result: 'redirect', error: reason }
    : { result: 'blocked', error: reason ?? 'Browser memblokir jendela pembayaran.' };
}

/** Sembunyikan overlay Snap (mis. saat modal ditutup) supaya tidak tertinggal di layar. */
export function hideMidtransOverlay(): void {
  try {
    window.snap?.hide?.();
  } catch (error) {
    console.error('snap.hide() gagal', error);
  }
}

/**
 * Ambil transaction_id provider dari payload hasil Snap JS.
 *
 * Midtrans memakai nama field yang berbeda per kanal/versi, dan untuk e-wallet hasil Snap
 * hanya id inilah yang dikenali API status mereka. Nilai ini bukan bukti bayar: ia cuma
 * dikirim sebagai petunjuk supaya backend menanyakannya ulang ke gateway.
 */
export function snapResultTransactionId(result?: unknown): string | null {
  if (!result) return null;

  // Sebagian versi Snap JS mengirim string ('success' / 'pending'), bukan objek
  if (typeof result !== 'object') return null;

  const levels: Record<string, unknown>[] = [result as Record<string, unknown>];
  const nested = (result as Record<string, unknown>).data;

  if (nested && typeof nested === 'object') {
    levels.push(nested as Record<string, unknown>);
  }

  for (const level of levels) {
    for (const key of ['transaction_id', 'transactionId', 'trade_no', 'provider_transaction_id']) {
      const value = typeof level[key] === 'string' ? (level[key] as string).trim() : '';

      if (value !== '') {
        return value;
      }
    }
  }

  return null;
}
