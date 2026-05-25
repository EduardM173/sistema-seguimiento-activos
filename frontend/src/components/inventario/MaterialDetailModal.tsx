import React from 'react';
import { Modal, Badge } from '../common';
import type { Material } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import { ImageGallery } from '../common/ImageGallery';
import '../../styles/modules.css';

interface MaterialDetailModalProps {
  material: Material | null;
  onClose: () => void;
  /** When provided the user may delete / upload images */
  canEdit?: boolean;
}

export const MaterialDetailModal: React.FC<MaterialDetailModalProps> = ({
  material,
  onClose,
  canEdit = false,
}) => {
  if (!material) return null;

  const stockBajo = material.stockActual <= material.stockMinimo;

  return (
    <Modal
      isOpen={!!material}
      title={material.nombre}
      onClose={onClose}
      size="lg"
    >
      <div className="detail-grid" style={{ gap: '20px' }}>

        {/* ── Info general ── */}
        <div className="detail-section">
          <h3>Información General</h3>
          <div className="detail-row">
            <span className="label">Código:</span>
            <span className="value">{material.codigo}</span>
          </div>
          <div className="detail-row">
            <span className="label">Nombre:</span>
            <span className="value">{material.nombre}</span>
          </div>
          {material.descripcion && (
            <div className="detail-row">
              <span className="label">Descripción:</span>
              <span className="value">{material.descripcion}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="label">Unidad:</span>
            <span className="value">{material.unidad}</span>
          </div>
          {material.categoria && (
            <div className="detail-row">
              <span className="label">Categoría:</span>
              <span className="value">{material.categoria.nombre}</span>
            </div>
          )}
        </div>

        {/* ── Stock ── */}
        <div className="detail-section">
          <h3>Stock</h3>
          <div className="detail-row">
            <span className="label">Stock actual:</span>
            <span className="value" style={{ color: stockBajo ? 'var(--color-danger)' : 'inherit', fontWeight: stockBajo ? 600 : undefined }}>
              {material.stockActual} {material.unidad}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Stock mínimo:</span>
            <span className="value">{material.stockMinimo} {material.unidad}</span>
          </div>
          <div className="detail-row">
            <span className="label">Estado:</span>
            <Badge
              label={stockBajo ? 'Stock bajo' : 'Normal'}
              variant={stockBajo ? 'danger' : 'success'}
            />
          </div>
        </div>

        {/* ── Imágenes ── */}
        <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
          <h3>Imágenes</h3>
          <ImageGallery
            entityId={material.id}
            onLoad={(id) => inventarioService.listarImagenes(id)}
            onDelete={canEdit ? (id, imgId) => inventarioService.eliminarImagen(id, imgId) : undefined}
            onUpload={canEdit ? (id, files) => inventarioService.subirImagenes(id, files) : undefined}
          />
        </div>

      </div>
    </Modal>
  );
};

export default MaterialDetailModal;
