// components/data-table/types.ts
//
// Tipe-tipe bersama untuk sistem DataTable reusable.
// Semua komponen di folder ini generic terhadap TData — artinya tabel yang
// sama bisa dipakai untuk data booking, customer, invoice, dsb, tanpa
// menulis ulang komponen.

import type { Table } from "@tanstack/vue-table";

/**
 * Satu aksi baris (row action) generik, dipakai oleh DataTableRowActions.
 * Contoh: "Edit", "Batalkan Booking", "Hapus", dst.
 */
export interface DataTableRowAction<TData> {
  label: string;
  icon?: unknown; // component ikon (mis. dari @tabler/icons-vue), opsional
  /** Opsional: action yang punya `children` (submenu) tidak butuh handler */
  onSelect?: (row: TData) => void;
  /** Tampilkan separator SEBELUM item ini */
  separator?: boolean;
  /** Warna destructive (mis. untuk "Hapus") */
  destructive?: boolean;
  /** Nonaktifkan item secara kondisional */
  disabled?: (row: TData) => boolean;
  /** Kalau diisi, action dirender sebagai submenu (caret muncul otomatis) */
  children?: DataTableRowAction<TData>[];
}

/**
 * Konfigurasi satu filter kolom sederhana (select/dropdown) yang dirender
 * di toolbar, mis. filter Status booking: Pending / Confirmed / Cancelled.
 */
export interface DataTableFacetOption {
  label: string;
  value: string;
  icon?: unknown;
}

export interface DataTableFacetFilter {
  columnId: string;
  title: string;
  options: DataTableFacetOption[];
}

export type AnyTable<TData> = Table<TData>;
