'use client';

import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  /** Cell renderer; receives the row. */
  cell: (row: T) => React.ReactNode;
  /** Render this column with tabular monospace numerals. */
  numeric?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** When provided, renders a bulk-select checkbox column. */
  selection?: {
    selectedKeys: Set<string>;
    onToggle: (key: string) => void;
    onToggleAll: (keys: string[]) => void;
  };
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  selection,
  emptyMessage = 'Nothing here yet.',
}: DataTableProps<T>) {
  const allKeys = rows.map(rowKey);
  const allSelected = selection ? allKeys.every((k) => selection.selectedKeys.has(k)) : false;

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-surface-0">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-paper-100">
          <tr className="border-b border-neutral-200">
            {selection && (
              <th scope="col" className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={rows.length > 0 && allSelected}
                  onChange={() => selection.onToggleAll(allKeys)}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-4 py-2 text-caption font-semibold uppercase text-neutral-500',
                  col.numeric && 'text-right',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selection ? 1 : 0)}
                className="px-4 py-8 text-center text-neutral-600"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr key={key} className="border-b border-neutral-200 last:border-0 hover:bg-paper-100">
                  {selection && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${key}`}
                        checked={selection.selectedKeys.has(key)}
                        onChange={() => selection.onToggle(key)}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-ink-900',
                        col.numeric && 'text-right font-semibold tabular-nums',
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
