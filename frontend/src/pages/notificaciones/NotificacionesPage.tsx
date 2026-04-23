import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, DataTable, SearchBar } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import auditoriaService from '../../services/auditoria.service';
import { HttpError } from '../../services/http.client';
import type { Notificacion } from '../../types/auditoria.types';
import '../../styles/modules.css';
import '../../styles/notifications.css';

export const NotificacionesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{
    type: 'info' | 'error';
    text: string;
  } | null>(null);

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
      render: (_value: string, row: Notificacion) => {
        const detailUrl = getNotificationDetailUrl(row);

        if (!detailUrl) {
          return <span className="notifications-table__muted">Sin acceso directo</span>;
        }

        return (
          <Button
            label="Ver activo"
            size="sm"
            variant="secondary"
            className="notifications-table__action"
            onClick={() => navigate(detailUrl)}
          />
        );
      },
    },
  ];

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
    </div>
  );
};

export default NotificacionesPage;
