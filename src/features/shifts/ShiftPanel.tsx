import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from '../../components/ui/Toast';
import './ShiftPanel.css';

export function ShiftPanel() {
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [shiftTime, setShiftTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkCurrentShift();
  }, []);

  const checkCurrentShift = async () => {
    try {
      const res = await api.get('/api/v1/shifts/current');
      if (res.data?.data) {
        setIsShiftActive(true);
        const startedAt = res.data.data.started_at;
        if (startedAt) {
          const dateObj = new Date(startedAt);
          setShiftTime(`${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`);
        } else {
          setShiftTime('Aktif');
        }
      } else {
        setIsShiftActive(false);
      }
    } catch {
      setIsShiftActive(false);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShift = async () => {
    setIsLoading(true);
    try {
      if (isShiftActive) {
        const closing = await confirmDialog({
          title: 'Akhiri Shift?',
          message:
            'Transaksi setelah ini tidak masuk shift ini.\n\nPastikan tidak ada tamu yang menunggu di kasir.',
          confirmLabel: 'Akhiri Shift',
        });

        if (!closing) return;

        await api.post('/api/v1/shifts/end');
        setIsShiftActive(false);
        setShiftTime(null);
        toast.success('Shift berakhir. Terima kasih!');
      } else {
        await api.post('/api/v1/shifts/start');
        setIsShiftActive(true);
        const now = new Date();
        setShiftTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
        toast.success('Shift dimulai. Transaksi akan tercatat atas shift ini.');
      }
    } catch (error: any) {
      console.error('Failed to toggle shift', error);
      toast.apiError(error, 'Gagal memproses shift.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="topbar-shift-badge loading">
        Loading...
      </div>
    );
  }

  if (isShiftActive) {
    return (
      <button className="topbar-shift-badge active" onClick={toggleShift} title="Klik untuk akhiri shift">
        <span className="shift-dot"></span>
        Shift berjalan · {shiftTime}
      </button>
    );
  }

  return (
    <button className="topbar-shift-badge inactive" onClick={toggleShift} title="Klik untuk mulai shift">
      Mulai Shift
    </button>
  );
}
