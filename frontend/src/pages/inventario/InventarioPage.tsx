import React, { useState, useEffect } from 'react';
import { DataTable, Button, Badge } from '../../components/common';
import type { Material } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import MaterialForm from '../../components/inventario/MaterialForm';
import { useNotification } from '../../context/NotificationContext';
import '../../styles/modules.css';
import IngresoStockModal from '../../components/inventario/IngresoStockModal';

export const InventarioPage: React.FC = () => {
  const notify = useNotification();
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'error'; text: string } | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isIngresoModalOpen, setIsIngresoModalOpen] = useState(false);

  useEffect(() => {
    cargarMateriales();
  }, [refreshKey]);

  const cargarMateriales = async () => {
    try {
      setLoading(true);
      const resultado = await inventarioService.obtenerTodos({ take: 1000 });
      setMateriales(resultado.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar inventario' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialCreated = async () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleEdit = (material: Material) => {
    setMaterialToEdit(material);
    setIsMaterialModalOpen(true);
  };

  const handleDelete = async (material: Material) => {
    if (confirm(`¿Está seguro de eliminar el material "${material.nombre}"?`)) {
      try {
        await inventarioService.eliminar(material.id);
        notify.success('Material eliminado correctamente');
        setRefreshKey(prev => prev + 1);
      } catch (err) {
        notify.error('Error', 'No se pudo eliminar el material');
      }
    }
  };

  const handleCloseModal = () => {
    setIsMaterialModalOpen(false);
    setMaterialToEdit(null);
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
      header: 'Disponible',
      accessor: (row: Material) => row.stockActual,
      render: (value: number, row: Material) => (
        <strong style={{ color: getStockColor(row.stockActual, row.stockMinimo) }}>
          {value.toFixed(2)}
        </strong>
      ),
    },
    {
      header: 'Mínimo',
      accessor: 'stockMinimo' as keyof Material,
      render: (value: number) => value.toFixed(2),
    },
    { header: 'Un. Medida', accessor: 'unidad' as keyof Material, width: '100px' },
    {
      header: 'Estado',
      accessor: (row: Material) => row,
      render: (row: Material) => {
        const status = getStockStatus(row.stockActual, row.stockMinimo);
        return <Badge label={status.label} variant={status.variant} size="sm" />;
      },
    },
    {
      header: 'Acciones',
      accessor: (row: Material) => row.id,
      render: (_id: string, row: Material) => (
        <div className="actions-group" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-action btn-edit"
            onClick={() => handleEdit(row)}
            title="Editar"
            style={{
              cursor: 'pointer',
              padding: '4px 8px',
              background: '#e0e7ff',
              borderRadius: '4px',
              border: 'none',
            }}
          >
            ✏️ Editar
          </button>
          <button
            className="btn-action btn-delete"
            onClick={() => handleDelete(row)}
            title="Eliminar"
            style={{
              cursor: 'pointer',
              padding: '4px 8px',
              background: '#fee2e2',
              borderRadius: '4px',
              border: 'none',
              color: '#dc2626',
            }}
          >
            🗑️ Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Gestión de Inventario</h1>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            label="+ Nuevo Material"
            variant="primary"
            onClick={() => {
              setMaterialToEdit(null);
              setIsMaterialModalOpen(true);
            }}
          />

          <Button
            label="+ Registrar ingreso"
            variant="primary"
            onClick={() => {
              setIsIngresoModalOpen(true);
            }}
          />
        </div>
      </div>

      {message && (
        <div style={{ marginBottom: '12px', color: '#dc2626' }}>
          {message.text}
        </div>
      )}

      <div className="module-list">
        <DataTable<Material>
          columns={columns}
          data={materiales}
          loading={loading}
          emptyMessage="📦 No hay materiales registrados en el inventario"
          striped
          hover
        />
      </div>

      <MaterialForm
        isOpen={isMaterialModalOpen}
        onClose={handleCloseModal}
        onCreated={handleMaterialCreated}
        materialToEdit={materialToEdit}
      />

      <IngresoStockModal
        isOpen={isIngresoModalOpen}
        onClose={() => setIsIngresoModalOpen(false)}
        materiales={materiales}
        onSuccess={handleMaterialCreated}
      />
    </div>
  );
};

export default InventarioPage;