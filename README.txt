# ARCADEFIN - PROJECT CONTEXT & SPECIFICATION

## 1. Project Overview
- **Project Name:** ArcadeFin (Personal Finance & Expense Tracker)
- **Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Backend / Database:** Supabase (PostgreSQL) via Supabase JS Client (CDN).
- **Architecture:** Client-side rendering (Static Website). Tidak ada Node.js backend. Semua interaksi database (CRUD) dilakukan langsung dari browser ke REST API Supabase menggunakan Anon Public Key.

## 2. Database Schema (Supabase / PostgreSQL)
Database terdiri dari dua tabel utama yang saling berelasi.

### Tabel: `users`
Menyimpan data akun pengguna.
- `user_code` (TEXT, PRIMARY KEY): Token unik buatan user (kombinasi huruf & angka) yang digunakan sebagai kredensial login.
- `name` (TEXT): Nama lengkap pengguna.
- `email` (TEXT): Email pengguna (digunakan untuk fitur pemulihan/lupa token).
- `initial_balance` (NUMERIC): Saldo awal saat pendaftaran.
- `created_at` (TIMESTAMP): Waktu pembuatan akun (default: NOW()).

### Tabel: `transactions`
Menyimpan riwayat transaksi pemasukan dan pengeluaran.
- `id` (INTEGER / SERIAL, PRIMARY KEY): ID unik transaksi (Auto Increment).
- `user_code` (TEXT, FOREIGN KEY): Merujuk ke `users(user_code)`. Menandakan pemilik transaksi. ON DELETE CASCADE.
- `amount` (NUMERIC): Nominal uang.
- `type` (TEXT): Jenis transaksi (Nilai: "Pemasukan" atau "Pengeluaran").
- `category` (TEXT): Kategori transaksi (dilimitasi jumlah karakternya).
- `description` (TEXT): Detail transaksi.
- `date` (DATE): Tanggal transaksi dilakukan.
- `created_at` (TIMESTAMP): Waktu input data (default: NOW()).

## 3. Core Application Logic (app.js)
- **Authentication:** Sistem login bersifat *passwordless*, murni menggunakan `user_code`. Saat login berhasil, `user_code` disimpan di `localStorage` browser.
- **Data Fetching:** Saat mengambil data transaksi dari tabel `transactions`, query WAJIB difilter menggunakan `.eq('user_code', currentUserCode)` agar user hanya melihat datanya sendiri.
- **Data Insertion/Updating:** Setiap melakukan insert atau update data ke tabel `transactions`, payload wajib menyertakan nilai `user_code` dari localStorage.
- **Dynamic Balance Calculation:** Saldo saat ini tidak disimpan statis di database. Dihitung secara dinamis di frontend dengan rumus: `initial_balance` (dari tabel users) + Total `amount` tipe Pemasukan - Total `amount` tipe Pengeluaran.
- **Number Formatting:** Input jumlah uang memiliki validasi otomatis untuk mengubah angka menjadi format ribuan menggunakan titik (contoh: 5.000). Saat dikirim ke database, titik dihilangkan kembali menjadi integer/numeric murni.

## 4. UI / UX Design System (style.css & index.html)
- **Theme:** Dark Mode, modern, elegan, minimalis.
- **Layout:** Flexbox / Grid. Terdiri dari form input di kiri/atas, dan tabel riwayat di kanan/bawah. Dashboard memiliki card ringkasan (Saldo, Pemasukan, Pengeluaran) di bagian paling atas.
- **Interactivity:** 
  - Tombol hide/show (ikon mata) untuk menyembunyikan nominal uang.
  - Animasi karakter lucu yang muncul jika saldo negatif.
  - Double-click pada teks kolom "Deskripsi" di tabel untuk melihat teks lengkap (jika sebelumnya terpotong *ellipsis*).
  - Terdapat animasi *welcome* saat halaman login/register dimuat.
- **Assets:** Memiliki custom favicon dan logo `ArcadeFin` yang diambil dari folder `/assets/`.

## 5. Instruksi Ketat untuk AI Assistant (Developer Rules)
1. JANGAN PERNAH mengubah inisialisasi koneksi Supabase (`supabaseUrl` dan `supabaseAnonKey`) jika tidak diinstruksikan.
2. JANGAN PERNAH mengubah nama ID atau Class HTML sembarangan tanpa memperbarui referensinya di `app.js` dan `style.css`.
3. JANGAN mengasumsikan penggunaan backend Node.js, Express, atau framework JS (React/Vue). Aplikasi ini strictly menggunakan Vanilla JS.
4. JANGAN menghapus fitur localStorage untuk manajemen sesi pengguna.