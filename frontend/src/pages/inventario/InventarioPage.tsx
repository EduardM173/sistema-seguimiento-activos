import React, { useState, useEffect } from 'react';
import { DataTable, SearchBar, Button, Badge, Alert } from '../../components/common';
import type { Material } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import MaterialForm from '../../components/inventario/MaterialForm';
import { useNotification } from '../../context/NotificationContext';
import '../../styles/modules.css';

export const InventarioPage: React.FC = () => {
  const notify = useNotification();
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'error'; text: string } | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

  useEffect(() => {
    cargarMateriales();
  }, []);

  const cargarMateriales = async () => {
    try {
      setLoading(true);
      const resultado = await inventarioService.obtenerTodos({ take: 1000 }); // Mostrar todos
      setMateriales(resultado.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar inventario' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialCreated = async () => {
    await cargarMateriales();
    notify.success('Material registrado correctamente');
  };

  const columns = [
    { header: 'Código', accessor: 'codigo' as keyof Material, width: '100px' },
    { header: 'Nombre', accessor: 'nombre' as keyof Material },
    { header: 'Categoría', accessor: (row: Material) => row.categoria?.nombre || 'N/A' },
    {
      header: 'Disponible',
      accessor: (row: Material) => row.stockActual,
      render: (value: number) => <strong>{value.toFixed(2)}</strong>,
    },
    { header: 'Mínimo', accessor: 'stockMinimo' as keyof Material, render: (value: number) => value.toFixed(2) },
    { header: 'Un. Medida', accessor: 'unidad' as keyof Material, width: '100px' },
    {
      header: 'Estado',
      accessor: (row: Material) => row.stockActual < row.stockMinimo,
      render: (value: boolean) => (
        <Badge label={value ? 'CRÍTICO' : 'Normal'} variant={value ? 'danger' : 'success'} size="sm" />
      ),
    },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Gestión de Inventario</h1>
        <Button
          label="+ Nuevo Material"
          variant="primary"
          onClick={() => setIsMaterialModalOpen(true)}
        />
      </div>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      )}

      <div className="module-list">
        <DataTable<Material>
          columns={columns}
          data={materiales}
          loading={loading}
          emptyMessage="No hay materiales registrados"
          striped
          hover
        />
      </div>

      <MaterialForm
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        onCreated={handleMaterialCreated}
      />
    </div>
  );
};

export default InventarioPage;
