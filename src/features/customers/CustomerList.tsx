import { useState, useEffect } from 'react';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Drawer } from '../../components/ui/Drawer';
import { api } from '../../lib/api';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  ktp: string;
  total_bookings?: number;
  bookings_count?: number;
}

export default function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', ktp: '' });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/api/v1/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      const list = res.data.data || res.data;
      setCustomers(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to fetch customers', error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: Column<Customer>[] = [
    { key: 'name', header: 'Nama Lengkap', cell: (c) => <span className="text-body-strong">{c.name}</span> },
    { key: 'ktp', header: 'No. KTP', cell: (c) => c.ktp || '-' },
    { key: 'phone', header: 'Telepon / WA', cell: (c) => c.phone || '-' },
    { key: 'email', header: 'Email', cell: (c) => c.email || '-' },
    { key: 'bookings', header: 'Total Menginap', align: 'right', cell: (c) => `${c.bookings_count ?? c.total_bookings ?? 0} kali` },
    { 
      key: 'action', 
      header: 'Aksi', 
      align: 'right',
      cell: (c) => (
        <Button size="sm" variant="secondary" onClick={() => handleEdit(c)}>Edit</Button>
      ) 
    },
  ];

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setErrorMsg('');
    setFormData({ name: customer.name, email: customer.email || '', phone: customer.phone || '', ktp: customer.ktp || '' });
    setIsDrawerOpen(true);
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    setErrorMsg('');
    setFormData({ name: '', email: '', phone: '', ktp: '' });
    setIsDrawerOpen(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      if (editingCustomer) {
        await api.put(`/api/v1/customers/${editingCustomer.id}`, formData);
      } else {
        await api.post('/api/v1/customers', formData);
      }
      setIsDrawerOpen(false);
      await fetchCustomers();
    } catch (error: any) {
      console.error('Failed to save customer', error);
      setErrorMsg(error.response?.data?.message || 'Gagal menyimpan data pelanggan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="customer-list-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <h1 className="text-h1">Pelanggan</h1>
        <div className="page-actions">
          <Button onClick={handleAdd}>Tambah Pelanggan</Button>
        </div>
      </div>

      <div className="filters">
        <div className="search-wrapper" style={{ maxWidth: '400px' }}>
          <Input 
            placeholder="Cari berdasarkan nama, KTP, atau No. HP..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Table 
        columns={columns} 
        data={customers} 
        keyExtractor={(c) => c.id} 
        isLoading={isLoading} 
      />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingCustomer ? "Edit Pelanggan" : "Tambah Pelanggan"}
        width="450px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDrawerOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!formData.name || !formData.phone}>Simpan</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}
          <Input 
            label="Nama Lengkap" 
            value={formData.name} 
            onChange={e => setFormData({ ...formData, name: e.target.value })} 
            required
          />
          <Input 
            label="Nomor KTP" 
            value={formData.ktp} 
            onChange={e => setFormData({ ...formData, ktp: e.target.value })} 
          />
          <Input 
            label="Nomor Telepon / WhatsApp" 
            value={formData.phone} 
            onChange={e => setFormData({ ...formData, phone: e.target.value })} 
            required
          />
          <Input 
            label="Email" 
            type="email"
            value={formData.email} 
            onChange={e => setFormData({ ...formData, email: e.target.value })} 
          />
        </div>
      </Drawer>
    </div>
  );
}
