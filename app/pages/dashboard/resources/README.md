# Resource Management Flow

Halaman resource mengikuti pola halaman studio: satu tabel sebagai pusat workflow, dialog untuk create/edit, menu aksi per baris, toast untuk hasil operasi, dan refresh query setelah mutation.

## Alur pengguna

1. Buka `Dashboard > Resources`.
2. Klik `Tambah resource`.
3. Pilih addon, isi nama resource, tentukan status aktif, lalu simpan.
4. Untuk mengubah data, buka menu baris lalu pilih `Edit resource`.
5. Untuk perubahan cepat, gunakan `Aktifkan` atau `Nonaktifkan`.
6. Untuk menghapus, pilih `Hapus` lalu konfirmasi.
7. Untuk mengatur prioritas tampil, geser handle pada baris dan tunggu toast sukses.

Semua operasi menonaktifkan kontrol yang relevan saat request berjalan. Setelah create, update, delete, status toggle, atau reorder berhasil, tabel mengambil data terbaru dari server.

## Ownership file

- `index.vue`: query list, tabel, filter, reorder, aksi status/delete, dan pembukaan dialog.
- `CreateResourceDialog.vue`: validasi dan mutation `createResource`.
- `EditResourceDialog.vue`: isi form dari row terpilih dan mutation `updateResource`.
- `ResourceMutations.php`: resolver create, update, delete, dan reorder.
- `schema.graphql`: kontrak query dan mutation resource.
- `2026_09_11_000001_add_sort_order_to_msb_resources_table.php`: migrasi untuk database yang sudah memiliki tabel resource.

## Kontrak GraphQL

- Query: `resources { id code name is_active sort_order cretime modtime addon { id name } }`
- Mutation: `createResource`, `updateResource`, `deleteResource`, `reorderResources`
- Reorder memakai `ReorderInput { id, sort_order }`, sama seperti studio.

## Checklist delegasi

- Jalankan `php artisan lighthouse:validate-schema` dari `BK`.
- Jalankan `npm run typecheck` dari `FE`; error yang sudah ada di `bookings/index.vue` harus dibedakan dari error resource.
- Uji create, edit addon/nama/status, toggle status, delete, dan drag reorder dengan akun yang memiliki ability `manage-master-data`.
- Jalankan migration sebelum menguji reorder pada database lama.
