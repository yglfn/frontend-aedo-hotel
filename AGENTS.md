# AGENTS.md — Backend Sistem Informasi Aedo Hotel Syariah

> Konteks utama untuk AI yang membantu membangun backend proyek ini. Baca seluruhnya sebelum menulis kode.
>
> - Bagian tanpa tanda adalah keputusan yang sudah berlaku. Ikuti.
> - **(default)** = keputusan desain sementara yang masuk akal. Ikuti, kecuali tim mengubahnya.
> - **[TENTUKAN]** = belum diputuskan (menunggu klien/tim). **Jangan menebak.** Berhenti dan tanyakan dulu, atau bangun dengan cara yang mudah diganti.

---

## 1. Ringkasan proyek

Sistem informasi berbasis web untuk mengelola operasional **Aedo Hotel Syariah** (hotel kecil): reservasi (walk-in/telepon, dan Traveloka yang diinput manual), data tamu, check-in/check-out, pembayaran (tunai, transfer, payment gateway), invoice, status kamar, housekeeping, maintenance, dashboard, dan laporan.

- Hotel hanya punya **2 pegawai** yang bergantian **2 shift @ 12 jam**. Akuntabilitas transaksi per shift itu penting.
- Tamu **tidak** punya akun dan **tidak** booking sendiri. Tamu hanya menerima link/QR pembayaran.
- Metode: Agile Scrum, 7 sprint (lihat bagian 10).
- Ini proyek kuliah dengan klien nyata. Utamakan kode yang sederhana, benar, dan mudah dijelaskan di laporan, bukan arsitektur yang berlebihan.

**Di luar scope (jangan dibuat):** booking mandiri oleh tamu, inventory, POS restoran, payroll, akuntansi formal, CRM/loyalty, smart lock/IoT/CCTV, aplikasi mobile native, multi-properti, mode offline.

## 2. Tech stack dan lingkungan

| Bagian | Pilihan |
| --- | --- |
| Backend | Laravel 11 (PHP 8.2+), hanya menyediakan API JSON |
| Database | MySQL 8 |
| Frontend | React + TypeScript (proyek terpisah) |
| Auth | Session berbasis cookie dengan **Laravel Sanctum mode SPA** (cookie session + CSRF). Frontend dan API harus berada di domain induk yang sama (mis. `app.domain.id` dan `api.domain.id`) |
| PDF | `barryvdh/laravel-dompdf` |
| Export Excel | `maatwebsite/excel` |
| Backup DB | `spatie/laravel-backup` + Laravel Scheduler |
| Testing | PHPUnit/Pest (feature test) + Postman collection |
| Version control | Git & GitHub |
| Deployment | VPS Indonesia (2 vCPU, 2 GB RAM) + domain `.id`. **[TENTUKAN]** web server (Nginx) dan apakah memakai Docker |

Pengaturan dasar:
- Timezone `Asia/Jakarta` (`APP_TIMEZONE`), locale `id`, mata uang IDR tanpa pecahan di tampilan (tetap `decimal(12,2)` di database).
- Jam default dari skema: check-in 14:00, check-out 12:00 (diambil dari `settings`, jangan di-hardcode).

## 3. Aktor dan hak akses

Hanya 2 role (`users.role`): `admin` (Admin/Owner) dan `pegawai`.

| Kemampuan | Admin | Pegawai |
| --- | :-: | :-: |
| Login, lihat dashboard | ✔ | ✔ (dashboard terbatas + transaksi shift berjalan) |
| CRUD pegawai, reset password, aktif/nonaktif akun | ✔ | ✘ |
| CRUD kamar, tipe kamar, harga, fasilitas | ✔ | ✘ (hanya lihat status) |
| CRUD layanan tambahan | ✔ | ✘ (hanya menambahkan ke reservasi) |
| Buat/ubah/batalkan reservasi, input tamu | ✔ | ✔ |
| Check-in, check-out | ✔ | ✔ |
| Catat pembayaran, buat permintaan bayar gateway, cetak invoice | ✔ | ✔ |
| Verifikasi bukti pembayaran manual | ✔ | ✘ |
| Lihat log callback gateway, transaksi pending/expired | ✔ | ✘ |
| Laporkan kerusakan kamar, update status kamar, kerjakan housekeeping task | ✔ | ✔ |
| Kelola penugasan housekeeping & maintenance, laporan housekeeping | ✔ | ✘ |
| Laporan + export PDF/Excel, lihat review | ✔ | ✘ |
| Pengaturan sistem | ✔ | ✘ |

Terapkan di backend lewat middleware dan Policy. Menyembunyikan menu di frontend saja tidak cukup. Akun `is_active = false` tidak boleh login.

## 4. Database

Skema awal ada di `database/schema.sql` (ekspor dbdiagram, sintaks MySQL). **Sumber kebenaran akhir adalah migration Laravel**, bukan file `.sql` itu. Tulis ulang sebagai migration (`$table->timestamps()` untuk created/updated, enum database atau PHP Enum + kolom string). Jangan menjalankan `.sql` mentah. Perbaiki juga default `DEFAULT (14:00:00)` pada `settings` menjadi `'14:00:00'`.

### 4.1 Tabel yang sudah ada di skema

- `settings`: konfigurasi hotel, **satu baris saja**.
- `users`: Admin & Pegawai (`role`, `is_active`, `last_login_at`).
- `customers`: data tamu yang dipakai ulang antar reservasi.
- `room_types`: `name`, `price` per malam, `facilities`, `max_person`.
- `rooms`: `room_type_id`, `room_number` (unique), `floor`, `status` (`available|booked|occupied|cleaning|maintenance`).
- `bookings`: header reservasi (`customer_id`, `created_by`, `source` = `walk_in|phone|traveloka|other`, `guest_count`, `check_in`, `check_out`, `status`, `discount_amount`, `total_price`, `cancel_reason`, `cancelled_at`).
- `booking_rooms`: satu baris per kamar per booking (multi-kamar), dengan snapshot `price_per_night`.
- `booking_guests`: tamu utama + tambahan (`is_primary`).
- `services`, `booking_services`: layanan tambahan; `price_at_transaction` adalah snapshot harga.
- `invoices`: `invoice_number` unik, `subtotal`, `discount`, `tax`, `total`, `status` (`draft|sent|paid|void`).
- `payments`: `method` (`cash|transfer|qris|payment_gateway`), `type` (`dp|final|refund`), `status` (`pending|verified|failed|expired`), `proof_of_payment`, `reference_number`, `verified_by`, `created_by`, `paid_at`.
- `housekeeping_tasks`, `maintenance`, `reviews`.

### 4.2 Tambahan skema yang dibutuhkan (buat sebagai migration baru, additive)

Laporan menuntut hal-hal ini tetapi belum ada di skema:

**`shifts`** (akuntabilitas per shift)
`id`, `user_id` (FK users), `started_at`, `ended_at` (nullable), `status` (`open|closed`), `note` (nullable), timestamps.

**`room_status_logs`** (riwayat status kamar)
`id`, `room_id`, `from_status`, `to_status`, `changed_by` (FK users, nullable bila diubah sistem), `booking_id` (nullable), `reason` (nullable), `created_at`.

**`payment_gateway_logs`** (log callback/webhook)
`id`, `payment_id` (nullable, bisa belum ketemu), `provider`, `event_type`, `payload` (json/longtext, mentah), `headers` (json, tanpa data rahasia), `signature_valid` (boolean), `processed` (boolean), `error_message` (nullable), `received_at`, `created_at`.

**`audit_logs`**
`id`, `user_id` (nullable), `action`, `auditable_type`, `auditable_id`, `old_values` (json), `new_values` (json), `ip_address`, `created_at`.

**Kolom tambahan pada tabel yang ada:**
- `payments`: `shift_id` (nullable FK), `provider`, `gateway_transaction_id`, `channel` (mis. qris/va/ewallet), `gateway_payload` (json: data QR/nomor VA), `expires_at`.
- `settings`: `payment_gateway_provider`, `payment_gateway_config` (terenkripsi), `payment_expiry_minutes` (default 60).
- `rooms`, `room_types`: `deleted_at` (SoftDeletes). Data master tidak boleh benar-benar dihapus bila sudah dipakai transaksi. `users` dan `services` cukup memakai `is_active`.

### 4.3 Keputusan desain data

- **Tanggal untuk availability** diambil dari `booking_rooms.check_in/check_out` (agar tiap kamar bisa punya tanggal berbeda). `bookings.check_in/check_out` diisi otomatis sebagai tanggal paling awal/akhir dari kamar-kamarnya dan dijaga tetap sinkron.
- Uang selalu `decimal(12,2)`, tidak pernah float.
- Snapshot harga (`price_per_night`, `price_at_transaction`) tidak boleh ikut berubah saat harga master diubah.
- Index: `bookings(status, check_in, check_out)`, `booking_rooms(room_id, check_in, check_out)`, `payments(status, booking_id)`, `payments(gateway_transaction_id)`.
- `customers.ktp` dan `booking_guests.ktp`: enkripsi di level aplikasi (cast `encrypted`). Jangan tampil di log atau response yang tidak memerlukannya.
- Gunakan PHP Enum (`app/Enums`) untuk status booking, kamar, pembayaran, dll. Jangan menyebar string literal.

## 5. Status dan alur

**Booking:** `pending → confirmed → checked_in → checked_out`, dengan cabang `cancelled`.
- `pending → confirmed`: (default) saat pegawai/admin mengonfirmasi, atau otomatis saat DP/pembayaran pertama berstatus `verified`.
- `cancelled`: wajib `cancel_reason`, isi `cancelled_at`, kamar dibebaskan dari availability.
- Booking yang sudah `checked_out` atau `cancelled` tidak boleh diubah, kecuali koreksi oleh admin yang tercatat di audit log.

**Kamar:** 
- check-in → `occupied`
- check-out → `cleaning` + buat `housekeeping_tasks` otomatis
- housekeeping `completed` → `available`
- maintenance aktif → `maintenance` (tidak boleh dijual); setelah `resolved` kembali ke `available` atau `cleaning` (default: `cleaning` dulu bila perlu dibersihkan)
- `booked` (default): dipakai hanya untuk kamar yang punya booking `confirmed` dengan check-in **hari ini**. Ini penanda visual untuk pegawai. **Ketersediaan untuk reservasi selalu dihitung dari tanggal**, bukan dari `rooms.status`.
- Setiap perubahan status kamar menulis satu baris ke `room_status_logs`.

**Housekeeping:** `pending → in_progress → completed`. **Maintenance:** `reported → in_progress → resolved`.

**Invoice (default):** satu invoice aktif per booking. Dibuat sebagai `draft` saat booking `confirmed`, diperbarui sesuai layanan/diskon, `sent` saat dicetak/dibagikan, `paid` saat total pembayaran `verified` menutup tagihan, `void` bila booking dibatalkan. DP tetap dikaitkan ke invoice yang sama.

## 6. Aturan bisnis

1. **Cegah double booking.** Kamar tidak tersedia bila ada `booking_rooms` beririsan dengan booking berstatus selain `cancelled`/`checked_out`. Irisan: `new.check_in < existing.check_out AND new.check_out > existing.check_in`. Cek + simpan dilakukan dalam satu DB transaction dengan `lockForUpdate` untuk mencegah race condition. Konflik dibalas HTTP 409.
2. **Jumlah malam** = selisih hari `check_out − check_in`, minimal 1. `check_out` harus setelah `check_in`.
3. **Reservasi multi-kamar:** satu booking boleh banyak kamar. `guest_count` tidak boleh melebihi total `max_person` kamar terpilih.
4. **Perhitungan harga dilakukan server**, bukan frontend:
   - `booking_rooms.total_price = price_per_night × malam`
   - `subtotal = Σ booking_rooms.total_price + Σ booking_services.total`
   - `pajak = (subtotal − diskon) × tax_percentage / 100`
   - `total = subtotal − diskon + pajak`
   - Diskon manual tidak boleh melebihi subtotal.
5. **Check-in:** booking harus `confirmed`; catat tamu yang menginap; booking → `checked_in`; kamar → `occupied`.
6. **Check-out:** hitung total akhir termasuk layanan tambahan; proses pelunasan bila masih ada sisa; booking → `checked_out`; kamar → `cleaning`; buat housekeeping task. Semua dalam satu transaction. Jika masih ada sisa tagihan yang belum diselesaikan, check-out ditolak.
7. **Pembayaran manual (tunai/transfer):** dibuat pegawai (`pending`), bukti dapat diunggah, **admin yang memverifikasi** (`verified_by`). Untuk tunai oleh pegawai, **[TENTUKAN]** apakah tetap perlu verifikasi admin atau langsung `verified`.
8. **Validasi nominal** sebelum status berubah (KNF-14). Total pembayaran `verified` tidak boleh melebihi tagihan, kecuali `type = refund`.
9. **Shift:** pegawai harus **memulai shift** (`POST /shifts/start`) sebelum mencatat transaksi, dan **mengakhiri shift** di akhir tugas. Satu pegawai hanya boleh punya satu shift `open`. Setiap pembayaran milik pegawai otomatis diberi `shift_id` shift yang sedang berjalan. Transaksi admin boleh `shift_id = null`. **[TENTUKAN]** jam mulai tiap shift dan apakah ada rekonsiliasi kas saat tutup shift.
10. **Audit:** catat `last_login_at`; aksi penting (verifikasi bayar, pembatalan, perubahan harga, diskon, koreksi data) ditulis ke `audit_logs`.
11. **Review (default):** tamu tidak login, jadi review diinput oleh admin/pegawai setelah check-out (rating 1–5 + komentar), satu review per booking.
12. **Notifikasi (default):** cukup notifikasi di dashboard (check-in/out hari ini, pembayaran pending/expired). Email/WhatsApp **tidak** dibuat kecuali diminta. **[TENTUKAN]** bila klien menginginkan kanal lain.

## 7. Payment gateway

- Metode: QRIS, Virtual Account, e-wallet. **[TENTUKAN]** provider (Midtrans/Xendit/Tripay/DOKU/dll.). Bangun di balik interface `PaymentGatewayInterface` (`app/Services/PaymentGateway/`) agar provider mudah diganti, dan mulai dengan sandbox.
- Alur: pegawai membuat permintaan bayar → backend memanggil API gateway → QR/nomor VA ditampilkan → gateway mengirim **webhook** → backend **memverifikasi signature** → validasi nominal → update `payments.status` dan, bila lunas, status invoice/booking.
- Endpoint webhook: publik (tanpa session/CSRF), **wajib** verifikasi signature, **idempotent** (webhook yang sama bisa datang berulang), tolak signature salah dengan 401/403, dan **selalu tulis ke `payment_gateway_logs`** termasuk yang gagal.
- Scheduler (tiap beberapa menit): tandai `pending` yang melewati `expires_at` menjadi `expired`; boleh sinkron status ke gateway.
- API key dan secret hanya di `.env` atau kolom terenkripsi. Jangan pernah di-commit, di-log, atau dikirim ke frontend.
- Selalu tersedia **fallback pembayaran manual** bila gateway bermasalah.
- Reservasi Traveloka: **[TENTUKAN]** bagaimana pembayarannya dicatat (dibayar ke hotel oleh Traveloka? nilai bersih atau kotor?) dan apakah perlu metode pembayaran khusus. Sampai ada keputusan, `source = traveloka` hanya menandai asal reservasi tanpa aturan pembayaran khusus.
- Refund: **[TENTUKAN]** kebijakan (DP hangus atau tidak, batas waktu). Tipe `refund` di `payments` sudah disiapkan.

## 8. Struktur kode dan konvensi API

```
app/
  Enums/                 # status booking, kamar, pembayaran, role
  Http/
    Controllers/Api/V1/  # tipis: validasi -> service -> resource
    Requests/            # Form Request untuk validasi
    Resources/           # API Resource untuk output
  Models/
  Policies/
  Services/              # logika bisnis: BookingService, AvailabilityService,
                         # PaymentService, InvoiceService, ShiftService, ReportService
    PaymentGateway/      # interface + implementasi provider
database/migrations, seeders, factories
tests/Feature/
```

- Prefix `/api/v1`, JSON, nama resource jamak.
- Sukses: `{ "data": ..., "meta": ... }`. Error: `{ "message": "...", "errors": { "field": ["..."] } }` dengan kode HTTP tepat (401, 403, 404, 409, 422).
- List memakai pagination, filter, dan pencarian. Target respons < 3 detik untuk operasi normal. Hindari N+1 (eager loading).
- Kode (tabel, kolom, class, route) berbahasa Inggris sesuai skema; pesan untuk pengguna berbahasa Indonesia.

### Gambaran endpoint (usulan, boleh disesuaikan)

| Modul | Endpoint | Akses |
| --- | --- | --- |
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | semua |
| Users | `apiResource users`, `PATCH users/{id}/activate`, `PATCH users/{id}/deactivate`, `POST users/{id}/reset-password` | admin |
| Shifts | `POST /shifts/start`, `POST /shifts/end`, `GET /shifts/current`, `GET /shifts` | pegawai / admin (list) |
| Settings | `GET /settings`, `PUT /settings` | admin |
| Dashboard | `GET /dashboard` | semua |
| Room types & rooms | `apiResource room-types`, `apiResource rooms`, `PATCH rooms/{id}/status`, `GET rooms/availability?check_in=&check_out=` | admin (CRUD), semua (lihat/ubah status) |
| Services | `apiResource services` | admin |
| Customers | `apiResource customers` (+ pencarian) | semua |
| Bookings | `apiResource bookings`, `POST bookings/{id}/check-in`, `POST bookings/{id}/check-out`, `POST bookings/{id}/cancel`, `POST bookings/{id}/services` | semua |
| Payments | `POST bookings/{id}/payments`, `POST payments/{id}/proof`, `PATCH payments/{id}/verify`, `POST bookings/{id}/payments/gateway`, `GET payments/{id}` | semua (verify: admin) |
| Invoices | `GET invoices`, `GET invoices/{id}`, `GET invoices/{id}/pdf` | semua |
| Webhook | `POST /webhooks/payment-gateway` | publik + signature |
| Gateway logs | `GET /payment-gateway-logs` | admin |
| Housekeeping | `GET housekeeping-tasks`, `PATCH housekeeping-tasks/{id}` (status + catatan) | semua; assign: admin |
| Maintenance | `apiResource maintenance`, `PATCH maintenance/{id}/status` | pegawai (lapor), admin (kelola) |
| Reviews | `GET reviews`, `POST bookings/{id}/review` | admin (lihat), semua (input) |
| Reports | `GET reports/{occupancy,revenue,reservations,transactions,payment-methods,shifts,sources,housekeeping}` + `?format=pdf\|xlsx` | admin |

## 9. Keamanan

HTTPS, password di-hash (bcrypt/argon), akses berbasis role, rate limiting untuk login, CSRF (Sanctum), validasi semua input, enkripsi API key dan data KTP, stack trace tidak tampil di produksi, backup database terjadwal (KNF-09), dan masukkan `.env` ke `.gitignore`.

## 10. Urutan pengerjaan (sprint)

| Sprint | Tanggal | Fokus backend |
| --- | --- | --- |
| 0 | 31 Agu – 6 Sep 2026 | Analisis & desain: ERD, setup environment |
| 1 | 7 – 18 Sep | Autentikasi & pengguna: login/logout, CRUD user, role & middleware |
| 2 | 19 Sep – 4 Okt | Dashboard & pengaturan (`settings`) |
| 3 | 5 – 18 Okt | Tipe kamar, kamar, layanan, status kamar + `room_status_logs`, housekeeping, maintenance |
| 4 | 19 Okt – 1 Nov | Reservasi multi-kamar, tamu, availability, check-in/out, `shifts` |
| 5 | 2 – 15 Nov | Invoice, pembayaran manual, verifikasi |
| 6 | 16 – 22 Nov | Payment gateway: request, webhook, `payment_gateway_logs`, scheduler |
| 7 | 23 – 29 Nov | Laporan, export PDF/Excel, finalisasi |

Kerjakan hanya sprint yang diminta. `shifts` dan kolom `shift_id` sebaiknya sudah ada sebelum modul pembayaran (Sprint 5). Karena Sprint 1–2 sudah lewat, bila ada tabel tambahan dari bagian 4.2 yang belum ada, tambahkan lewat migration baru.

## 11. Aturan untuk AI

**Lakukan:**
- Baca bagian relevan dokumen ini dan skema sebelum mengubah apa pun.
- Pakai migration, seeder (1 admin awal, 1 baris `settings`, data demo kamar), dan factory untuk testing.
- Tulis feature test untuk aturan penting: double booking, perhitungan total, alur check-in/out, hak akses per role, verifikasi signature webhook, idempotensi webhook, dan tidak bisa transaksi tanpa shift.
- Gunakan DB transaction untuk operasi yang mengubah beberapa tabel.
- Bila menemukan aturan yang belum jelas atau berstatus **[TENTUKAN]**, tanyakan, jangan menebak.

**Jangan:**
- Mengubah skema tanpa konfirmasi. Buat migration baru, jangan edit migration lama yang sudah dijalankan.
- Menaruh logika bisnis di controller atau mempercayai angka total dari frontend.
- Meng-commit `.env`, API key, atau data tamu asli.
- Menambah fitur di luar scope.
- Mengarang endpoint gateway, nama field provider, atau data lain yang tidak ada di dokumen ini.

**Definition of Done per fitur:** migration berjalan bersih, validasi + otorisasi ada, feature test lulus, endpoint tercatat di Postman collection, tidak ada secret yang bocor.

## 12. Setup dan perintah

```bash
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan serve
php artisan test
php artisan schedule:work   # scheduler: expired payment, backup
```

Environment variable: `APP_*` (termasuk `APP_TIMEZONE=Asia/Jakarta`), `DB_*`, `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN`, `FRONTEND_URL`, `PG_*` (kredensial gateway, nama pasti **[TENTUKAN]** setelah provider dipilih), konfigurasi backup.

## 13. Daftar keputusan yang masih terbuka

1. Provider payment gateway.
2. Pencatatan pembayaran reservasi Traveloka (nilai bersih/kotor, metode).
3. Kebijakan refund dan DP hangus.
4. Jam mulai/akhir tiap shift dan rekonsiliasi kas saat tutup shift.
5. Apakah pembayaran tunai oleh pegawai perlu verifikasi admin.
6. Kanal notifikasi selain dashboard (email/WhatsApp), bila diminta klien.
7. Web server dan Docker untuk deployment VPS.
