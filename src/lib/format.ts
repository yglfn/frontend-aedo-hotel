import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

/**
 * API mengirim kolom uang sebagai string desimal ("777000.00") dan kolom hasil
 * agregasi SQL kadang ikut berupa string. Ubah dulu jadi angka sebelum berhitung,
 * kalau tidak penjumlahan berubah jadi penyambungan string (NaN / total 0).
 */
export const toNumber = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const numeric = typeof value === 'number' ? value : parseFloat(value);

  return Number.isFinite(numeric) ? numeric : 0;
};

/**
 * Persentase bagian terhadap total, aman untuk total 0.
 */
export const shareOf = (part: number, total: number): number => {
  if (!total) return 0;

  return Math.round((toNumber(part) / toNumber(total)) * 1000) / 10;
};

/**
 * Format string atau number ke format Rupiah (tanpa desimal)
 * Sesuai aturan: Uang dikirim sebagai desimal "777000.00" dari API, tampilkan tanpa desimal.
 */
export const formatIDR = (value: number | string): string => {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue)) return 'Rp 0';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(numericValue);
};

/**
 * Format angka pendek untuk grafik: 1500000 -> "1,5 jt".
 * Label sumbu harus muat sempit; angka penuh tetap tersedia di tooltip & tabel.
 */
export const formatCompactIDR = (value: number | string): string => {
  const numericValue = toNumber(value);

  if (numericValue === 0) return 'Rp 0';

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(numericValue);
};

/**
 * Format string tanggal (YYYY-MM-DD) ke format Indonesia yang mudah dibaca.
 * Contoh: "9 Okt 2026"
 */
export const formatDateShort = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    const date = parseISO(dateString);
    return format(date, 'd MMM yyyy', { locale: id });
  } catch (e) {
    return dateString;
  }
};

/**
 * Format string tanggal (YYYY-MM-DD) ke format Indonesia lengkap dengan hari.
 * Contoh: "Jumat, 9 Oktober 2026"
 */
export const formatDateLong = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    const date = parseISO(dateString);
    return format(date, 'EEEE, d MMMM yyyy', { locale: id });
  } catch (e) {
    return dateString;
  }
};

/**
 * Maskir KTP.
 * Contoh: "3171123456780001" -> "3171••••••••0001"
 */
export const maskKtp = (ktp: string): string => {
  if (!ktp || ktp.length < 8) return ktp;
  const first = ktp.substring(0, 4);
  const last = ktp.substring(ktp.length - 4);
  return `${first}••••••••${last}`;
};
