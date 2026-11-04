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
      <div className="table-container" aria-busy="true" aria-label="Memuat data">
        <table className="table table-skeleton" aria-hidden="true">
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
            {Array.from({ length: 5 }, (_, row) => (
              <tr key={row}>
                {columns.map((col, column) => (
                  <td key={col.key} className={`text-${col.align || 'left'}`}>
                    <span className={`skeleton-line skeleton-line-${column % 3}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
