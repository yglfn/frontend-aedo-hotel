import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { RoomStatus } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatIDR } from '../../lib/format';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import './RoomBoard.css';

interface RoomType {
  id: number;
  name: string;
  price: number;
}

interface Room {
  id: number;
  room_number: string;
  floor: number;
  status: RoomStatus;
  room_type: RoomType;
  notes?: string;
  current_guest?: string; // Hypothetical field if occupied
}

interface RoomFormData {
  room_type_id: number | '';
  room_number: string;
  floor: number | '';
  notes: string;
}

export default function RoomBoard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // CRUD state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState<RoomFormData>({ room_type_id: '', room_number: '', floor: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchRoomTypes();
  }, []);

  const fetchRoomTypes = async () => {
    try {
      const response = await api.get('/api/v1/room-types');
      setRoomTypes(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch room types', error);
    }
  };

  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      // In a real scenario this might be a paginated response or a full list
      const response = await api.get('/api/v1/rooms');
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms', error);
      // Fallback dummy data for visual testing since API might not be running
      setRooms([
        { id: 1, room_number: '101', floor: 1, status: 'available', room_type: { id: 1, name: 'Deluxe', price: 350000 } },
        { id: 2, room_number: '102', floor: 1, status: 'occupied', room_type: { id: 1, name: 'Deluxe', price: 350000 }, current_guest: 'Budi Santoso' },
        { id: 3, room_number: '103', floor: 1, status: 'cleaning', room_type: { id: 2, name: 'Superior', price: 450000 } },
        { id: 4, room_number: '201', floor: 2, status: 'maintenance', room_type: { id: 1, name: 'Deluxe', price: 350000 } },
        { id: 5, room_number: '202', floor: 2, status: 'booked', room_type: { id: 2, name: 'Superior', price: 450000 } },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const [newRoomStatus, setNewRoomStatus] = useState<RoomStatus>('available');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const openRoomDetail = (room: Room) => {
    setSelectedRoom(room);
    setNewRoomStatus(room.status);
    setIsDrawerOpen(true);
  };

  const emptyRoomForm: RoomFormData = { room_type_id: '', room_number: '', floor: '', notes: '' };

  const handleAddRoom = () => {
    setEditingRoom(null);
    setFormData(emptyRoomForm);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      room_type_id: room.room_type?.id ?? '',
      room_number: room.room_number,
      floor: room.floor ?? '',
      notes: room.notes || '',
    });
    setFormError('');
    setIsDrawerOpen(false);
    setIsFormOpen(true);
  };

  const handleSaveRoom = async () => {
    setIsSubmitting(true);
    setFormError('');
    try {
      const payload = {
        room_type_id: formData.room_type_id,
        room_number: formData.room_number,
        floor: formData.floor === '' ? null : formData.floor,
        notes: formData.notes || null,
      };
      if (editingRoom) {
        await api.put(`/api/v1/rooms/${editingRoom.id}`, payload);
      } else {
        await api.post('/api/v1/rooms', payload);
      }
      setIsFormOpen(false);
      await fetchRooms();
    } catch (err: any) {
      console.error('Failed to save room', err);
      setFormError(err.response?.data?.message || 'Gagal menyimpan data kamar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deletingRoom) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/rooms/${deletingRoom.id}`);
      setDeletingRoom(null);
      setIsDrawerOpen(false);
      await fetchRooms();
    } catch (err: any) {
      console.error('Failed to delete room', err);
      alert(err.response?.data?.message || 'Gagal menghapus kamar.');
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
      setIsDrawerOpen(false);
      await fetchRooms();
    } catch (err: any) {
      console.error('Failed to change room status', err);
      alert(err.response?.data?.message || 'Gagal mengubah status kamar.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Group by floor
  const floors = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);

  return (
    <div className="room-board-page">
      <div className="page-header">
        <h1 className="text-h1">Papan Kamar</h1>
        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={fetchRooms} variant="secondary">Refresh</Button>
          <Button onClick={handleAddRoom}>Tambah Kamar</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="room-board-loading">Memuat status kamar...</div>
      ) : (
        <div className="floors-container">
          {floors.map(floor => (
            <div key={floor} className="floor-section">
              <h2 className="text-h2 floor-title">Lantai {floor}</h2>
              <div className="room-grid">
                {rooms.filter(r => r.floor === floor).map(room => (
                  <div 
                    key={room.id} 
                    className={`room-card status-${room.status}`}
                    onClick={() => openRoomDetail(room)}
                  >
                    <div className="room-card-header">
                      <span className="room-number">{room.room_number}</span>
                      <StatusBadge type="room" value={room.status} />
                    </div>
                    <div className="room-card-body">
                      <div className="room-type">{room.room_type.name}</div>
                      {room.status === 'occupied' && room.current_guest && (
                        <div className="room-guest">{room.current_guest}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`Detail Kamar ${selectedRoom?.room_number}`}
        footer={
          <>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="danger" onClick={() => selectedRoom && setDeletingRoom(selectedRoom)}>Hapus</Button>
              <Button variant="secondary" onClick={() => selectedRoom && handleEditRoom(selectedRoom)}>Edit</Button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={() => setIsDrawerOpen(false)}>Tutup</Button>
              <Button onClick={handleChangeStatus} isLoading={isUpdatingStatus}>Simpan Status</Button>
            </div>
          </>
        }
      >
        {selectedRoom && (
          <div className="room-detail-content">
            <div className="detail-row">
              <span className="text-label">Tipe Kamar</span>
              <span className="text-body-strong">{selectedRoom.room_type.name}</span>
            </div>
            <div className="detail-row">
              <span className="text-label">Harga per Malam</span>
              <span className="text-body-strong">{formatIDR(selectedRoom.room_type.price)}</span>
            </div>
            <div className="detail-row">
              <span className="text-label">Status Saat Ini</span>
              <StatusBadge type="room" value={selectedRoom.status} />
            </div>
            {selectedRoom.current_guest && (
              <div className="detail-row">
                <span className="text-label">Tamu Menginap</span>
                <span className="text-body-strong">{selectedRoom.current_guest}</span>
              </div>
            )}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <label className="text-label">Ubah Status Kamar</label>
              <select
                className="ui-select"
                value={newRoomStatus}
                onChange={(e) => setNewRoomStatus(e.target.value as RoomStatus)}
              >
                <option value="available">Tersedia (Available)</option>
                <option value="cleaning">Sedang Dibersihkan (Cleaning)</option>
                <option value="maintenance">Perbaikan (Maintenance)</option>
                <option value="occupied">Terisi (Occupied)</option>
                <option value="booked">Dipesan (Booked)</option>
              </select>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingRoom ? `Edit Kamar ${editingRoom.room_number}` : 'Tambah Kamar'}
        width="450px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Batal</Button>
            <Button onClick={handleSaveRoom} isLoading={isSubmitting} disabled={!formData.room_number || !formData.room_type_id}>Simpan</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="text-label" htmlFor="room-type-select">Tipe Kamar</label>
            <select
              id="room-type-select"
              className="ui-select"
              value={formData.room_type_id}
              onChange={(e) => setFormData({ ...formData, room_type_id: e.target.value ? Number(e.target.value) : '' })}
            >
              <option value="" disabled>Pilih tipe kamar</option>
              {roomTypes.map(rt => (
                <option key={rt.id} value={rt.id}>{rt.name} — {formatIDR(rt.price)}</option>
              ))}
            </select>
          </div>
          <Input
            label="Nomor Kamar"
            value={formData.room_number}
            onChange={e => setFormData({ ...formData, room_number: e.target.value })}
            placeholder="Contoh: 101"
            required
          />
          <Input
            label="Lantai"
            type="number"
            min={1}
            value={formData.floor}
            onChange={e => setFormData({ ...formData, floor: e.target.value ? Number(e.target.value) : '' })}
            optional
          />
          <Input
            label="Catatan"
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Contoh: Kamar dekat lift"
            optional
          />
        </div>
      </Drawer>

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
          Apakah Anda yakin ingin menghapus kamar <strong>{deletingRoom?.room_number}</strong>? Tindakan ini tidak dapat dibatalkan.
        </p>
      </Modal>
    </div>
  );
}
