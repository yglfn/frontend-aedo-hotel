import type { ReactNode } from 'react';
import './Table.css';

export interface Column<T> {
  key: string;
  header: string;
  cell: (item: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
  isLoading?: boolean;
}

export function Table<T>({ columns, data, keyExtractor, emptyMessage = 'Data tidak ditemukan', isLoading }: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="table-container">
        <div className="table-loading">Memuat data...</div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`text-${col.align || 'left'}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={keyExtractor(item)}>
                {columns.map((col) => (
                  <td key={col.key} className={`text-${col.align || 'left'}`}>
                    {col.cell(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
