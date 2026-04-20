import React, { useState, useEffect } from 'react';
import { DataTable, Badge } from '../../components/common';
import type { Material } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import { useAuth } from '../../context/AuthContext';
import '../../styles/modules.css';

export const InventarioAreaPage: React.FC = () => {
  const { user } = useAuth();
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    cargarMateriales();
  }, [refreshKey, searchText]);

  const cargarMateriales = async () => {
    try {
      setLoading(true);
      // Obtener materiales filtrados por área del usuario
      const resultado = await inventarioService.obtenerMaterialesPorArea({
        q: searchText || undefined,
      });
      setMateriales(resultado.data);
    } catch (err) {
      console.error('Error al cargar materiales del área:', err);
      setMateriales([]);
    } finally {
      setLoading(false);
    }
  };

  const getStockColor = (stockActual: number, stockMinimo: number): string => {
    if (stockActual <= 0) return '#dc2626';
    if (stockActual < stockMinimo) return '#dc2626';
    return '#10b981';
  };

  const getStockStatus = (
    stockActual: number,
    stockMinimo: number
  ): { label: string; variant: 'danger' | 'warning' | 'success' } => {
    if (stockActual <= 0) return { label: 'SIN STOCK', variant: 'danger' };
    if (stockActual < stockMinimo) return { label: 'CRÍTICO', variant: 'danger' };
    return { label: 'NORMAL', variant: 'success' };
  };

  const columns = [
    { header: 'Código', accessor: 'codigo' as keyof Material, width: '100px' },
    { header: 'Nombre', accessor: 'nombre' as keyof Material },
    { header: 'Categoría', accessor: (row: Material) => row.categoria?.nombre || 'N/A' },
    {
      header: 'Cantidad Disponible',
      accessor: (row: Material) => row.stockActual,
      render: (value: number, row: Material) => (
        <strong style={{ color: getStockColor(row.stockActual, row.stockMinimo) }}>
          {value.toFixed(2)} {row.unidad}
        </strong>
      ),
    },
    {
      header: 'Estado',
      accessor: (row: Material) => row,
      render: (row: Material) => {
        const status = getStockStatus(row.stockActual, row.stockMinimo);
        return <Badge label={status.label} variant={status.variant} size="sm" />;
      },
    },
  ];

  // Obtener nombre del área del usuario
  const areaNombre = user?.area?.nombre || user?.area || 'tu área';

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Inventario por Departamento</h1>
        <p style={{ color: '#6b7280', marginTop: '4px' }}>
          Materiales y recursos asignados a <strong>{areaNombre}</strong>
        </p>
      </div>

      {/* Buscador - PROSIN-270 y PROSIN-275 */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '16px',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '250px', flex: 2 }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
            Buscar por nombre o código
          </label>
          <input
            type="text"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setRefreshKey(prev => prev + 1);
            }}
            placeholder="Ej: cartucho, MAT-001..."
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
          />
        </div>
      </div>

      <div className="module-list">
        <DataTable<Material>
          columns={columns}
          data={materiales}
          loading={loading}
          emptyMessage="📦 No hay materiales registrados en tu departamento"
          striped
          hover
        />
      </div>

      {/* Información de cantidad */}
      {!loading && materiales.length > 0 && (
        <div style={{ marginTop: '12px', color: '#6b7280', fontSize: '14px' }}>
          Mostrando <strong>{materiales.length}</strong> material(es) de {areaNombre}
        </div>
      )}
    </div>
  );
};

export default InventarioAreaPage;