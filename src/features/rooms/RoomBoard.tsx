import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import type { RoomStatus } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Table, type Column } from '../../components/ui/Table';
import { formatIDR } from '../../lib/format';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { apiErrorMessage, toast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import './RoomBoard.css';

interface RoomType {
  id: number;
  name: string;
  price: number;
}

interface Room {
  id: number;
  room_number: string;
  floor: number | null;
  status: RoomStatus;
  room_type?: RoomType | null;
  room_type_id?: number;
  notes?: string | null;
  current_guest?: string;
}

interface RoomFormData {
  room_type_id: number | '';
  room_number: string;
  floor: number | '';
  status: RoomStatus;
  notes: string;
}

const emptyRoomForm: RoomFormData = {
  room_type_id: '',
  room_number: '',
  floor: 1,
  status: 'available',
  notes: '',
};

export default function RoomBoard() {
  const { isAdmin } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'board' | 'list'>('board');

  // Search & Filters for List view
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Drawer / Modal states
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState<RoomFormData>(emptyRoomForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Status Change in Detail Drawer
  const [newRoomStatus, setNewRoomStatus] = useState<RoomStatus>('available');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Delete state
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchRoomTypes();
  }, []);

  const fetchRoomTypes = async () => {
    try {
      const response = await api.get('/api/v1/room-types?per_page=100');
      setRoomTypes(response.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch room types', error);
    }
  };

  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/rooms?per_page=150');
      setRooms(response.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms', error);
      toast.error('Gagal memuat data kamar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingRoom(null);
    setFormData({
      ...emptyRoomForm,
      room_type_id: roomTypes[0]?.id || '',
    });
    setFormError('');
    fetchRoomTypes();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      room_type_id: room.room_type?.id ?? room.room_type_id ?? '',
      room_number: room.room_number,
      floor: room.floor ?? '',
      status: room.status,
      notes: room.notes || '',
    });
    setFormError('');
    setIsDetailOpen(false);
    fetchRoomTypes();
    setIsFormOpen(true);
  };

  const handleOpenDetail = (room: Room) => {
    setSelectedRoom(room);
    setNewRoomStatus(room.status);
    setIsDetailOpen(true);
  };

  const handleSaveRoom = async () => {
    if (!formData.room_number.trim()) {
      setFormError('Nomor kamar wajib diisi.');
      return;
    }
    if (!formData.room_type_id) {
      setFormError('Tipe kamar wajib dipilih.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      const payload = {
        room_type_id: formData.room_type_id,
        room_number: formData.room_number.trim(),
        floor: formData.floor === '' ? null : Number(formData.floor),
        status: formData.status,
        notes: formData.notes.trim() || null,
      };

      if (editingRoom) {
        await api.put(`/api/v1/rooms/${editingRoom.id}`, payload);
        toast.success(`Kamar ${payload.room_number} berhasil diperbarui.`);
      } else {
        await api.post('/api/v1/rooms', payload);
        toast.success(`Kamar ${payload.room_number} berhasil ditambahkan.`);
      }
      setIsFormOpen(false);
      await fetchRooms();
    } catch (err: any) {
      console.error('Failed to save room', err);
      setFormError(apiErrorMessage(err, 'Gagal menyimpan data kamar.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deletingRoom) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/rooms/${deletingRoom.id}`);
      toast.success(`Kamar ${deletingRoom.room_number} berhasil dihapus.`);
      setDeletingRoom(null);
      setIsDetailOpen(false);
      await fetchRooms();
    } catch (err: any) {
      console.error('Failed to delete room', err);
      toast.apiError(err, 'Gagal menghapus kamar.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!selectedRoom) return;
    setIsUpdatingStatus(true);
    try {
      await api.patch(`/api/v1/rooms/${selectedRoom.id}/status`, {
        status: newRoomStatus,
      });
      toast.success(`Status kamar ${selectedRoom.room_number} diubah.`);
      setIsDetailOpen(false);
      await fetchRooms();
    } catch (err: any) {
      console.error('Failed to change room status', err);
      toast.apiError(err, 'Gagal mengubah status kamar.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Unique list of floors for grouping/filtering
  const availableFloors = useMemo(() => {
    const list = Array.from(new Set(rooms.map(r => r.floor ?? 1))).sort((a, b) => a - b);
    return list.length > 0 ? list : [1];
  }, [rooms]);

  // Filtered rooms for list view
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchSearch = search.trim() === '' ||
        room.room_number.toLowerCase().includes(search.toLowerCase()) ||
        (room.room_type?.name && room.room_type.name.toLowerCase().includes(search.toLowerCase())) ||
        (room.notes && room.notes.toLowerCase().includes(search.toLowerCase()));

      const matchFloor = floorFilter === 'all' || String(room.floor ?? 1) === floorFilter;
      const matchStatus = statusFilter === 'all' || room.status === statusFilter;

      return matchSearch && matchFloor && matchStatus;
    });
  }, [rooms, search, floorFilter, statusFilter]);

  // Columns for Table View
  const columns: Column<Room>[] = [
    {
      key: 'room_number',
      header: 'No. Kamar',
      cell: (r: Room) => (
        <span style={{ fontWeight: 700, fontSize: '15px' }}>{r.room_number}</span>
      ),
    },
    {
      key: 'room_type',
      header: 'Tipe Kamar',
      cell: (r: Room) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.room_type?.name || 'Standard'}</div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
            {formatIDR(r.room_type?.price || 0)} / malam
          </div>
        </div>
      ),
    },
    {
      key: 'floor',
      header: 'Lantai',
      cell: (r: Room) => <span>Lantai {r.floor ?? 1}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r: Room) => <StatusBadge type="room" value={r.status} />,
    },
    {
      key: 'notes',
      header: 'Catatan',
      cell: (r: Room) => <span style={{ fontSize: '13px', color: 'var(--ink-500)' }}>{r.notes || '-'}</span>,
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      cell: (r: Room) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          <Button size="sm" variant="secondary" onClick={() => handleOpenDetail(r)}>
            Status
          </Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(r)} title="Edit Kamar">
                <Pencil size={14} />
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeletingRoom(r)} title="Hapus Kamar">
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="room-board-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="text-h1">Kamar Hotel</h1>
          <p className="text-body-small text-ink-500" style={{ marginTop: '2px' }}>
            Pantau status ketersediaan dan kelola data kamar.
          </p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button onClick={fetchRooms} variant="secondary" isLoading={isLoading}>
            <RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh
          </Button>
          {isAdmin && (
            <Button onClick={handleOpenAdd}>
              <Plus size={16} style={{ marginRight: '6px' }} /> Tambah Kamar
            </Button>
          )}
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <Tabs
          options={[
            { value: 'board', label: 'Papan Visual' },
            { value: 'list', label: 'Daftar Kamar' },
          ]}
          value={activeTab}
          onChange={(tab) => setActiveTab(tab as 'board' | 'list')}
        />
        <div style={{ fontSize: '13px', color: 'var(--ink-500)' }}>
          Total: <strong>{rooms.length}</strong> kamar
        </div>
      </div>

      {isLoading ? (
        <div className="room-board-loading">Memuat data kamar...</div>
      ) : activeTab === 'board' ? (
        /* ==================== BOARD (GRID) VIEW ==================== */
        <div className="floors-container">
          {rooms.length === 0 ? (
            <div className="room-board-loading">
              Belum ada data kamar. {isAdmin ? 'Klik “Tambah Kamar” untuk menambahkan.' : ''}
            </div>
          ) : (
            availableFloors.map(floor => {
              const floorRooms = rooms.filter(r => (r.floor ?? 1) === floor);
              if (floorRooms.length === 0) return null;
              return (
                <div key={floor} className="floor-section">
                  <h2 className="text-h2 floor-title">Lantai {floor}</h2>
                  <div className="room-grid">
                    {floorRooms.map(room => (
                      <div
                        key={room.id}
                        className={`room-card status-${room.status}`}
                        onClick={() => handleOpenDetail(room)}
                      >
                        <div className="room-card-header">
                          <span className="room-number">{room.room_number}</span>
                          <StatusBadge type="room" value={room.status} />
                        </div>
                        <div className="room-card-body">
                          <div className="room-type">{room.room_type?.name ?? 'Standard'}</div>
                          {room.room_type?.price && (
                            <div style={{ fontSize: '11px', color: 'var(--ink-400)' }}>
                              {formatIDR(room.room_type.price)}
                            </div>
                          )}
                          {room.status === 'occupied' && room.current_guest && (
                            <div className="room-guest">{room.current_guest}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ==================== LIST (TABLE) VIEW ==================== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
              <Input
                placeholder="Cari nomor, tipe, catatan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="ui-select"
              style={{ width: 'auto', minWidth: '130px' }}
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
            >
              <option value="all">Semua Lantai</option>
              {availableFloors.map(f => (
                <option key={f} value={String(f)}>Lantai {f}</option>
              ))}
            </select>
            <select
              className="ui-select"
              style={{ width: 'auto', minWidth: '150px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="available">Tersedia</option>
              <option value="booked">Dipesan</option>
              <option value="occupied">Terisi</option>
              <option value="cleaning">Dibersihkan</option>
              <option value="maintenance">Perbaikan</option>
            </select>
          </div>

          <Table
            data={filteredRooms}
            columns={columns}
            keyExtractor={(r) => r.id}
            emptyMessage="Tidak ada kamar yang sesuai filter."
          />
        </div>
      )}

      {/* ==================== DETAIL / STATUS DRAWER ==================== */}
      <Drawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Kamar ${selectedRoom?.room_number}`}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
            {isAdmin && selectedRoom ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <Button variant="danger" size="sm" onClick={() => setDeletingRoom(selectedRoom)}>
                  Hapus
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(selectedRoom)}>
                  Edit
                </Button>
              </div>
            ) : <div />}
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button variant="ghost" size="sm" onClick={() => setIsDetailOpen(false)}>
                Tutup
              </Button>
              <Button size="sm" onClick={handleChangeStatus} isLoading={isUpdatingStatus}>
                Simpan Status
              </Button>
            </div>
          </div>
        }
      >
        {selectedRoom && (
          <div className="room-detail-content">
            <div className="detail-row">
              <span className="text-label">Tipe Kamar</span>
              <span className="text-body-strong">{selectedRoom.room_type?.name ?? '-'}</span>
            </div>
            <div className="detail-row">
              <span className="text-label">Tarif per Malam</span>
              <span className="text-body-strong">{formatIDR(selectedRoom.room_type?.price ?? 0)}</span>
            </div>
            <div className="detail-row">
              <span className="text-label">Lantai</span>
              <span className="text-body-strong">Lantai {selectedRoom.floor ?? 1}</span>
            </div>
            <div className="detail-row">
              <span className="text-label">Status Saat Ini</span>
              <StatusBadge type="room" value={selectedRoom.status} />
            </div>
            {selectedRoom.notes && (
              <div className="detail-row">
                <span className="text-label">Catatan</span>
                <span className="text-body-small">{selectedRoom.notes}</span>
              </div>
            )}

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <label className="text-label" style={{ fontWeight: 600 }}>Ubah Status Kamar</label>
              <select
                className="ui-select"
                value={newRoomStatus}
                onChange={(e) => setNewRoomStatus(e.target.value as RoomStatus)}
              >
                <option value="available">Tersedia (Available)</option>
                <option value="cleaning">Dibersihkan (Cleaning)</option>
                <option value="maintenance">Perbaikan (Maintenance)</option>
                <option value="occupied">Terisi (Occupied)</option>
                <option value="booked">Dipesan (Booked)</option>
              </select>
            </div>
          </div>
        )}
      </Drawer>

      {/* ==================== CREATE / EDIT DRAWER ==================== */}
      <Drawer
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingRoom ? `Edit Kamar ${editingRoom.room_number}` : 'Tambah Kamar Baru'}
        width="450px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Batal</Button>
            <Button onClick={handleSaveRoom} isLoading={isSubmitting}>
              {editingRoom ? 'Simpan Perubahan' : 'Tambah Kamar'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' }}>
              {formError}
            </div>
          )}

          <Input
            label="Nomor Kamar"
            value={formData.room_number}
            onChange={e => setFormData({ ...formData, room_number: e.target.value })}
            placeholder="Contoh: 101, 202"
            required
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="text-label">Tipe Kamar <span style={{ color: 'var(--danger-fg)' }}>*</span></label>
            <select
              className="ui-select"
              value={formData.room_type_id}
              onChange={(e) => setFormData({ ...formData, room_type_id: e.target.value ? Number(e.target.value) : '' })}
              required
            >
              <option value="" disabled>Pilih tipe kamar</option>
              {roomTypes.map(rt => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} — {formatIDR(rt.price)}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Lantai"
            type="number"
            min={1}
            value={formData.floor}
            onChange={e => setFormData({ ...formData, floor: e.target.value ? Number(e.target.value) : '' })}
            placeholder="Contoh: 1, 2, 3"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="text-label">Status Awal</label>
            <select
              className="ui-select"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as RoomStatus })}
            >
              <option value="available">Tersedia (Available)</option>
              <option value="cleaning">Dibersihkan (Cleaning)</option>
              <option value="maintenance">Perbaikan (Maintenance)</option>
              <option value="occupied">Terisi (Occupied)</option>
              <option value="booked">Dipesan (Booked)</option>
            </select>
          </div>

          <Input
            label="Catatan"
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Contoh: Dekat lift, non-smoking"
            optional
          />
        </div>
      </Drawer>

      {/* ==================== DELETE CONFIRM MODAL ==================== */}
      <Modal
        isOpen={!!deletingRoom}
        onClose={() => setDeletingRoom(null)}
        title="Hapus Kamar"
        maxWidth="420px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingRoom(null)}>Batal</Button>
            <Button variant="danger" onClick={handleDeleteRoom} isLoading={isDeleting}>Hapus</Button>
          </>
        }
      >
        <p className="text-body">
          Hapus kamar <strong>{deletingRoom?.room_number}</strong>? Kamar ini akan dinonaktifkan dari sistem.
        </p>
      </Modal>
    </div>
  );
}
