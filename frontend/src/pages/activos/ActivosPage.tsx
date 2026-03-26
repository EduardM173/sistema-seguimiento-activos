import React, { useState } from 'react';
import { Button, Alert } from '../../components/common';
import ActivosList from '../../components/activos/ActivosList';
import ActivoForm from '../../components/activos/ActivoForm';
import ActivoDetail from '../../components/activos/ActivoDetail';
import type { Activo } from '../../types/activos.types';
import { activosService } from '../../services/activos.service';
import '../../styles/modules.css';

export const ActivosPage: React.FC = () => {
  const [formIsOpen, setFormIsOpen] = useState(false);
  const [selectedActivo, setSelectedActivo] = useState<Activo | undefined>();
  const [detailIsOpen, setDetailIsOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
        setMessage({ type: 'success', text: 'Activo eliminado exitosamente' });
        setRefreshKey((prev) => prev + 1);
      } catch (err) {
        setMessage({ type: 'error', text: 'Error al eliminar el activo' });
      }
    }
  };

  const handleFormSubmit = () => {
    setMessage({
      type: 'success',
      text: selectedActivo ? 'Activo actualizado exitosamente' : 'Activo creado exitosamente',
    });
    setRefreshKey((prev) => prev + 1);
    setFormIsOpen(false);
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Gestión de Activos</h1>
        <Button label="+ Nuevo Activo" variant="primary" onClick={handleNewActivo} />
      </div>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      )}

      <ActivosList
        key={refreshKey}
        onDetails={handleDetailsActivo}
        onEdit={handleEditActivo}
        onDelete={handleDeleteActivo}
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
        />
      )}
    </div>
  );
};

export default ActivosPage;
