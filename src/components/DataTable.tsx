import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  label: string
  value: (row: T) => string | number | null
  render?: (row: T) => ReactNode
  align?: 'left' | 'center' | 'right'
  width?: number
  className?: (row: T) => string
  sortable?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  initialSort?: { key: string; desc: boolean }
  searchPlaceholder?: string
  searchText?: (row: T) => string
  maxHeight?: number
  emptyText?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  searchPlaceholder = '搜索姓名…',
  searchText,
  maxHeight = 560,
  emptyText = '暂无数据',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null)
  const [desc, setDesc] = useState(initialSort?.desc ?? true)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const keyword = query.trim()
    if (!keyword) return rows
    return rows.filter((row) => {
      const text = searchText ? searchText(row) : columns.map((column) => column.value(row) ?? '').join(' ')
      return String(text).toLowerCase().includes(keyword.toLowerCase())
    })
  }, [rows, query, searchText, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const column = columns.find((item) => item.key === sortKey)
    if (!column) return filtered
    const list = [...filtered]
    list.sort((a, b) => {
      const va = column.value(a)
      const vb = column.value(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return desc ? vb - va : va - vb
      return desc ? String(vb).localeCompare(String(va), 'zh-CN') : String(va).localeCompare(String(vb), 'zh-CN')
    })
    return list
  }, [filtered, sortKey, desc, columns])

  const toggleSort = (key: string) => {
    if (key === sortKey) {
      setDesc((value) => !value)
    } else {
      setSortKey(key)
      setDesc(true)
    }
  }

  return (
    <div className="data-table">
      <div className="table-toolbar">
        <span className="table-count">共 {filtered.length} 条</span>
        <input
          className="table-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>
      <div className="table-scroll" style={{ maxHeight }}>
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width, textAlign: column.align ?? 'center' }}
                  onClick={() => toggleSort(column.key)}
                  className={sortKey === column.key ? 'sorted' : ''}
                >
                  {column.label}
                  {sortKey === column.key ? <span className="sort-mark">{desc ? '▾' : '▴'}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-cell">
                  {emptyText}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      style={{ textAlign: column.align ?? 'center' }}
                      className={column.className ? column.className(row) : undefined}
                    >
                      {column.render ? column.render(row) : (column.value(row) ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
