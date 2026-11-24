/* oxlint-disable react/immutability */
import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Building2, Trash2, Upload } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { apiErrorMessage, toast } from '../../components/ui/Toast';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { api, clearGetCache } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import './SettingsPage.css';

interface HotelSettings {
  hotel_name: string;
  hotel_address: string;
  hotel_phone: string;
  hotel_photo_url: string | null;
  default_check_in: string;
  default_check_out: string;
  tax_percentage: string;
  min_dp_percentage: string;
  payment_verification_enabled: boolean;
}

const defaultSettings: HotelSettings = {
  hotel_name: '',
  hotel_address: '',
  hotel_phone: '',
  hotel_photo_url: null,
  default_check_in: '14:00',
  default_check_out: '12:00',
  tax_percentage: '11.00',
  min_dp_percentage: '0',
  payment_verification_enabled: true,
};

const SETTINGS_FIELD_LABELS: Record<string, string> = {
  hotel_name: 'Nama hotel',
  hotel_address: 'Alamat',
  hotel_phone: 'Telepon',
  hotel_email: 'Email',
  default_check_in: 'Jam check-in',
  default_check_out: 'Jam check-out',
  tax_percentage: 'Pajak',
  min_dp_percentage: 'Minimal DP',
  payment_verification_enabled: 'Verifikasi pembayaran',
  hotel_photo: 'Foto hotel',
  remove_hotel_photo: 'Penghapusan foto',
};

function settingsErrorMessage(error: unknown): string {
  const errors = (error as { response?: { data?: { errors?: Record<string, string[]> } } })
    ?.response?.data?.errors;

  if (errors && Object.keys(errors).length > 0) {
    return Object.entries(errors)
      .flatMap(([field, messages]) => {
        const label = SETTINGS_FIELD_LABELS[field] || field;
        return (Array.isArray(messages) ? messages : [String(messages)])
          .map((message) => `${label}: ${message}`);
      })
      .join(' ');
  }

  return apiErrorMessage(error, 'Gagal menyimpan pengaturan ke backend.');
}

export default function SettingsPage() {
  const { refreshSettings } = useAuth();
  const [settings, setSettings] = useState<HotelSettings>(defaultSettings);
  // Nilai tersimpan: pembanding "ada perubahan" + nilai kembali saat Batal
  const [savedSettings, setSavedSettings] = useState<HotelSettings>(defaultSettings);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoSrc = photoPreview || (!removePhoto ? settings.hotel_photo_url : null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/v1/settings');
      const data = res.data.data;
      if (data) {
        const loaded: HotelSettings = {
          hotel_name: data.hotel_name || '',
          hotel_address: data.hotel_address || '',
          hotel_phone: data.hotel_phone || '',
          hotel_photo_url: data.hotel_photo_url || null,
          default_check_in: data.default_check_in ? data.default_check_in.substring(0, 5) : '14:00',
          default_check_out: data.default_check_out ? data.default_check_out.substring(0, 5) : '12:00',
          tax_percentage: data.tax_percentage ? String(data.tax_percentage) : '11.00',
          min_dp_percentage:
            data.min_dp_percentage === undefined || data.min_dp_percentage === null
              ? '0'
              : String(data.min_dp_percentage),
          payment_verification_enabled: data.payment_verification_enabled !== false,
        };
        setSettings(loaded);
        setSavedSettings(loaded);
        setPhotoFile(null);
        setPhotoPreview(null);
        setRemovePhoto(false);
        setPhotoFailed(false);
      }
    } catch (err: any) {
      console.error('Failed to load settings', err);
      toast.error('Gagal memuat pengaturan sistem.');
    } finally {
      setIsLoading(false);
    }
  };

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings) || !!photoFile || removePhoto;

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type) || file.size > 2 * 1024 * 1024) {
      setErrorMsg('Pilih foto JPG, PNG, atau WebP dengan ukuran maksimal 2 MB.');
      event.target.value = '';
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
    setPhotoFailed(false);
    setErrorMsg('');
  };

  const handleRemovePhoto = async () => {
    const confirmed = await confirmDialog({
      title: 'Hapus Foto Hotel?',
      message: 'Foto profil akan dihapus setelah pengaturan disimpan.',
      confirmLabel: 'Hapus Foto',
      cancelLabel: 'Batal',
      tone: 'danger',
    });
    if (!confirmed) return;

    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartEdit = () => {
    setErrorMsg('');
    setIsEditing(true);
  };

  const handleCancelEdit = async () => {
    if (isDirty) {
      const discard = await confirmDialog({
        title: 'Batalkan Perubahan?',
        message: 'Nilai yang belum disimpan kembali ke pengaturan tersimpan.',
        confirmLabel: 'Ya, batalkan',
        cancelLabel: 'Lanjut edit',
        tone: 'danger',
      });
      if (!discard) return;
    }
    setSettings(savedSettings);
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setPhotoFailed(false);
    setErrorMsg('');
    setIsEditing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const apply = await confirmDialog({
      title: 'Simpan Pengaturan?',
      message: 'Perubahan profil dan pengaturan langsung dipakai sistem.',
      confirmLabel: 'Simpan & Terapkan',
    });
    if (!apply) return;

    setIsSaving(true);
    setErrorMsg('');
    try {
      const payload = new FormData();
      payload.append('hotel_name', settings.hotel_name);
      payload.append('hotel_address', settings.hotel_address);
      payload.append('hotel_phone', settings.hotel_phone);
      payload.append('default_check_in', settings.default_check_in.length === 5 ? `${settings.default_check_in}:00` : settings.default_check_in);
      payload.append('default_check_out', settings.default_check_out.length === 5 ? `${settings.default_check_out}:00` : settings.default_check_out);
      payload.append('tax_percentage', String(parseFloat(settings.tax_percentage) || 0));
      payload.append('min_dp_percentage', String(parseFloat(settings.min_dp_percentage) || 0));
      payload.append('payment_verification_enabled', settings.payment_verification_enabled ? '1' : '0');
      if (photoFile) payload.append('hotel_photo', photoFile);
      if (removePhoto) payload.append('remove_hotel_photo', '1');
      payload.append('_method', 'PUT');

      const res = await api.post('/api/v1/settings', payload, {
        headers: { 'Content-Type': undefined },
      });
      const nextSettings = {
        ...settings,
        hotel_photo_url: res.data?.data?.hotel_photo_url ?? (removePhoto ? null : settings.hotel_photo_url),
      };
      clearGetCache('/api/v1/settings');
      await refreshSettings();
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setPhotoFile(null);
      setPhotoPreview(null);
      setRemovePhoto(false);
      setPhotoFailed(false);
      setIsEditing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success(res.data.message || 'Pengaturan hotel berhasil disimpan.', { title: 'Tersimpan' });
    } catch (err: any) {
      console.error('Failed to save settings', err);
      setErrorMsg(settingsErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-ink-500 py-8">Memuat pengaturan sistem...</div>;
  }

  /* Nilai turunan untuk ringkasan; dibaca dari isian form supaya kolom kanan ikut berubah
     saat admin mengedit, tanpa perlu request tambahan. */
  const pajak = Number(settings.tax_percentage) || 0;
  const dpMinimal = Number(settings.min_dp_percentage) || 0;

  const ringkasan = [
    { label: 'Nama hotel', value: settings.hotel_name || '-' },
    { label: 'Jam operasional', value: `${settings.default_check_in} – ${settings.default_check_out}` },
    { label: 'Pajak / PPN', value: `${pajak}%` },
    {
      label: 'DP check-in',
      value: dpMinimal > 0 ? `${dpMinimal}% dari tagihan` : 'Tidak wajib',
    },
    {
      label: 'Verifikasi pembayaran',
      value: settings.payment_verification_enabled ? 'Aktif (menunggu admin)' : 'Nonaktif (langsung lunas)',
    },
  ];

  return (
    <div className="settings-page">
      <div className="settings-head">
        <div>
          <h1 className="text-h1">Pengaturan Sistem</h1>
          <p className="text-body-small text-ink-500 mt-1">Konfigurasi operasional dan profil Aedo Hotel Syariah.</p>
        </div>
        {!isEditing && (
          <Button variant="primary" onClick={handleStartEdit}>
            Ubah Pengaturan
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="callout callout-danger" role="alert">
          <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="settings-layout">
        <form onSubmit={handleSave}>
          {/* Semua kontrol terkunci sampai tombol "Ubah Pengaturan" ditekan */}
          <fieldset className="settings-fields" disabled={!isEditing}>
            <Card title="Profil Hotel">
              <div className="settings-photo">
                <div className="settings-photo-avatar">
                  {photoSrc && !photoFailed ? (
                    <img
                      src={photoSrc}
                      alt="Foto profil hotel"
                      onError={() => setPhotoFailed(true)}
                    />
                  ) : (
                    <Building2 size={30} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </div>
                <div className="settings-photo-content">
                  <div>
                    <strong>Foto profil hotel</strong>
                    <p>JPG, PNG, atau WebP. Maksimal 2 MB dan 2048 x 2048 px.</p>
                  </div>
                  <div className="settings-photo-actions">
                    <input
                      ref={fileInputRef}
                      className="settings-photo-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      aria-label="Pilih foto profil hotel"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={14} /> Unggah foto
                    </Button>
                    {removePhoto ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => setRemovePhoto(false)}>
                        Batalkan hapus
                      </Button>
                    ) : photoSrc && (
                      <Button type="button" variant="danger" size="sm" onClick={() => { void handleRemovePhoto(); }}>
                        <Trash2 size={14} /> Hapus foto
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="settings-grid">
                <Input
                  label="Nama Hotel"
                  value={settings.hotel_name}
                  onChange={(e) => setSettings({ ...settings, hotel_name: e.target.value })}
                  required
                />
                <Input
                  label="Nomor Telepon / Hotline"
                  value={settings.hotel_phone}
                  onChange={(e) => setSettings({ ...settings, hotel_phone: e.target.value })}
                  required
                />
                <div className="input-group settings-span">
                  <label className="input-label text-label" htmlFor="hotel_address">
                    Alamat Lengkap<span className="input-required">*</span>
                  </label>
                  <textarea
                    id="hotel_address"
                    className="settings-area"
                    value={settings.hotel_address}
                    onChange={(e) => setSettings({ ...settings, hotel_address: e.target.value })}
                    required
                  />
                </div>
              </div>
            </Card>

            <Card title="Waktu Operasional &amp; Pajak">
              <div className="settings-grid">
                <Input
                  label="Jam Standar Check-in"
                  type="time"
                  value={settings.default_check_in}
                  onChange={(e) => setSettings({ ...settings, default_check_in: e.target.value })}
                  required
                />
                <Input
                  label="Jam Standar Check-out"
                  type="time"
                  value={settings.default_check_out}
                  onChange={(e) => setSettings({ ...settings, default_check_out: e.target.value })}
                  required
                />
                <Input
                  label="Persentase Pajak / PPN (%)"
                  type="number"
                  step="0.01"
                  value={settings.tax_percentage}
                  onChange={(e) => setSettings({ ...settings, tax_percentage: e.target.value })}
                  required
                />
                <Input
                  label="Minimal DP untuk Check-In (%)"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.min_dp_percentage}
                  onChange={(e) => setSettings({ ...settings, min_dp_percentage: e.target.value })}
                  hint="0 = tidak wajib DP. Di atas 0: ini ambang cek-in sekaligus nominal uang muka default di meja."
                  required
                />
                <div className="settings-check settings-span">
                  <input
                    type="checkbox"
                    id="payment_verification_enabled"
                    checked={settings.payment_verification_enabled}
                    onChange={(e) => setSettings({ ...settings, payment_verification_enabled: e.target.checked })}
                  />
                  <label className="settings-check-label" htmlFor="payment_verification_enabled">
                    <span className="text-body-strong">Verifikasi pembayaran transfer / QRIS</span>
                    <span className="settings-check-hint">
                      Aktif: pembayaran non-tunai menunggu persetujuan admin. Nonaktif: langsung dianggap lunas
                      saat dicatat.
                    </span>
                  </label>
                </div>
              </div>
            </Card>
          </fieldset>

          {isEditing && (
            <div className="settings-actions">
              <Button type="button" variant="secondary" onClick={handleCancelEdit}>
                Batal
              </Button>
              <Button type="submit" variant="primary" isLoading={isSaving} disabled={!isDirty}>
                Simpan Perubahan
              </Button>
            </div>
          )}
        </form>

        <aside className="settings-summary">
          <Card title="Ringkasan Aktif">
            <dl className="settings-summary-list">
              {ringkasan.map((item) => (
                <div className="settings-summary-row" key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            <p className="settings-summary-note">
              {isEditing
                ? 'Ringkasan mengikuti isian. Nilai baru berlaku setelah disimpan.'
                : 'Klik “Ubah Pengaturan” untuk mengedit. Nilai ini dipakai sistem untuk tagihan, DP check-in, dan alur verifikasi pembayaran.'}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
