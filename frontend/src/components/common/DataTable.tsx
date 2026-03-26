import React from 'react';
import '../../styles/components.css';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => any);
  width?: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  error?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  paginated?: boolean;
  pageSize?: number;
  striped?: boolean;
  hover?: boolean;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  error,
  onRowClick,
  emptyMessage = 'No hay datos disponibles',
  paginated = false,
  pageSize = 10,
  striped = true,
  hover = true,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortConfig, setSortConfig] = React.useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const paginatedData = React.useMemo(() => {
    if (!paginated) return data;
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize, paginated]);

  const totalPages = Math.ceil(data.length / pageSize);

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;
    const key = typeof column.accessor === 'string' ? column.accessor : '';
    if (sortConfig?.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setSortConfig({ key, direction: 'asc' });
    }
  };

  const getCellValue = (row: T, column: Column<T>) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor];
  };

  if (error) {
    return <div className="table-error">Error: {error}</div>;
  }

  if (loading) {
    return <div className="table-loading">Cargando datos...</div>;
  }

  if (data.length === 0) {
    return <div className="table-empty">{emptyMessage}</div>;
  }

  return (
    <div className="table-container">
      <table className={`data-table ${striped ? 'table-striped' : ''} ${hover ? 'table-hover' : ''}`}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                style={{ width: column.width }}
                onClick={() => handleSort(column)}
                className={column.sortable ? 'sortable' : ''}
              >
                {column.header}
                {column.sortable && sortConfig?.key === (typeof column.accessor === 'string' ? column.accessor : '') && (
                  <span className={`sort-indicator ${sortConfig.direction}`}>
                    {sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, rowIndex) => (
            <tr
              key={row.id || rowIndex}
              className={onRowClick ? 'clickable' : ''}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column, colIndex) => (
                <td key={colIndex}>
                  {column.render
                    ? column.render(getCellValue(row, column), row)
                    : getCellValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      {paginated && totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </button>
          <span className="pagination-info">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

export default DataTable;
