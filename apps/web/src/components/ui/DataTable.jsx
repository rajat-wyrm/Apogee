import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { cn } from '../../lib/utils';

export function DataTable({
  columns,
  data = [],
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search…',
  pagination = true,
  pageSize = 10,
  emptyTitle = 'No results',
  emptyDescription = 'Try adjusting your filters or search term.',
  emptyIcon,
  rowKey = 'id',
  onRowClick,
  className,
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: null });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const v = col.searchValue ? col.searchValue(row) : row[col.key];
        return String(v ?? '').toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : a[sort.key];
      const bv = col.sortValue ? col.sortValue(b) : b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sort.dir === 'asc' ? av - bv : bv - av;
      }
      return sort.dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = pagination ? sorted.slice((safePage - 1) * pageSize, safePage * pageSize) : sorted;

  const handleSort = (key) => {
    setSort((s) => {
      if (s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: null };
    });
  };

  return (
    <div className={cn('rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden', className)}>
      {searchable && (
        <div className="flex items-center gap-2 border-b border-[var(--border)] p-3">
          <div className="flex-1 max-w-xs">
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={searchPlaceholder}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/40 text-left text-xs font-medium uppercase tracking-wider text-[var(--fg-subtle)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn('whitespace-nowrap px-4 py-3', col.align === 'right' && 'text-right', col.align === 'center' && 'text-center')}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.sortable !== false ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        'inline-flex items-center gap-1 hover:text-[var(--fg)] transition-colors',
                        sort.key === col.key && 'text-[var(--fg)]'
                      )}
                    >
                      {col.header}
                      {sort.key === col.key ? (
                        sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              paged.map((row, idx) => (
                <tr
                  key={row[rowKey] ?? idx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-[var(--border)] last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-[var(--bg-muted)]/60'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3 align-middle', col.align === 'right' && 'text-right', col.align === 'center' && 'text-center', col.cellClassName)}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && sorted.length > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] p-3">
          <p className="text-xs text-[var(--fg-subtle)]">
            Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" disabled={safePage === 1} onClick={() => setPage(1)} aria-label="First page">
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-xs font-medium tabular-nums text-[var(--fg-muted)]">
              {safePage} / {totalPages}
            </span>
            <Button variant="ghost" size="icon-sm" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled={safePage === totalPages} onClick={() => setPage(totalPages)} aria-label="Last page">
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
