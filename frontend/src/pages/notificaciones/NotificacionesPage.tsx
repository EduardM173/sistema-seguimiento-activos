import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, DataTable, SearchBar } from '../../components/common';
import OverlayModal from '../../components/common/OverlayModal';
import ViewAssetModal from '../../components/activos/ViewAssetModal';
import { useAuth } from '../../context/AuthContext';
import auditoriaService from '../../services/auditoria.service';
import { HttpError } from '../../services/http.client';
import type { Notificacion } from '../../types/auditoria.types';
import '../../styles/modules.css';
import '../../styles/notifications.css';

export const NotificacionesPage: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{
    type: 'info' | 'error';
    text: string;
  } | null>(null);
  const [processingNotificationId, setProcessingNotificationId] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<Notificacion | null>(null);
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null);

  async function loadNotifications() {
    try {
      setLoading(true);
      setMessage(null);
      const response = await auditoriaService.obtenerMisNotificaciones({
        leidas: onlyUnread ? false : undefined,
        page: 1,
        pageSize: 100,
      });
      setNotifications(response.data ?? []);
    } catch (error) {
      console.error(error);
      setNotifications([]);
      setMessage({
        type: 'error',
        text:
          error instanceof HttpError
            ? error.message
            : 'No se pudieron cargar las notificaciones en este momento.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, [onlyUnread]);

  const filteredNotifications = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) {
      return notifications;
    }

    return notifications.filter((notification) =>
      `${notification.asunto} ${notification.contenido} ${notification.tipo}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [notifications, search]);

  const unreadCount = notifications.filter((item) => !item.leida).length;
  const areaName = user?.area?.nombre ?? 'Área no asignada';

  function getTypeVariant(tipo: Notificacion['tipo']) {
    switch (tipo) {
      case 'transferencia_pendiente':
        return 'warning';
      case 'activo_mantenimiento':
        return 'danger';
      case 'stock_critico':
        return 'warning';
      case 'aprobacion_requerida':
        return 'info';
      case 'auditoria_pendiente':
        return 'secondary';
      default:
        return 'primary';
    }
  }

  function getTypeLabel(tipo: Notificacion['tipo']) {
    switch (tipo) {
      case 'transferencia_pendiente':
        return 'Transferencia pendiente';
      case 'activo_mantenimiento':
        return 'Activo en mantenimiento';
      case 'stock_critico':
        return 'Stock crítico';
      case 'aprobacion_requerida':
        return 'Aprobación requerida';
      case 'auditoria_pendiente':
        return 'Auditoría pendiente';
      default:
        return 'Sistema';
    }
  }

  function getNotificationDetailUrl(notification: Notificacion) {
    if (notification.accion?.url) {
      return notification.accion.url;
    }

    const resourceType = notification.referencias?.recursoTipo?.toLowerCase();
    const resourceId = notification.referencias?.recursoId;

    if (!resourceId) {
      return null;
    }

    if (
      resourceType === 'activo' ||
      resourceType === 'activos' ||
      resourceType === 'asset' ||
      resourceType === 'assets'
    ) {
      return `/activos/${resourceId}`;
    }

    return null;
  }

  async function handleOpenNotification(notification: Notificacion) {
    try {
      setProcessingNotificationId(notification.id);

      if (!notification.leida) {
        await auditoriaService.marcarLeida(notification.id);

        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  leida: true,
                  fechaLectura: new Date(),
                }
              : item,
          ),
        );

        notification = {
          ...notification,
          leida: true,
          fechaLectura: new Date(),
        };
      }

      setSelectedNotification(notification);
    } catch (error) {
      console.error(error);
      setMessage({
        type: 'error',
        text:
          error instanceof HttpError
            ? error.message
            : 'No se pudo abrir la notificación en este momento.',
      });
    } finally {
      setProcessingNotificationId(null);
    }
  }

  const columns = [
    {
      header: 'Tipo',
      accessor: 'tipo' as const,
      render: (value: Notificacion['tipo']) => (
        <Badge
          label={getTypeLabel(value)}
          variant={getTypeVariant(value)}
          size="sm"
        />
      ),
    },
    {
      header: 'Asunto',
      accessor: 'asunto' as const,
      render: (value: string, row: Notificacion) => (
        <div className="notifications-table__subject">
          <strong>{value}</strong>
          <span>{row.contenido}</span>
        </div>
      ),
    },
    {
      header: 'Estado',
      accessor: 'leida' as const,
      render: (value: boolean) => (
        <Badge
          label={value ? 'Leída' : 'No leída'}
          variant={value ? 'secondary' : 'primary'}
          size="sm"
        />
      ),
    },
    {
      header: 'Fecha',
      accessor: 'fechaCreacion' as const,
      render: (value: Date | string) =>
        new Date(value).toLocaleString('es-BO', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
    },
    {
      header: 'Detalle',
      accessor: 'id' as const,
      render: (_value: string, row: Notificacion) => (
        <Button
          label={
            processingNotificationId === row.id
              ? 'Abriendo...'
              : 'Abrir'
          }
          size="sm"
          variant="secondary"
          className="notifications-table__action"
          onClick={() => void handleOpenNotification(row)}
        />
      ),
    },
  ];

  const selectedNotificationAssetId =
    selectedNotification?.referencias?.recursoId &&
    ['activo', 'activos', 'asset', 'assets'].includes(
      selectedNotification.referencias?.recursoTipo?.toLowerCase?.() ?? '',
    )
      ? selectedNotification.referencias.recursoId
      : null;

  return (
    <div className="module-page notifications-page">
      <div className="module-header">
        <div>
          <h1>Bandeja de Notificaciones</h1>
          <p>
            Revise los cambios y movimientos relevantes de los activos asignados a su área.
          </p>
        </div>
        <Button
          label="Actualizar"
          variant="secondary"
          onClick={() => void loadNotifications()}
        />
      </div>

      <div className="notifications-summary">
        <div className="notifications-summary__card">
          <span className="notifications-summary__label">Área responsable</span>
          <strong>{areaName}</strong>
        </div>
        <div className="notifications-summary__card">
          <span className="notifications-summary__label">No leídas</span>
          <strong>{unreadCount}</strong>
        </div>
        <div className="notifications-summary__card">
          <span className="notifications-summary__label">Total en bandeja</span>
          <strong>{notifications.length}</strong>
        </div>
      </div>

      {!user?.area ? (
        <Alert
          type="info"
          message="Tu usuario aún no tiene un área asignada. La bandeja quedará disponible, pero no podrá contextualizar notificaciones por área."
        />
      ) : null}

      {message ? (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      ) : null}

      <div className="module-list">
        <div className="list-header notifications-toolbar">
          <SearchBar
            onSearch={setSearch}
            placeholder="Buscar por asunto, contenido o tipo..."
          />
          <div className="notifications-toolbar__actions">
            <Button
              label="Todas"
              size="sm"
              variant={onlyUnread ? 'secondary' : 'primary'}
              onClick={() => setOnlyUnread(false)}
            />
            <Button
              label="Solo no leídas"
              size="sm"
              variant={onlyUnread ? 'primary' : 'secondary'}
              onClick={() => setOnlyUnread(true)}
            />
          </div>
        </div>

        <DataTable<Notificacion>
          columns={columns}
          data={filteredNotifications}
          loading={loading}
          emptyMessage="No hay notificaciones disponibles para esta área."
          paginated
          pageSize={10}
          striped
          hover
        />
      </div>

      <OverlayModal
        open={Boolean(selectedNotification)}
        onClose={() => setSelectedNotification(null)}
        title={selectedNotification?.asunto ?? 'Notificación'}
        subtitle={
          selectedNotification
            ? new Date(selectedNotification.fechaCreacion).toLocaleString('es-BO', {
                dateStyle: 'short',
                timeStyle: 'short',
              })
            : undefined
        }
        width="720px"
      >
        {selectedNotification ? (
          <div className="notificationPreview">
            <div className="notificationPreview__meta">
              <Badge
                label={getTypeLabel(selectedNotification.tipo)}
                variant={getTypeVariant(selectedNotification.tipo)}
                size="sm"
              />
              <Badge
                label={selectedNotification.leida ? 'Leída' : 'No leída'}
                variant={selectedNotification.leida ? 'secondary' : 'primary'}
                size="sm"
              />
            </div>

            <div className="notificationPreview__body">
              <p>{selectedNotification.contenido}</p>
            </div>

            <div className="notificationPreview__context">
              <div className="notificationPreview__contextItem">
                <span className="notificationPreview__label">Tipo</span>
                <strong>{getTypeLabel(selectedNotification.tipo)}</strong>
              </div>
              <div className="notificationPreview__contextItem">
                <span className="notificationPreview__label">Fecha</span>
                <strong>
                  {new Date(selectedNotification.fechaCreacion).toLocaleString('es-BO', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </strong>
              </div>
              <div className="notificationPreview__contextItem">
                <span className="notificationPreview__label">Recurso</span>
                <strong>
                  {selectedNotification.referencias?.recursoTipo ?? 'No identificado'}
                </strong>
              </div>
            </div>

            <div className="notificationPreview__actions">
              {selectedNotificationAssetId ? (
                <Button
                  label="Ver detalle del activo"
                  size="sm"
                  variant="primary"
                  onClick={() => setDetailAssetId(selectedNotificationAssetId)}
                />
              ) : (
                <span className="notifications-table__muted">
                  Esta notificación no tiene un activo asociado para abrir.
                </span>
              )}
            </div>
          </div>
        ) : null}
      </OverlayModal>

      {detailAssetId ? (
        <ViewAssetModal
          assetId={detailAssetId}
          open={Boolean(detailAssetId)}
          onClose={() => setDetailAssetId(null)}
        />
      ) : null}
    </div>
  );
};

export default NotificacionesPage;
