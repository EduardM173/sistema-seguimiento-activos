import { useState, useEffect } from 'react';
import { getMaterials, type Material } from '../../services/inventory.service';
import { SmartTable } from '../common/SmartTable';
import type { ColumnDef } from '../common/SmartTable';
import '../../styles/inventory.css';
import '../../styles/assets.css';

export default function MaterialsList() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setLoading(true);
        setError('');
        
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        if (!token) {
          throw new Error('No hay token de autenticación');
        }

        console.log('Cargando materiales desde:', import.meta.env.VITE_API_URL || 'http://localhost:10000');
        const data = await getMaterials(token);
        console.log('Materiales cargados:', data);
        setMaterials(data || []);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error al cargar materiales';
        console.error('Error completo:', errorMsg, err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadMaterials();
  }, []);

  if (error) {
    return (
      <div className="materials-list">
        <div className="error-message" style={{ 
          background: 'var(--color-danger-light)', 
          color: 'var(--color-danger)', 
          padding: '1rem',
          border: '1px solid var(--color-danger-border)',
        }}>
          <strong>Error:</strong> {error}
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
            Asegúrate de que el backend está corriendo en puerto 10000 y que hay datos en la tabla CategoriaMaterial.
          </p>
        </div>
      </div>
    );
  }

  const columns: ColumnDef<Material>[] = [
    { id: 'codigo',      header: 'Código',       accessor: 'codigo',       primary: true, width: 120, sortable: true },
    { id: 'nombre',      header: 'Nombre',        accessor: 'nombre',       width: 200,    sortable: true },
    { id: 'categoria',   header: 'Categoría',     accessor: (m) => m.categoria?.nombre ?? '-', width: 160 },
    { id: 'unidad',      header: 'Unidad',        accessor: 'unidad',       width: 100 },
    {
      id: 'stockActual',
      header: 'Stock Actual',
      accessor: 'stockActual',
      width: 120,
      sortable: true,
      render: (v, row) => {
        const actual = Number(v);
        const min = Number(row.stockMinimo);
        return (
          <span style={{ color: actual < min ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>
            {actual.toFixed(2)}
          </span>
        );
      },
    },
    {
      id: 'stockMinimo',
      header: 'Stock Mínimo',
      accessor: 'stockMinimo',
      width: 120,
      render: (v) => Number(v).toFixed(2),
    },
    {
      id: 'estado',
      header: 'Estado',
      accessor: (m) => Number(m.stockActual) < Number(m.stockMinimo) ? 'Bajo Stock' : 'Normal',
      width: 110,
      render: (v) => {
        const isBelowMin = v === 'Bajo Stock';
        return (
          <span className={`statusBadge ${isBelowMin ? 'statusBadge--fuera' : 'statusBadge--activo'}`}>
            {v as string}
          </span>
        );
      },
    },
  ];

  return (
    <div className="assetsTable__wrap">
      <SmartTable<Material>
        columns={columns}
        data={materials}
        loading={loading}
        keyExtractor={(m) => m.id}
        emptyMessage="No hay materiales registrados aún"
      />
    </div>
  );
}
