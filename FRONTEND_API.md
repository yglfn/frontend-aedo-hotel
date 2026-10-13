# Backend API Documentation — Aedo Hotel Syariah

> Dokumen ini adalah referensi lengkap backend untuk tim **frontend (React + TypeScript)**.
> Dibaca oleh AI yang membantu pengembangan frontend agar memahami kontrak API, aturan bisnis, dan struktur data.

---

## 1. Tech Stack & Konfigurasi

| Item | Detail |
|---|---|
| Framework | Laravel 11 (PHP 8.2+) |
| Auth | Laravel Sanctum — **mode SPA cookie** (session-based, bukan JWT Bearer) |
| Base URL | `http://localhost:8000` (local) |
| API Prefix | `/api/v1/` |
| Timezone | `Asia/Jakarta` (WIB) |
| Currency | IDR, semua angka uang adalah `decimal(12,2)` — tampilkan tanpa desimal |

---

## 2. Autentikasi

Backend menggunakan **Sanctum SPA Authentication** — artinya:

- **Bukan** `Authorization: Bearer <token>`
- Menggunakan **cookie session** + **CSRF token**
- Frontend dan backend harus di **domain yang sama atau subdomain** (mis. `app.domain.id` & `api.domain.id`)

### Setup Awal Frontend (wajib dilakukan sekali)

```ts
// 1. Ambil CSRF cookie sebelum login (sekali saja)
await axios.get('/sanctum/csrf-cookie', { withCredentials: true })

// 2. Login
await axios.post('/api/v1/auth/login', {
  email: 'admin@aedohotel.com',
  password: 'password'
}, { withCredentials: true })

// 3. Semua request berikutnya otomatis terautentikasi via cookie
// Pastikan withCredentials: true di semua request
```

### Konfigurasi Axios Global yang Disarankan

```ts
axios.defaults.withCredentials = true
axios.defaults.baseURL = 'http://localhost:8000'
// CSRF token otomatis dihandle Sanctum via cookie X-XSRF-TOKEN
```

### Endpoint Auth

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/sanctum/csrf-cookie` | Publik | Ambil CSRF cookie (wajib sebelum login) |
| `POST` | `/api/v1/auth/login` | Publik | Login |
| `POST` | `/api/v1/auth/logout` | Auth | Logout |
| `GET` | `/api/v1/auth/me` | Auth | Data user yang sedang login |

**Body Login:**
```json
{ "email": "admin@aedohotel.com", "password": "password" }
```

**Response `/auth/me`:**
```json
{
  "data": {
    "id": 1,
    "name": "Admin",
    "email": "admin@aedohotel.com",
    "role": "admin",
    "is_active": true
  }
}
```

---

## 3. Role & Hak Akses

Hanya ada **2 role**:

| Role | Nilai | Kemampuan |
|---|---|---|
| Admin/Owner | `admin` | Akses penuh |
| Pegawai | `pegawai` | Terbatas (lihat tabel di bawah) |

**Apa yang bisa pegawai lakukan:**
- Login, lihat dashboard terbatas
- Buat/ubah/batalkan reservasi, input tamu
- Check-in, check-out
- Catat pembayaran (tunai/transfer), cetak invoice
- Upload bukti bayar
- Laporkan kerusakan kamar, update status housekeeping

**Yang hanya bisa admin:**
- CRUD users (pegawai)
- CRUD tipe kamar, kamar, layanan
- Verifikasi pembayaran transfer
- Lihat log gateway, payment pending/expired
- Laporan & export PDF/Excel
- Pengaturan sistem

---

## 4. Format Response API

### Sukses

```json
{
  "data": { ... },
  "meta": { ... }
}
```

### List dengan Paginasi

```json
{
  "data": [ ... ],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 72
  }
}
```

### Error

```json
{
  "message": "Pesan error untuk pengguna",
  "errors": {
    "field_name": ["Pesan validasi field ini"]
  }
}
```

### HTTP Status Codes

| Kode | Arti |
|---|---|
| `200` | Sukses |
| `201` | Sukses dibuat |
| `401` | Belum login |
| `403` | Tidak punya izin |
| `404` | Tidak ditemukan |
| `409` | Konflik (mis. double booking) |
| `422` | Validasi gagal |

---

## 5. Enum Values (gunakan string literal ini)

### `booking.status`
| Value | Label |
|---|---|
| `pending` | Menunggu |
| `confirmed` | Dikonfirmasi |
| `checked_in` | Check-In |
| `checked_out` | Check-Out |
| `cancelled` | Dibatalkan |

### `booking.source`
`walk_in` | `phone` | `traveloka` | `other`

### `room.status`
| Value | Label |
|---|---|
| `available` | Tersedia |
| `booked` | Dipesan |
| `occupied` | Terisi |
| `cleaning` | Sedang Dibersihkan |
| `maintenance` | Perbaikan |

### `payment.method`
`cash` | `transfer` | `qris` | `payment_gateway`

### `payment.type`
`dp` | `final` | `refund`

### `payment.status`
`pending` | `verified` | `failed` | `expired`

### `invoice.status`
`draft` | `sent` | `paid` | `void`

### `housekeeping_task.status`
`pending` | `in_progress` | `completed`

### `maintenance.status`
`reported` | `in_progress` | `resolved`

### `shift.status`
`open` | `closed`

---

## 6. Semua Endpoint

> **Catatan:** semua endpoint kecuali auth dan webhook memerlukan autentikasi.

### 6.1 Users (Admin only)

| Method | URL | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/users` | List semua user |
| `POST` | `/api/v1/users` | Buat user baru |
| `GET` | `/api/v1/users/{id}` | Detail user |
| `PUT` | `/api/v1/users/{id}` | Update user |
| `DELETE` | `/api/v1/users/{id}` | Hapus user |
| `PATCH` | `/api/v1/users/{id}/activate` | Aktifkan akun |
| `PATCH` | `/api/v1/users/{id}/deactivate` | Nonaktifkan akun |
| `POST` | `/api/v1/users/{id}/reset-password` | Reset password |

**Body create/update user:**
```json
{
  "name": "Nama Pegawai",
  "email": "pegawai@email.com",
  "password": "password123",
  "role": "pegawai",
  "is_active": true
}
```

---

### 6.2 Settings (Admin only)

| Method | URL | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/settings` | Ambil pengaturan hotel |
| `PUT` | `/api/v1/settings` | Update pengaturan |

**Response settings:**
```json
{
  "data": {
    "hotel_name": "Aedo Hotel Syariah",
    "hotel_address": "...",
    "hotel_phone": "...",
    "default_check_in": "14:00:00",
    "default_check_out": "12:00:00",
    "tax_percentage": "11.00",
    "payment_expiry_minutes": 60
  }
}
```

---

### 6.3 Dashboard

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/dashboard` | Semua | Statistik & notifikasi hari ini |

**Response dashboard:**
```json
{
  "data": {
    "today_checkins": 3,
    "today_checkouts": 2,
    "available_rooms": 8,
    "occupied_rooms": 5,
    "pending_payments": 2,
    "total_rooms": 13
  }
}
```

---

### 6.4 Tipe Kamar (Room Types)

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/room-types` | Semua | List tipe kamar |
| `POST` | `/api/v1/room-types` | Admin | Buat tipe kamar |
| `GET` | `/api/v1/room-types/{id}` | Semua | Detail tipe kamar |
| `PUT` | `/api/v1/room-types/{id}` | Admin | Update tipe kamar |
| `DELETE` | `/api/v1/room-types/{id}` | Admin | Soft delete (tidak benar-benar dihapus) |

**Body:**
```json
{
  "name": "Deluxe",
  "price": 350000,
  "max_person": 2,
  "facilities": "AC, TV, WiFi, Kamar Mandi Dalam",
  "description": "Kamar nyaman dengan fasilitas lengkap"
}
```

---

### 6.5 Kamar (Rooms)

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/rooms` | Semua | List semua kamar + status |
| `POST` | `/api/v1/rooms` | Admin | Tambah kamar |
| `GET` | `/api/v1/rooms/{id}` | Semua | Detail kamar |
| `PUT` | `/api/v1/rooms/{id}` | Admin | Update kamar |
| `DELETE` | `/api/v1/rooms/{id}` | Admin | Soft delete |
| `PATCH` | `/api/v1/rooms/{id}/status` | Semua | Update status kamar |
| `GET` | `/api/v1/rooms/availability` | Semua | Cek ketersediaan kamar |

**Cek Ketersediaan:**
```
GET /api/v1/rooms/availability?check_in=2026-11-01&check_out=2026-11-03
```

**Response availability:**
```json
{
  "data": [
    {
      "id": 1,
      "room_number": "101",
      "floor": 1,
      "status": "available",
      "room_type": { "id": 1, "name": "Deluxe", "price": 350000 }
    }
  ]
}
```

---

### 6.6 Layanan Tambahan (Services)

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/services` | Semua | List layanan aktif |
| `POST` | `/api/v1/services` | Admin | Tambah layanan |
| `PUT` | `/api/v1/services/{id}` | Admin | Update |
| `DELETE` | `/api/v1/services/{id}` | Admin | Nonaktifkan |

---

### 6.7 Pelanggan (Customers)

| Method | URL | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/customers` | List pelanggan (+ `?search=nama`) |
| `POST` | `/api/v1/customers` | Tambah pelanggan |
| `GET` | `/api/v1/customers/{id}` | Detail |
| `PUT` | `/api/v1/customers/{id}` | Update |

---

### 6.8 Reservasi (Bookings)

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/bookings` | Semua | List reservasi |
| `POST` | `/api/v1/bookings` | Semua | Buat reservasi baru |
| `GET` | `/api/v1/bookings/{id}` | Semua | Detail reservasi |
| `PUT` | `/api/v1/bookings/{id}` | Semua | Update reservasi |
| `POST` | `/api/v1/bookings/{id}/check-in` | Semua | Proses check-in |
| `POST` | `/api/v1/bookings/{id}/check-out` | Semua | Proses check-out |
| `POST` | `/api/v1/bookings/{id}/cancel` | Semua | Batalkan reservasi |
| `POST` | `/api/v1/bookings/{id}/services` | Semua | Tambahkan layanan ke booking |

**Body buat reservasi:**
```json
{
  "customer_id": 1,
  "source": "walk_in",
  "check_in": "2026-11-10",
  "check_out": "2026-11-12",
  "guest_count": 2,
  "rooms": [1, 2],
  "guests": [
    { "name": "Budi Santoso", "ktp": "1234567890", "phone": "0812xxx", "is_primary": true },
    { "name": "Siti Rahma", "is_primary": false }
  ],
  "discount_amount": 0,
  "notes": "Minta kamar di lantai atas"
}
```

**Response booking:**
```json
{
  "data": {
    "id": 1,
    "booking_code": "BK-20261110-XXXX",
    "status": "confirmed",
    "check_in": "2026-11-10",
    "check_out": "2026-11-12",
    "total_price": 750000,
    "customer": { "id": 1, "name": "Budi Santoso" },
    "booking_rooms": [...],
    "invoice": { "id": 1, "status": "draft", "total": "825000.00" }
  }
}
```

> **Aturan bisnis penting:**
> - Harga dihitung di backend, jangan kirim total dari frontend
> - Double booking dicek otomatis → HTTP 409 jika konflik
> - Check-out ditolak jika tagihan belum lunas → HTTP 422

---

### 6.9 Shift

> Pegawai **wajib** memulai shift sebelum mencatat transaksi.

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `POST` | `/api/v1/shifts/start` | Pegawai | Mulai shift |
| `POST` | `/api/v1/shifts/end` | Pegawai | Akhiri shift |
| `GET` | `/api/v1/shifts/current` | Pegawai | Shift yang sedang berjalan |
| `GET` | `/api/v1/shifts` | Admin | Semua shift |

---

### 6.10 Invoice

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/invoices` | Semua | List invoice |
| `GET` | `/api/v1/invoices/{id}` | Semua | Detail invoice |
| `GET` | `/api/v1/invoices/{id}/pdf` | Semua | Download PDF invoice |
| `POST` | `/api/v1/bookings/{id}/invoice` | Semua | Buat invoice manual |
| `POST` | `/api/v1/invoices/{id}/recalculate` | Semua | Recalculate total |

**Response invoice:**
```json
{
  "data": {
    "id": 1,
    "invoice_number": "INV-20261110-0001",
    "booking_id": 1,
    "status": "draft",
    "subtotal": "700000.00",
    "discount": "0.00",
    "tax": "77000.00",
    "total": "777000.00"
  }
}
```

---

### 6.11 Pembayaran (Payments)

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `POST` | `/api/v1/bookings/{id}/payments` | Semua | Catat pembayaran manual |
| `GET` | `/api/v1/payments/{id}` | Semua | Detail pembayaran |
| `POST` | `/api/v1/payments/{id}/proof` | Semua | Upload bukti transfer |
| `PATCH` | `/api/v1/payments/{id}/verify` | **Admin only** | Verifikasi transfer |
| `POST` | `/api/v1/bookings/{id}/payments/gateway` | Semua | Buat permintaan gateway |

**Body catat pembayaran:**
```json
{
  "amount": 777000,
  "method": "cash",
  "type": "final",
  "notes": "Dibayar tunai saat check-in"
}
```

> **Aturan:**
> - `cash` → langsung `verified` (tidak perlu verifikasi admin)
> - `transfer` → status `pending`, perlu upload bukti, verifikasi admin
> - Tidak bisa melebihi total invoice (`HTTP 422`)

**Body buat pembayaran gateway:**
```json
{ "channel": "qris" }
```
> Channel yang tersedia: `qris` | `va` | `ewallet`

**Response gateway payment:**
```json
{
  "data": { "id": 5, "gateway_transaction_id": "SIM-ABCDEF123456", "expires_at": "..." },
  "payment_info": {
    "qr_string": "SIMULATOR_QR_SIM-ABCDEF123456_AMOUNT_777000",
    "transaction_id": "SIM-ABCDEF123456",
    "amount": 777000
  }
}
```

**Upload bukti transfer:**
```ts
const formData = new FormData()
formData.append('proof', file)
await axios.post(`/api/v1/payments/${paymentId}/proof`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
```

---

### 6.12 Webhook Gateway (PUBLIK)

| Method | URL | Auth | Deskripsi |
|---|---|---|---|
| `POST` | `/api/webhooks/payment-gateway` | ❌ Tidak perlu | Callback dari payment gateway |

> **Catatan frontend:** endpoint ini untuk gateway, bukan untuk dipanggil frontend.

---

### 6.13 Log Gateway (Admin only)

| Method | URL | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/payment-gateway-logs` | Lihat semua log webhook |

Query params: `?provider=simulator&processed=true&signature_valid=false`

---

### 6.14 Housekeeping

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/housekeeping-tasks` | Semua | List tugas kebersihan |
| `PATCH` | `/api/v1/housekeeping-tasks/{id}` | Semua | Update status + catatan |

**Body update housekeeping:**
```json
{
  "status": "completed",
  "notes": "Sudah dibersihkan dan dilaporkan bersih"
}
```

> Saat status → `completed`, kamar otomatis berubah ke `available`.

---

### 6.15 Maintenance

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/maintenance` | Semua | List laporan kerusakan |
| `POST` | `/api/v1/maintenance` | Semua | Laporkan kerusakan |
| `GET` | `/api/v1/maintenance/{id}` | Semua | Detail |
| `PUT` | `/api/v1/maintenance/{id}` | Admin | Update |
| `PATCH` | `/api/v1/maintenance/{id}/status` | Semua | Update status |

---

### 6.16 Review

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/reviews` | Admin | Semua review |
| `POST` | `/api/v1/bookings/{id}/review` | Semua | Input review (setelah check-out) |

**Body review:**
```json
{
  "rating": 5,
  "comment": "Kamar bersih, pelayanan ramah"
}
```

---

### 6.17 Laporan (Admin only)

Semua laporan mendukung parameter:
- `?from=2026-11-01&to=2026-11-30` — filter periode
- `?format=json` — default, kembalikan JSON
- `?format=pdf` — download file PDF
- `?format=xlsx` — download file Excel

| Method | URL | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/reports/occupancy` | Tingkat okupansi kamar |
| `GET` | `/api/v1/reports/revenue` | Pendapatan harian |
| `GET` | `/api/v1/reports/reservations` | Daftar reservasi |
| `GET` | `/api/v1/reports/transactions` | Transaksi pembayaran |
| `GET` | `/api/v1/reports/payment-methods` | Rekapitulasi per metode bayar |
| `GET` | `/api/v1/reports/shifts` | Laporan per shift pegawai |
| `GET` | `/api/v1/reports/sources` | Sumber reservasi (walk-in, traveloka, dll) |
| `GET` | `/api/v1/reports/housekeeping` | Laporan housekeeping |

**Contoh download PDF di React:**
```ts
const downloadPdf = async (type: string) => {
  const response = await axios.get(`/api/v1/reports/${type}?format=pdf`, {
    responseType: 'blob',
    withCredentials: true
  })
  const url = URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = `laporan-${type}.pdf`
  link.click()
}
```

---

## 7. Alur Kerja Kritis

### Alur Reservasi Lengkap

```
[Cek Kamar Tersedia]
GET /rooms/availability?check_in=&check_out=

[Buat Reservasi]
POST /bookings
↓
Status: confirmed (otomatis jika ada DP)
Invoice: draft (otomatis dibuat)

[Tambah Layanan (opsional)]
POST /bookings/{id}/services

[Bayar]
POST /bookings/{id}/payments  ← cash/transfer
POST /bookings/{id}/payments/gateway  ← QRIS/VA

[Check-In]
POST /bookings/{id}/check-in
↓ Kamar → occupied

[Tambah Layanan Saat Menginap (opsional)]
POST /bookings/{id}/services

[Check-Out]
POST /bookings/{id}/check-out  ← GAGAL jika belum lunas
↓
Booking → checked_out
Kamar → cleaning
Housekeeping task dibuat otomatis
```

### Alur Pembayaran Transfer

```
POST /payments  { method: "transfer" }
↓ status: pending

POST /payments/{id}/proof  ← upload bukti

PATCH /payments/{id}/verify  ← Admin verifikasi
↓ status: verified
↓ Jika lunas → Invoice: paid
```

### Alur Gateway Payment

```
POST /bookings/{id}/payments/gateway  { channel: "qris" }
↓ Tampilkan QR ke tamu

[Tamu bayar]

POST /api/webhooks/payment-gateway  ← Dikirim gateway (otomatis)
↓ Signature diverifikasi
↓ Payment: verified
↓ Invoice: paid (jika lunas)
```

---

## 8. Struktur Database (Relasi Penting)

```
users (admin | pegawai)
  └── shifts (satu shift per sesi kerja)

customers
  └── bookings
        ├── booking_rooms (kamar yang dibooking, snapshot harga)
        ├── booking_guests (tamu yang menginap)
        ├── booking_services (layanan tambahan)
        ├── invoice (1 per booking)
        │     └── payments (DP, final, refund)
        └── review (1 per booking)

rooms
  ├── room_type (kategori & harga dasar)
  ├── housekeeping_tasks (tugas kebersihan)
  ├── maintenance (laporan kerusakan)
  └── room_status_logs (riwayat perubahan status)

payment_gateway_logs (semua webhook masuk)
audit_logs (aksi penting)
```

---

## 9. Kredensial Default (Development)

```
Admin:
  email: admin@aedohotel.com
  password: password

Pegawai:
  email: pegawai@aedohotel.com
  password: password
```

---

## 10. Menjalankan Backend

```bash
# Install dependencies
composer install

# Setup environment
cp .env.example .env
php artisan key:generate

# Setup database
php artisan migrate --seed

# Jalankan server
php artisan serve

# Jalankan scheduler (expired payments)
php artisan schedule:work

# Jalankan test
php artisan test
```

---

## 11. Catatan Penting untuk Frontend

1. **CSRF:** Selalu panggil `GET /sanctum/csrf-cookie` sebelum login pertama kali.
2. **Cookies:** Set `withCredentials: true` pada semua request Axios/Fetch.
3. **Domain:** Di production, pastikan `SANCTUM_STATEFUL_DOMAINS` di `.env` backend mencakup domain frontend.
4. **Harga:** Semua kalkulasi harga dilakukan backend. Jangan kirim `total` dari frontend.
5. **KTP:** Field `ktp` dienkripsi di database — tidak akan muncul di response kecuali endpoint yang memang membutuhkannya.
6. **Shift:** Jika pegawai mencoba mencatat transaksi tanpa shift aktif, backend akan mengembalikan error — tampilkan peringatan di UI.
7. **Soft Delete:** Kamar dan tipe kamar menggunakan soft delete — data tidak hilang dari database meskipun di-delete via API.
8. **Payment Gateway (Sandbox):** Saat ini menggunakan simulator. QR string yang dikembalikan adalah palsu — untuk testing, kirim webhook manual ke `POST /api/webhooks/payment-gateway` untuk mensimulasikan pembayaran berhasil.

### Simulasi Webhook Gateway (untuk Testing Frontend)

```bash
# Ambil transaction_id dari response gateway payment, lalu:
curl -X POST http://localhost:8000/api/webhooks/payment-gateway \
  -H "Content-Type: application/json" \
  -H "X-Simulator-Signature: $(echo -n '{"transaction_id":"SIM-XXX","event":"payment.paid","status":"paid"}' | openssl dgst -sha256 -hmac 'simulator-secret-key-aedo-hotel' | cut -d' ' -f2)" \
  -d '{"transaction_id":"SIM-XXX","event":"payment.paid","status":"paid"}'
```

---

*Dokumen ini dibuat otomatis berdasarkan implementasi backend Sprint 1–7. Perbarui dokumen ini jika ada perubahan API.*
