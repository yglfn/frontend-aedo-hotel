import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

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
