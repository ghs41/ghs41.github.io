# GHS 41 — Website Bengkel Motor

Website statis resmi **GHS 41 — Aman, Enjoy, Santuy** untuk profil bengkel, katalog paket dan layanan, estimasi harga, serta booking melalui WhatsApp. Website dirancang untuk GitHub Pages dengan HTML, CSS, dan JavaScript tanpa backend atau database.

## Halaman

| Halaman | Fungsi |
| --- | --- |
| `index.html` | Beranda dan ringkasan layanan |
| `paket.html` | Katalog paket Ojol dan Non-Ojol dengan filter |
| `layanan.html` | Daftar layanan dan estimasi harga |
| `booking.html` | Form yang menyusun pesan booking WhatsApp |
| `tentang.html` | Prinsip Aman, Enjoy, Santuy dan alur servis |
| `kontak.html` | Kontak, petunjuk lokasi, dan informasi pembayaran |

`404.html` menjadi halaman cadangan ketika alamat yang dibuka tidak ditemukan.

## Fitur utama

- Tampilan responsif untuk desktop dan HP.
- Paket servis Ojol dan Non-Ojol untuk motor 110–250 cc.
- Filter paket berdasarkan penggunaan, jenis motor, dan kapasitas mesin.
- Pricelist layanan satuan dan estimasi harga.
- Form booking yang membuka WhatsApp dengan format pesan otomatis.
- Bengkel buka 24 jam; antrean dan durasi pengerjaan dikonfirmasi karena mengikuti kondisi motor.
- Antar-jemput motor tersedia setelah cakupan area, waktu, dan biaya disepakati melalui WhatsApp.
- Petunjuk lokasi resmi melalui Google Maps.
- SEO, Open Graph, sitemap, robots.txt, manifest PWA, dan dukungan offline dasar.
- Tidak menggunakan PHP, backend, database pelanggan, login, atau payment gateway.

## Alur booking

1. Pelanggan memilih paket atau layanan.
2. Pelanggan mengisi data motor, keluhan, serta rencana kedatangan.
3. Website menyusun pesan dan membukanya di WhatsApp.
4. Admin mengonfirmasi jadwal dan estimasi biaya.
5. Pelanggan datang ke bengkel dan pembayaran dilakukan langsung di bengkel.

Form tidak mengirim atau menyimpan data pribadi ke GitHub. Data baru diteruskan setelah pelanggan memilih untuk mengirim pesan melalui WhatsApp.

## Kontak dan lokasi resmi

- WhatsApp/admin: **+62 813-9554-6714** (`6281395546714`)
- Lokasi: **Jalan Raya Cijerah, Cibuntu, Bandung Kulon, Kota Bandung, Jawa Barat 40213**
- Google Maps: [GHS 41](https://www.google.com/maps/place/GHS41/@-6.917235,107.5681643,17z/data=!3m1!4b1!4m6!3m5!1s0x2e68e57f4f86bb5b:0x88898e3045abe7a5!8m2!3d-6.917235!4d107.5707392!16s%2Fg%2F11jnsh2x7j?hl=id&entry=ttu&g_ep=EgoyMDI2MDcyOS4wIKXMDSoASAFQAw%3D%3D)

Jam operasional **24 jam**. Pelanggan tetap disarankan mengonfirmasi antrean dan durasi melalui WhatsApp. Layanan antar-jemput motor tersedia dengan cakupan area, waktu, dan biaya yang dikonfirmasi terlebih dahulu. Nomor jalan tidak dituliskan karena belum tersedia pada informasi lokasi yang diberikan.

Instagram dan TikTok belum ditautkan. Foto galeri bengkel serta testimoni pelanggan asli juga belum tersedia, sehingga website tidak menampilkan konten pengganti atau ulasan buatan.

Konfigurasi kontak utama berada di `assets/js/app.js`, sedangkan nomor tujuan pesan booking juga digunakan oleh `assets/js/booking.js`. Fondasi visual berada di `assets/css/style.css` dan kalibrasi cascade premium berada di `assets/css/atelier-final.css`. Sistem motion premium (progress scroll, spotlight, mask reveal, parallax, dan interaksi CTA) berada di `assets/js/motion.js`; seluruh efek menghormati preferensi `prefers-reduced-motion`, dan perangkat sentuh otomatis memakai mode ringan yang aman untuk Safari. GitHub Pages memuat artefak produksi `assets/css/site.min.css` serta berkas `assets/js/*.min.js`; regenerasikan artefak tersebut setelah mengubah sumber.

## Katalog JSON

Konten katalog dipisahkan agar mudah diperbarui:

- `data/packages.json` — paket servis, kategori, isi paket, dan harga.
- `data/services.json` — layanan satuan, deskripsi, dan harga.
- `data/testimonials.json` — disiapkan untuk testimoni pelanggan terverifikasi; saat ini tetap berupa array kosong.

Gunakan ID unik, pertahankan struktur JSON yang valid, dan tulis harga sebagai angka tanpa `Rp` atau pemisah ribuan. Setelah memperbarui data, uji halaman Paket, Layanan, dan Booking.

Katalog saat ini menggunakan **Harga Launching** dari price list terbaru dan berlaku sampai pembaruan berikutnya. Harga dapat disesuaikan mengikuti pasar, kondisi motor, serta tingkat kesulitan pengerjaan. Durasi paket tidak menggunakan angka tetap karena mengikuti antrean bengkel dan hasil pemeriksaan motor.

## Pembayaran

Website tidak memproses pembayaran online. Metode yang ditampilkan:

- Tunai.
- QRIS di kasir.
- Transfer bank di bengkel.

Pembayaran dilakukan langsung di bengkel sesuai kebijakan bengkel setelah kebutuhan dan estimasi dikonfirmasi.

## PWA dan cache offline

`sw.js` menyimpan enam halaman utama, halaman 404, aset lokal, JavaScript, dan berkas JSON publik. Strateginya:

- **Network-first** untuk halaman HTML dan JSON agar informasi serta harga terbaru diprioritaskan saat online.
- **Stale-while-revalidate** untuk CSS, JavaScript, gambar, dan manifest lokal.
- Permintaan lintas domain seperti WhatsApp, Google Maps, dan Google Fonts tidak disimpan.
- Query string hanya dicache jika tercantum eksplisit di `PRECACHE_URLS` sebagai versi aset; query navigasi dan data booking tidak disimpan dinamis.
- Cache GHS 41 versi lama dihapus ketika service worker baru aktif.

Naikkan `CACHE_VERSION` di `sw.js` setiap kali mengubah halaman, aset, atau data yang perlu segera diperbarui pada perangkat pelanggan.

## Uji lokal

Jalankan server lokal dari root repository:

```bash
python -m http.server 8080
```

Buka `http://localhost:8080/`. Jangan membuka HTML langsung melalui `file://` karena pemuatan JSON dan service worker memerlukan HTTP/HTTPS.

## Deploy ke GitHub Pages

Untuk alamat utama `https://ghs41.github.io/`:

1. Gunakan repository publik `ghs41/ghs41.github.io`.
2. Simpan seluruh isi proyek di root branch `main`.
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`.
6. Pastikan halaman, JSON, gambar, `manifest.webmanifest`, dan `sw.js` dapat diakses setelah deployment selesai.

Bila repository memakai nama lain, alamatnya berbentuk `https://ghs41.github.io/nama-repository/`. Sesuaikan canonical URL pada HTML serta URL absolut di `sitemap.xml` dan `robots.txt`.
