# DESIGN.md — Aedo Hotel Syariah (Frontend React + TypeScript)

> Dokumen ini adalah **sumber kebenaran visual & UX** untuk AI/developer yang membangun frontend.
> Baca bersama `FRONTEND_API.md` (kontrak API, enum, aturan bisnis). Jika ada konflik soal data/logika, `FRONTEND_API.md` menang. Jika soal tampilan/UX, dokumen ini menang.

---

## 1. Arah Desain (Design Direction)

**Karakter:** tenang, bersih, terpercaya, hangat. Cocok untuk hotel syariah: tidak ramai, tidak norak, tidak "startup neon".

**Referensi yang diadopsi:**

| Dari referensi | Yang diambil |
|---|---|
| Dashboard seller (referensi 1) | Sidebar ikon + label, kartu KPI pastel dengan chip ikon berwarna, angka besar tebal, teks pembanding kecil ("Kemarin 8.628"), grid *shortcut tile* (ikon + judul + subjudul), kartu "langkah berikutnya" |
| Dashboard bank (referensi 2) | Satu warna primer hijau tua yang konsisten, kartu putih di atas background abu kebiruan muda, daftar transaksi rapi dengan chip kategori, donut chart dengan angka di tengah, tab periode (Harian/Mingguan/Bulanan), tombol ikon kecil kotak hijau untuk "lihat semua" |

**Satu kalimat arah:** *"Kartu putih lembut di atas latar abu dingin, satu warna hijau tua sebagai identitas, warna pastel hanya untuk memberi makna pada data."*

### Prinsip

1. **Jelas dulu, cantik kemudian.** Resepsionis memakai ini sambil melayani tamu. Aksi utama harus terlihat < 1 detik.
2. **Satu aksi utama per layar.** Hanya satu tombol primer (hijau solid) per area.
3. **Warna = makna.** Warna selain hijau/netral hanya muncul untuk status dan kategori data, bukan dekorasi.
4. **Angka adalah bintang.** Angka penting (okupansi, pendapatan, tagihan) besar, tebal, `tabular-nums`.
5. **Kepadatan nyaman.** Informasi padat tapi bernapas: spacing konsisten, tidak sesak, tidak kosong berlebihan.
6. **Semua state didesain:** loading, kosong, error, sukses, disabled. Bukan cuma happy path.

---

## 2. Aturan Anti "AI Slop" (WAJIB)

### Dilarang
- ❌ Gradient ungu/biru-ke-pink di tombol, header, atau background halaman.
- ❌ Glassmorphism, blur berlebihan, glow neon, bayangan berwarna mencolok.
- ❌ Emoji sebagai ikon UI (🏨 ✅ 🚀). Pakai ikon vektor konsisten (lihat §3.6).
- ❌ Hero section besar berisi slogan generik di halaman aplikasi internal.
- ❌ Kartu bersarang dalam kartu dalam kartu. Maksimal 2 level (halaman → kartu → baris/tile).
- ❌ Semua elemen `rounded-3xl` + `shadow-2xl`. Radius & shadow ikut token di §3.
- ❌ Teks placeholder generik: "Lorem ipsum", "John Doe", "Welcome back, User!", "Streamline your workflow".
- ❌ Copywriting klise: "Revolusioner", "Seamless", "Powerful", "Tingkatkan produktivitas Anda".
- ❌ Angka dummy bulat sempurna (100, 1.000, 50%). Pakai data realistis (mis. `Rp 777.000`, `13 kamar`, `BK-20261110-0042`).
- ❌ Animasi berlebihan (bounce, pulse terus-menerus, parallax). Gerak hanya untuk memberi umpan balik.
- ❌ Dark mode "otomatis" setengah jadi. Hanya implementasikan jika seluruh token punya pasangan gelap.
- ❌ Font default tanpa pilihan sadar (jangan biarkan jatuh ke `system-ui` tanpa disengaja).
- ❌ Tabel tanpa state kosong, tombol tanpa state loading, form tanpa pesan error per field.
- ❌ Warna hardcode (`#3b82f6`, `bg-blue-500`) di komponen. Semua lewat token.

### Wajib
- ✅ Semua warna, radius, shadow, spacing lewat **design token** (CSS variables / Tailwind theme).
- ✅ Bahasa Indonesia natural, pendek, jelas (lihat §9).
- ✅ Data contoh realistis sesuai domain hotel.
- ✅ Setiap komponen punya state: default, hover, focus-visible, active, disabled, loading, error (jika relevan).
- ✅ Fokus keyboard terlihat jelas.
- ✅ Komponen dipakai ulang. Sebelum membuat komponen baru, cek apakah sudah ada di `components/ui`.

---

## 3. Design Tokens

Definisikan sebagai CSS variables di `:root` (dan petakan ke Tailwind theme bila memakai Tailwind). Nama token di bawah adalah kontrak, jangan diubah sembarangan.

### 3.1 Warna

```css
:root {
  /* Background & surface */
  --bg-app:        #F2F5F7;  /* latar halaman, abu dingin lembut */
  --surface:       #FFFFFF;  /* kartu, panel, sidebar */
  --surface-muted: #F6F8FA;  /* tile netral, header tabel, input readonly */
  --border:        #E4E8EC;  /* garis kartu & tabel */
  --border-strong: #CBD2D9;  /* input default */

  /* Teks (sedikit kehijauan agar menyatu dengan primer) */
  --ink-900: #12201B;  /* judul, angka besar */
  --ink-700: #2F3F39;  /* teks isi */
  --ink-500: #5E6E68;  /* label, teks sekunder */
  --ink-400: #8C9994;  /* placeholder, hint, teks pembanding */
  --ink-inverse: #FFFFFF;

  /* Primer: hijau tua (identitas Aedo) */
  --primary-50:  #E8F4F0;
  --primary-100: #CFE8E0;
  --primary-500: #12906F;
  --primary-600: #0E7C61;  /* tombol utama, link aktif */
  --primary-700: #0A624D;  /* hover */
  --primary-800: #084C3C;  /* kartu promo/highlight gelap */

  /* Semantik */
  --success-bg: #DFF4E8;  --success-fg: #1B7F4E;
  --info-bg:    #E3EEFE;  --info-fg:    #2B65D9;
  --warning-bg: #FEF1D6;  --warning-fg: #9A6410;
  --danger-bg:  #FDE8EA;  --danger-fg:  #C72C3A;
  --violet-bg:  #EDE9FC;  --violet-fg:  #5B49C2;
  --neutral-bg: #EEF1F4;  --neutral-fg: #55645E;

  /* Fokus */
  --focus-ring: 0 0 0 3px rgba(14, 124, 97, 0.28);
}
```

**Aturan pemakaian warna**
- Hijau primer: tombol utama, item sidebar aktif, link, indikator terpilih, segmen utama grafik.
- Pastel (`*-bg`) + warna tua (`*-fg`): kartu KPI, badge status, chip kategori. Ikon di dalam kartu pastel memakai `*-fg` pada chip putih/pekat kecil.
- Merah (`danger`) hanya untuk error, tombol hapus/batal destruktif, dan status bermasalah.
- Dilarang menambah warna aksen baru di luar daftar ini tanpa menambah token.

### 3.2 Pemetaan Status → Warna (dari enum API)

Gunakan satu komponen `<StatusBadge type="booking" value="checked_in" />` yang membaca tabel ini. Jangan menulis warna status manual di halaman.

**`booking.status`**
| Value | Label | Warna |
|---|---|---|
| `pending` | Menunggu | warning |
| `confirmed` | Dikonfirmasi | info |
| `checked_in` | Check-In | success |
| `checked_out` | Check-Out | neutral |
| `cancelled` | Dibatalkan | danger |

**`room.status`**
| Value | Label | Warna |
|---|---|---|
| `available` | Tersedia | success |
| `booked` | Dipesan | info |
| `occupied` | Terisi | violet |
| `cleaning` | Sedang Dibersihkan | warning |
| `maintenance` | Perbaikan | danger |

**`payment.status`**: `pending` → warning, `verified` → success, `failed` → danger, `expired` → neutral
**`payment.method`**: `cash` Tunai, `transfer` Transfer, `qris` QRIS, `payment_gateway` Gateway (chip netral dengan ikon)
**`payment.type`**: `dp` DP, `final` Pelunasan, `refund` Refund (chip netral; refund → danger)
**`invoice.status`**: `draft` neutral, `sent` info, `paid` success, `void` danger
**`housekeeping_task.status`**: `pending` warning, `in_progress` info, `completed` success
**`maintenance.status`**: `reported` danger, `in_progress` warning, `resolved` success
**`shift.status`**: `open` success, `closed` neutral
**`booking.source`**: `walk_in` Walk-in, `phone` Telepon, `traveloka` Traveloka, `other` Lainnya (chip netral)

> Status tidak boleh hanya dibedakan warna. Selalu sertakan **teks label** (dan ikon kecil bila perlu) agar terbaca oleh buta warna.

### 3.3 Tipografi

- **Font utama:** `Plus Jakarta Sans` (400, 500, 600, 700). Ramah, jelas untuk Bahasa Indonesia, tidak generik.
- **Fallback:** `system-ui, -apple-system, 'Segoe UI', sans-serif`.
- **Angka:** selalu `font-variant-numeric: tabular-nums` untuk uang, tanggal, jumlah, kolom tabel.
- Muat font lewat `@fontsource/plus-jakarta-sans` (self-host), bukan CDN, agar stabil di jaringan hotel.

| Peran | Ukuran / Line-height | Weight | Warna |
|---|---|---|---|
| `display` (angka KPI) | 32 / 40 | 700 | ink-900 |
| `h1` judul halaman | 24 / 32 | 700 | ink-900 |
| `h2` judul kartu | 18 / 26 | 600 | ink-900 |
| `h3` sub-judul | 15 / 22 | 600 | ink-900 |
| `body` | 14 / 22 | 400 | ink-700 |
| `body-strong` | 14 / 22 | 600 | ink-900 |
| `label` | 13 / 18 | 500 | ink-500 |
| `caption` (pembanding, hint) | 12 / 16 | 400 | ink-400 |

Aturan: maksimal 3 ukuran berbeda dalam satu kartu. Jangan pakai `text-xs` untuk informasi penting.

### 3.4 Spacing, Radius, Shadow

- **Skala spacing (px):** 4, 8, 12, 16, 20, 24, 32, 40, 48. Tidak ada angka di luar skala ini.
- **Padding kartu:** 20 (desktop) / 16 (mobile). **Gap antar kartu:** 16–24.
- **Radius:**
  - `--radius-card: 16px`
  - `--radius-control: 10px` (input, tombol, tile kecil)
  - `--radius-chip: 999px` (badge, chip, tab pill)
  - `--radius-modal: 20px`
- **Shadow:** sangat halus, hanya untuk kartu mengambang & modal.
  - `--shadow-card: 0 1px 2px rgba(18,32,27,0.04), 0 4px 16px rgba(18,32,27,0.04)`
  - `--shadow-pop: 0 8px 28px rgba(18,32,27,0.12)` (dropdown, modal, toast)
  - Kartu biasa: border `1px solid var(--border)` + `--shadow-card`. Tidak pakai shadow besar.

### 3.5 Gerak (Motion)

- Durasi: 120ms (hover/press), 200ms (buka/tutup), 280ms (modal/drawer). Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Hanya animasikan `opacity`, `transform`, `background-color`, `box-shadow`.
- Skeleton memakai shimmer lembut; hormati `prefers-reduced-motion` (matikan semua gerak non-esensial).
- Dilarang: bounce, shake berulang, loop dekoratif.

### 3.6 Ikon

- Satu pustaka saja: **Lucide React** (`lucide-react`), `strokeWidth={1.75}`, ukuran 16 / 20 / 24.
- Ikon dalam chip KPI: kotak 40×40, radius 12, warna latar sesuai tint kartu.
- Ikon tanpa label wajib punya `aria-label` / tooltip.

---

## 4. Layout & Navigasi

### 4.1 App Shell

```
┌──────────────────────────────────────────────────────────┐
│ Topbar (64px): nama hotel · shift aktif · notifikasi · user │
├───────────┬──────────────────────────────────────────────┤
│ Sidebar   │  Konten (max-width 1280px, padding 24)        │
│ 232px     │  Judul halaman + aksi utama (kanan)           │
│           │  Grid kartu                                   │
└───────────┴──────────────────────────────────────────────┘
```

- Latar halaman `--bg-app`. Sidebar & topbar `--surface` dengan border tipis (tanpa shadow besar).
- **Sidebar:** logo/nama "Aedo Hotel Syariah" di atas; item = ikon 20 + label 14/500; item aktif = latar `primary-50`, teks & ikon `primary-600`, indikator kiri 3px. Grup bisa diberi label kecil huruf kapital 11px `ink-400`.
- **Topbar:** kiri judul konteks (nama hotel), kanan: badge shift (`Shift berjalan · 08:00`), ikon notifikasi, avatar + nama + role.
- **Mobile (< 1024px):** sidebar jadi drawer (hamburger). Konten satu kolom. Tabel besar berubah jadi daftar kartu.

### 4.2 Menu per Role

| Menu | Admin | Pegawai |
|---|---|---|
| Dashboard | ✅ | ✅ (versi terbatas) |
| Reservasi | ✅ | ✅ |
| Kamar (papan status) | ✅ | ✅ (ubah status saja) |
| Pelanggan | ✅ | ✅ |
| Pembayaran & Invoice | ✅ | ✅ (tanpa verifikasi) |
| Housekeeping | ✅ | ✅ |
| Maintenance | ✅ | ✅ (lapor & update status) |
| Shift | ✅ (semua shift) | ✅ (shift sendiri) |
| Tipe Kamar, Layanan | ✅ | ❌ |
| Pengguna | ✅ | ❌ |
| Laporan | ✅ | ❌ |
| Review | ✅ | ❌ |
| Log Gateway | ✅ | ❌ |
| Pengaturan | ✅ | ❌ |

Menu yang tidak boleh diakses **disembunyikan**, bukan di-disable. Tetap lindungi route (redirect + halaman 403 bila diakses langsung).

### 4.3 Grid

- Desktop ≥ 1280: 12 kolom, gap 24. Laptop 1024–1279: gap 16.
- KPI row: 4 kartu sejajar (2 kolom di tablet, 1–2 di mobile).
- Pola dua kolom umum: konten utama 8 kolom + panel samping 4 kolom (mis. detail booking + ringkasan pembayaran).

---

## 5. Komponen

Semua komponen ada di `src/components/ui/`, bertipe TypeScript ketat, tanpa `any`.

### 5.1 Card
Putih, border `--border`, radius 16, `--shadow-card`, padding 20. Header kartu: judul `h2` kiri, aksi sekunder kanan (mis. tombol ikon "Lihat semua"). Divider antar bagian pakai `--border`, bukan kartu baru.

### 5.2 KPI Card (terinspirasi referensi 1)
```
┌───────────────────────────┐
│ Check-in hari ini      [◎]│  ← label 13/500 ink-500 + chip ikon 40×40
│ 3                         │  ← display 32/700 tabular-nums
│ Kemarin 5                 │  ← caption ink-400
└───────────────────────────┘
```
- Latar tint pastel (`info`, `success`, `violet`, `warning`, `danger` sesuai makna). Tanpa border, tanpa shadow.
- Isi dari `GET /api/v1/dashboard`: `today_checkins`, `today_checkouts`, `available_rooms`, `occupied_rooms`, `pending_payments`, `total_rooms`.
- Pemetaan warna anjuran: check-in → info, check-out → violet, kamar tersedia → success, kamar terisi → warning, pembayaran pending → danger.
- Baris kedua: kartu netral (`surface-muted`) untuk metrik pendukung (mis. okupansi %).
- Bisa diklik bila ada tujuan (mis. "Pembayaran pending" → daftar pembayaran), beri hover naik halus & cursor pointer; jika tidak bisa diklik, jangan beri efek hover.

### 5.3 Shortcut Tile (terinspirasi "Operations Assistant")
Grid 4 kolom: ikon 40 di kiri, judul 14/600, subjudul 12 `ink-400`. Latar putih + border, hover `surface-muted`. Dipakai di dashboard untuk aksi cepat: **Reservasi Baru, Check-in, Check-out, Catat Pembayaran, Cek Ketersediaan, Lapor Kerusakan, Mulai/Akhiri Shift, Laporan** (sesuai role).

### 5.4 Highlight Card (terinspirasi kartu "standing orders" referensi 2)
Satu kartu gelap `primary-800` dengan teks putih, judul, 1–2 kalimat, dan satu tombol putih. Pakai **maksimal satu per halaman**, untuk hal penting seperti "Anda belum memulai shift" atau ringkasan tagihan. Boleh berisi ilustrasi garis sederhana, bukan stok foto.

### 5.5 Button
| Varian | Gaya | Kapan |
|---|---|---|
| `primary` | bg `primary-600`, teks putih, hover `primary-700` | Aksi utama (maks 1 per area) |
| `secondary` | bg putih, border `border-strong`, teks `ink-900` | Aksi pendukung |
| `ghost` | transparan, teks `ink-700`, hover `surface-muted` | Aksi tersier, di tabel |
| `danger` | bg `danger-fg`, teks putih | Batalkan/hapus (setelah konfirmasi) |
| `icon` | 36×36, radius 10 | Aksi ikon; "Lihat semua" memakai kotak hijau kecil dengan panah seperti referensi 2 |

Tinggi: 40 (default), 32 (kecil), 48 (form besar/login). Radius 10. Loading → spinner kecil menggantikan ikon, teks tetap, tombol `disabled`. Jangan mengubah lebar tombol saat loading.

### 5.6 Form
- Label di atas input (13/500), wajib diberi tanda `*` hanya jika mayoritas opsional; kalau mayoritas wajib, tandai yang opsional "(opsional)".
- Input tinggi 40, radius 10, border `border-strong`, fokus `border primary-600` + `--focus-ring`. Error: border `danger-fg` + pesan 12px `danger-fg` di bawah field.
- Pesan error per field diambil dari `errors.field_name[0]` response 422.
- Tombol Simpan di kanan bawah form, Batal di kirinya (secondary). Form panjang dipecah jadi bagian bertitle, bukan satu kolom raksasa.
- Pemilih tanggal: input rentang check-in/check-out dengan ringkasan "2 malam" otomatis.
- Pemilih kamar: kartu kamar yang bisa dipilih (nomor, lantai, tipe, harga), bukan dropdown panjang.
- Input uang: prefix `Rp`, pemisah ribuan, kirim angka murni ke API.

### 5.7 Tabel & Daftar
- Header `surface-muted`, teks 12/600 `ink-500` huruf kapital ringan; baris tinggi 52; hover baris `surface-muted`; border bawah `--border`.
- Angka & uang rata kanan, `tabular-nums`. Kolom aksi di paling kanan, `ghost`/`icon`.
- Paginasi memakai `meta` API (`current_page`, `last_page`, `per_page`, `total`): "Menampilkan 1–15 dari 72".
- Pencarian + filter di atas tabel (satu baris). Filter aktif tampil sebagai chip yang bisa dihapus.
- **Daftar transaksi** (gaya referensi 2): baris ringkas — tanggal kecil, nama, chip metode/tipe, status, nominal tebal kanan (`+` hijau untuk masuk, `−` merah untuk refund).
- Mobile: setiap baris menjadi kartu kecil.

### 5.8 Badge / Chip
Tinggi 24, padding 0 10, radius pill, teks 12/600, latar `*-bg`, teks `*-fg`, titik status 6px di kiri (opsional). Hanya lewat `StatusBadge`/`Chip`.

### 5.9 Tabs & Segmented Control
Untuk periode (Harian / Mingguan / Bulanan) dan filter status. Pill: aktif = bg `primary-600` teks putih atau bg putih + shadow tipis di dalam wadah `neutral-bg`; satu gaya saja di seluruh aplikasi (pilih segmented dalam wadah abu).

### 5.10 Modal, Drawer, Konfirmasi
- Modal untuk form pendek & konfirmasi (maks 520px). Drawer kanan (480px) untuk detail/edit panjang.
- Aksi destruktif (batalkan booking, hapus user, nonaktifkan layanan): modal konfirmasi menyebut objeknya ("Batalkan reservasi BK-20261110-0042?"), tombol `danger` berlabel aksi spesifik ("Ya, batalkan"), bukan "OK".
- Tutup dengan Esc, klik overlay (kecuali form yang sudah diisi), dan tombol X. Fokus terperangkap di dalam modal & dikembalikan setelah ditutup.

### 5.11 Toast
Kanan atas, otomatis hilang 4 detik (error 6 detik atau manual). Satu pesan singkat + ikon status. Jangan toast untuk error validasi field (tampilkan di field).

### 5.12 Empty, Loading, Error State
- **Loading:** skeleton sesuai bentuk konten (kartu KPI, baris tabel), bukan spinner layar penuh. Spinner hanya untuk tombol.
- **Empty:** ikon garis 40px `ink-400`, judul singkat, satu kalimat penjelasan, satu aksi. Contoh: "Belum ada reservasi hari ini" + tombol "Buat reservasi".
- **Error:** pesan manusiawi + tombol "Coba lagi". Jangan tampilkan stack trace atau pesan teknis mentah.

### 5.13 Grafik (terinspirasi donut referensi 2)
- **Donut:** untuk komposisi (sumber reservasi, metode bayar, status kamar). Maks 6 segmen; segmen terpilih menonjol sedikit; angka & label di tengah; legenda di samping dengan titik warna + nama + nilai.
- **Bar/Line:** untuk tren pendapatan & okupansi. Grid horizontal tipis `--border`, tanpa border grafik, tooltip putih `--shadow-pop`, sumbu `ink-400` 12px.
- Warna grafik berurutan: `primary-600`, `info-fg`, `violet-fg`, `warning-fg`, `success-fg`, `neutral-fg`. Dilarang palet pelangi acak.
- Selalu sediakan fallback teks/tabel untuk aksesibilitas ("Lihat sebagai tabel").
- Pustaka grafik: Recharts atau sejenis yang ringan, dengan theming lewat token.

### 5.14 Papan Kamar (Room Board)
Grid kartu kamar per lantai. Tiap kartu: nomor kamar besar, tipe kamar, badge status, nama tamu (jika `occupied`). Warna tepi kiri 4px mengikuti status. Klik → drawer detail + aksi cepat (ubah status, lapor kerusakan, lihat booking).

### 5.15 Stepper Alur
Untuk alur booking (Pilih tanggal → Pilih kamar → Data tamu → Ringkasan & bayar) dan checklist awal (referensi 1 "Well begun is half done"). Langkah selesai = hijau + centang, aktif = outline hijau, berikutnya = abu.

---

## 6. Rancangan Halaman

### 6.1 Login
Dua kolom di desktop: kiri form (email, password, tombol "Masuk"), kanan panel `primary-800` dengan nama hotel & satu kalimat singkat (tanpa stok foto generik). Mobile: hanya form. Error login tampil di atas form (`danger-bg`). Alur: `GET /sanctum/csrf-cookie` → `POST /auth/login` → `GET /auth/me` → redirect dashboard.

### 6.2 Dashboard
1. Judul: "Selamat pagi/siang/sore, {nama}" (sesuai jam WIB) + tanggal hari ini format `Jumat, 9 Oktober 2026`.
2. **Banner shift** (pegawai, jika shift belum dimulai): Highlight Card dengan tombol "Mulai shift". Transaksi dikunci sampai shift berjalan.
3. Baris KPI (4 kartu) + baris metrik pendukung netral.
4. Grid Shortcut Tile.
5. Dua kartu bawah: "Kedatangan & keberangkatan hari ini" (daftar) dan "Status kamar" (donut + legenda).
6. Admin: kartu "Perlu tindakan" (pembayaran transfer menunggu verifikasi, kamar perbaikan).

### 6.3 Reservasi
- Daftar: pencarian (kode/nama tamu), filter status & sumber & rentang tanggal, tabel dengan kolom Kode, Tamu, Kamar, Check-in/out, Total, Status, Aksi. Tombol primer "Reservasi baru".
- **Form baru:** stepper 4 langkah (lihat 5.15). Cek ketersediaan via `GET /rooms/availability`. Total harga **hanya ditampilkan dari respons backend**, tidak dihitung/dikirim dari frontend (boleh tampilkan estimasi bertanda "Estimasi" jika perlu, tetapi kirim hanya data input).
- Konflik 409 → tampilkan pesan jelas "Kamar sudah dipesan pada tanggal tersebut" dan kembali ke langkah pilih kamar.
- **Detail:** header (kode, status, aksi kontekstual), kolom kiri: tamu, kamar, layanan tambahan; kolom kanan: ringkasan invoice & pembayaran. Tombol aksi menyesuaikan status (Check-in hanya saat `confirmed`; Check-out hanya saat `checked_in`; Batalkan sebelum `checked_in`).
- Check-out ditolak 422 karena belum lunas → tampilkan sisa tagihan + tombol "Catat pembayaran".

### 6.4 Pembayaran & Invoice
- Ringkasan invoice (subtotal, diskon, pajak, total, terbayar, sisa) dengan angka besar untuk **Sisa tagihan**.
- Form catat pembayaran: nominal, metode, tipe, catatan. Validasi: tidak melebihi total (error 422 dari API ditampilkan).
- Transfer: status `pending`, area unggah bukti (drag & drop, pratinjau gambar, batas ukuran jelas), admin melihat tombol "Verifikasi".
- Gateway: pilih channel (QRIS/VA/E-wallet) → tampilkan QR/instruksi, hitung mundur `expires_at`, polling status ringan. Beri label "Mode simulator" selama sandbox.
- Unduh PDF invoice via `GET /invoices/{id}/pdf` (blob).

### 6.5 Housekeeping & Maintenance
- Papan tiga kolom (Menunggu / Dikerjakan / Selesai) atau daftar dengan filter; ubah status inline dengan catatan.
- Selesai → beri info "Kamar kembali tersedia".
- Maintenance: form lapor singkat (kamar, deskripsi, prioritas bila ada), daftar dengan badge status.

### 6.6 Laporan (Admin)
Pemilih rentang tanggal di atas, tab jenis laporan, ringkasan angka + grafik + tabel. Tombol "Unduh PDF" dan "Unduh Excel" (blob download dengan state loading). Preset cepat: Hari ini, 7 hari, Bulan ini.

### 6.7 Pengguna, Tipe Kamar, Layanan, Pengaturan (Admin)
Tabel + drawer form. Pengguna: toggle aktif/nonaktif dengan konfirmasi, aksi "Reset password". Pengaturan: form terkelompok (Profil hotel, Jam check-in/out, Pajak, Kadaluarsa pembayaran) dengan satu tombol simpan tetap di bawah.

---

## 7. Aturan UX & Integrasi API

1. **Auth:** Sanctum SPA cookie. `withCredentials: true` di semua request. Tidak menyimpan token di `localStorage`.
2. **401** → bersihkan state user, arahkan ke login, simpan tujuan awal untuk redirect balik.
3. **403** → halaman/komponen "Anda tidak punya akses ke halaman ini" + tombol kembali ke dashboard.
4. **404** → state "Data tidak ditemukan".
5. **409** → pesan konflik spesifik (double booking) di konteks aksi.
6. **422** → petakan `errors` ke field; jika pesan umum, tampilkan `message` di atas form.
7. **Tanpa shift aktif** → banner jelas + aksi transaksi dinonaktifkan dengan tooltip alasan, serta tampilkan error backend bila tetap terpanggil.
8. **Uang:** API mengirim string desimal (`"777000.00"`) atau angka. Selalu parse lalu format tanpa desimal:
   ```ts
   export const formatIDR = (v: number | string) =>
     new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v))
   ```
9. **Tanggal & waktu:** zona `Asia/Jakarta`. Tampilkan `9 Okt 2026` (daftar) atau `Jumat, 9 Oktober 2026` (judul); jam `14:00`. Gunakan `Intl.DateTimeFormat('id-ID')` atau `date-fns/locale/id`. Kirim ke API format `YYYY-MM-DD`.
10. **KTP:** tidak ditampilkan penuh di UI kecuali memang dikembalikan endpoint; jika ditampilkan, maskir (`3171••••••••0001`).
11. **Optimistic UI** hanya untuk aksi ringan dan mudah dibatalkan (ubah status housekeeping). Aksi uang & check-in/out menunggu respons server.
12. **Data fetching:** gunakan satu lapisan (mis. TanStack Query) dengan key konsisten; invalidate setelah mutasi (booking, payment, room status).
13. **Debounce** pencarian 300ms. **Jangan** kirim request pada setiap ketikan.
14. **Cegah submit ganda:** tombol disabled saat mutasi berjalan.
15. **Form tidak boleh kehilangan data** saat error; pertahankan input.

---

## 8. Aksesibilitas & Responsif

- Kontras teks ≥ 4.5:1 (cek `ink-500`/`ink-400` di atas `surface-muted`).
- Semua kontrol bisa dioperasikan dengan keyboard; urutan tab logis; `:focus-visible` memakai `--focus-ring`.
- Target sentuh ≥ 40×40 px di mobile.
- Gunakan elemen semantik (`button`, `nav`, `main`, `table`, `label`). Modal pakai `role="dialog"` + `aria-modal` + judul ber-`aria-labelledby`.
- Status/grafik tidak hanya bergantung warna.
- Breakpoint: 640 / 768 / 1024 / 1280. Desain **desktop-first** (resepsionis di PC) tetapi harus layak di tablet; mobile minimal untuk housekeeping & cek status.
- Hormati `prefers-reduced-motion`.

---

## 9. Copywriting (Bahasa Indonesia)

- Nada: sopan, lugas, hangat. Gunakan "Anda" untuk pesan sistem. Hindari slang di UI.
- Label tombol berupa kata kerja spesifik: "Simpan reservasi", "Catat pembayaran", "Proses check-in". Hindari "Submit", "OK", "Klik di sini".
- Pesan sukses menyebut hasil: "Reservasi BK-20261110-0042 berhasil dibuat."
- Pesan error menjelaskan masalah + langkah: "Kamar 101 sudah dipesan pada 10–12 Nov. Pilih kamar atau tanggal lain."
- Empty state: apa yang kosong + apa yang bisa dilakukan.
- Konsisten istilah: *Reservasi* (bukan Booking di UI), *Tamu*, *Kamar*, *Check-in/Check-out*, *Pelunasan*, *Tagihan*.
- Placeholder form memberi contoh realistis: `nama@email.com`, `0812 3456 7890`, bukan "Masukkan email".

---

## 10. Struktur Kode Frontend (Anjuran)

```
src/
  styles/
    tokens.css          # semua CSS variables di §3
    globals.css
  components/
    ui/                 # Button, Card, KpiCard, ShortcutTile, StatusBadge, Chip,
                        # Input, Select, DateRange, Table, Tabs, Modal, Drawer,
                        # Toast, EmptyState, Skeleton, Donut, Stepper
    layout/             # AppShell, Sidebar, Topbar, PageHeader
  features/
    auth/ dashboard/ bookings/ rooms/ payments/ invoices/
    housekeeping/ maintenance/ reports/ users/ settings/
  lib/
    api.ts              # axios instance (withCredentials, baseURL, interceptor 401)
    format.ts           # formatIDR, formatDate, maskKtp
    status.ts           # pemetaan enum → label & warna (§3.2)
  types/                # tipe TS dari enum & response API
```

- Enum API dijadikan union type TS (`type BookingStatus = 'pending' | 'confirmed' | ...`) di satu tempat, dipakai bersama `status.ts`.
- Komponen presentasional tidak memanggil API langsung; data lewat hooks di `features/*`.

---

## 11. Checklist Sebelum Menyerahkan Pekerjaan

AI/developer wajib memeriksa:

- [ ] Hanya memakai token (tidak ada hex/warna Tailwind mentah di komponen).
- [ ] Hanya satu tombol primer per area; ikon dari Lucide; tanpa emoji UI.
- [ ] Tidak ada gradient ungu, glassmorphism, atau shadow tebal.
- [ ] Status memakai `StatusBadge` + teks label, sesuai §3.2.
- [ ] Ada state loading (skeleton), kosong, error, dan disabled.
- [ ] Form menampilkan error per field dari respons 422.
- [ ] Uang & tanggal diformat `id-ID`, `tabular-nums` untuk angka.
- [ ] Hak akses role diterapkan di menu **dan** route.
- [ ] Aksi destruktif memakai konfirmasi spesifik.
- [ ] Keyboard focus terlihat, kontras cukup, responsif di 1024 & 390 px.
- [ ] Copywriting Bahasa Indonesia natural, tanpa kalimat klise.
- [ ] Tidak ada data dummy generik ("John Doe", "Lorem ipsum").

---

*Perbarui dokumen ini jika identitas visual atau komponen inti berubah. Perubahan token harus dilakukan di `tokens.css`, bukan di komponen.*
