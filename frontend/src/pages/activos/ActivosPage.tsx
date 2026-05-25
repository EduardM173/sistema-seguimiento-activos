import React, { useState } from 'react';
import { Button } from '../../components/common';
import ActivosList from '../../components/activos/ActivosList';
import ActivoForm from '../../components/activos/ActivoForm';
import ActivoDetail from '../../components/activos/ActivoDetail';
import type { Activo } from '../../types/activos.types';
import { activosService } from '../../services/activos.service';
import { useNotification } from '../../context/NotificationContext';
import '../../styles/modules.css';

export const ActivosPage: React.FC = () => {
  const notify = useNotification();
  const [formIsOpen, setFormIsOpen] = useState(false);
  const [selectedActivo, setSelectedActivo] = useState<Activo | undefined>();
  const [detailIsOpen, setDetailIsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNewActivo = () => {
    setSelectedActivo(undefined);
    setFormIsOpen(true);
  };

  const handleEditActivo = (activo: Activo) => {
    setSelectedActivo(activo);
    setFormIsOpen(true);
  };

  const handleDetailsActivo = (activo: Activo) => {
    setSelectedActivo(activo);
    setDetailIsOpen(true);
  };

  const handleDeleteActivo = async (activo: Activo) => {
    if (window.confirm(`¿Está seguro de que desea eliminar el activo "${activo.nombre}"?`)) {
      try {
        await activosService.eliminar(activo.id);
        notify.success('Activo eliminado exitosamente');
        setRefreshKey((prev) => prev + 1);
      } catch (err) {
        notify.error('Error al eliminar el activo');
      }
    }
  };

  const handleBajaSuccess = () => {
    notify.success('Activo dado de baja exitosamente');
    setRefreshKey((prev) => prev + 1);
    setDetailIsOpen(false);
  };

  const handleFormSubmit = () => {
    notify.success(selectedActivo ? 'Activo actualizado exitosamente' : 'Activo creado exitosamente');
    setRefreshKey((prev) => prev + 1);
    setFormIsOpen(false);
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Gestión de Activos</h1>
        <Button label="+ Nuevo Activo" variant="primary" onClick={handleNewActivo} />
      </div>

      <ActivosList
        key={refreshKey}
        onDetails={handleDetailsActivo}
        onEdit={handleEditActivo}
        onDelete={handleDeleteActivo}
        onBaja={handleBajaSuccess}
      />

      <ActivoForm
        activo={selectedActivo}
        isOpen={formIsOpen}
        onClose={() => setFormIsOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {selectedActivo && detailIsOpen && (
        <ActivoDetail
          activoId={selectedActivo.id}
          onClose={() => setDetailIsOpen(false)}
          onEdit={() => {
            setDetailIsOpen(false);
            setFormIsOpen(true);
          }}
          onBajaSuccess={handleBajaSuccess}
        />
      )}
    </div>
  );
};

export default ActivosPage;