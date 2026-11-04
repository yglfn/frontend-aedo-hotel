/* oxlint-disable react/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Drawer } from '../../components/ui/Drawer';
import { apiErrorMessage, toast } from '../../components/ui/Toast';
import { api } from '../../lib/api';

interface MaintenanceTask {
  id: number;
  room?: { id: number; room_number: string };
  reported_by?: { name: string } | string;
  description: string;
  status: 'reported' | 'in_progress' | 'resolved';
  created_at: string;
}

interface RoomOption {
  id: number;
  room_number: string;
}

export default function MaintenanceList() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDesc, setNewDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchTasks();
    fetchRooms();
  }, [statusFilter]);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/api/v1/rooms');
      const list = res.data.data || res.data;
      if (Array.isArray(list)) {
        setRooms(list);
        if (list.length > 0 && !selectedRoomId) {
          setSelectedRoomId(String(list[0].id));
        }
      }
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    }
  };

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/v1/maintenance');
      const list = res.data.data || res.data;
      setTasks(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to fetch maintenance tasks', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: 'reported' | 'in_progress' | 'resolved') => {
    try {
      await api.patch(`/api/v1/maintenance/${id}/status`, { status: newStatus });
      setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));

      toast.success(
        newStatus === 'resolved'
          ? 'Kerusakan ditandai selesai. Silakan perbarui status kamar bila perlu.'
          : 'Permintaan perbaikan sedang dikerjakan.'
      );
    } catch (error) {
      console.error('Failed to update maintenance status', error);
      toast.apiError(error, 'Gagal mengubah status maintenance.');
    }
  };

  const handleCreateTask = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api.post('/api/v1/maintenance', {
        room_id: Number(selectedRoomId),
        description: newDesc,
        priority: newPriority,
      });
      setIsDrawerOpen(false);
      setNewDesc('');
      await fetchTasks();
      toast.success('Laporan kerusakan kamar terkirim.');
    } catch (error: any) {
      console.error('Failed to create maintenance task', error);
      setErrorMsg(apiErrorMessage(error, 'Gagal membuat laporan maintenance.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<MaintenanceTask>[] = [
    { 
      key: 'room', 
      header: 'Kamar', 
      cell: (t) => <span className="text-body-strong">{t.room?.room_number || '-'}</span> 
    },
    { key: 'desc', header: 'Kerusakan', cell: (t) => t.description },
    { 
      key: 'reporter', 
      header: 'Pelapor', 
      cell: (t) => (typeof t.reported_by === 'string' ? t.reported_by : (t.reported_by?.name ?? '-')), 
    },
    { key: 'status', header: 'Status', cell: (t) => <StatusBadge type="maintenance" value={t.status} /> },
    { 
      key: 'action', 
      header: 'Aksi', 
      align: 'right',
      cell: (t) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {t.status === 'reported' && (
            <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(t.id, 'in_progress')}>Kerjakan</Button>
          )}
          {t.status === 'in_progress' && (
            <Button size="sm" onClick={() => handleUpdateStatus(t.id, 'resolved')}>Selesaikan</Button>
          )}
        </div>
      ) 
    },
  ];

  const filteredTasks = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter);

  return (
    <div className="maintenance-list-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <h1 className="text-h1">Maintenance</h1>
        <div className="page-actions">
          <Button onClick={() => { setErrorMsg(''); setIsDrawerOpen(true); }}>Lapor Kerusakan</Button>
        </div>
      </div>

      <div className="filters">
        <Tabs 
          options={[
            { label: 'Semua', value: 'all' },
            { label: 'Dilaporkan', value: 'reported' },
            { label: 'Dikerjakan', value: 'in_progress' },
            { label: 'Selesai', value: 'resolved' },
          ]} 
          value={statusFilter} 
          onChange={setStatusFilter} 
        />
      </div>

      <Table 
        columns={columns} 
        data={filteredTasks} 
        keyExtractor={(t) => t.id} 
        isLoading={isLoading} 
      />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Lapor Kerusakan"
        width="400px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDrawerOpen(false)}>Batal</Button>
            <Button onClick={handleCreateTask} isLoading={isSubmitting} disabled={!selectedRoomId || !newDesc}>Simpan</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="text-label">Pilih Kamar</label>
            <select
              className="ui-select"
              value={selectedRoomId}
              onChange={e => setSelectedRoomId(e.target.value)}
            >
              <option value="">-- Pilih Kamar --</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>Kamar {r.room_number}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="text-label">Prioritas</label>
            <select
              className="ui-select"
              value={newPriority}
              onChange={e => setNewPriority(e.target.value)}
            >
              <option value="low">Rendah (Low)</option>
              <option value="medium">Sedang (Medium)</option>
              <option value="high">Tinggi (High)</option>
              <option value="critical">Kritis (Critical)</option>
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="text-label">Deskripsi Kerusakan</label>
            <textarea 
              style={{
                width: '100%', minHeight: '120px', padding: '12px', 
                border: '1px solid var(--border)', borderRadius: 'var(--radius-control)',
                fontFamily: 'inherit', fontSize: '14px', resize: 'vertical'
              }}
              placeholder="Jelaskan kerusakan secara detail..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
