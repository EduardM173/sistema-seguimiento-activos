/**
 * Deeplink Engine — Application-wide definitions.
 *
 * Single source of truth for the navigable surface of this frontend. Importing
 * this module registers every page/modal in the global `deeplinkRegistry`.
 *
 * Adding a new page or modal? Add an entry here and the engine, the navigation
 * map JSON, and any AI integration will pick it up automatically.
 */

import { deeplinkRegistry } from './registry';
import type { DeeplinkPageDefinition } from './types';

const PAGES: DeeplinkPageDefinition[] = [
  /* ---------------------------------------------------------------- public */
  {
    id: 'login',
    path: '/',
    title: 'Iniciar sesión',
    description: 'Pantalla de autenticación. Único punto de entrada público.',
    tags: ['auth', 'public'],
  },

  /* --------------------------------------------------------------- private */
  {
    id: 'dashboard',
    path: '/dashboard',
    title: 'Dashboard',
    description: 'Panel principal con resumen de la operación.',
    tags: ['home'],
    relatedPages: ['activos', 'inventario', 'transferencias', 'notificaciones'],
  },

  /* ----------------------------------------------------------- activos */
  {
    id: 'activos',
    path: '/activos',
    title: 'Activos',
    description:
      'Listado de activos físicos. Permite filtrar, crear, editar, asignar, dar de baja y consultar el detalle de cada activo.',
    requiredPermission: 'ASSET_VIEW',
    tags: ['inventory', 'assets'],
    params: [
      { name: 'q', type: 'string', in: 'query', description: 'Texto libre de búsqueda.' },
      { name: 'estado', type: 'enum', in: 'query', enumValues: ['OPERATIVO', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'] },
      { name: 'categoriaId', type: 'string', in: 'query' },
      { name: 'ubicacionId', type: 'string', in: 'query' },
      { name: 'page', type: 'number', in: 'query' },
    ],
    actions: [
      { id: 'refresh', title: 'Refrescar listado' },
      { id: 'export', title: 'Exportar listado' },
      { id: 'createFakeAssets', title: 'Generar activos de prueba', requiredPermission: 'ASSET_CREATE' },
      { id: 'deleteFakeAssets', title: 'Eliminar activos de prueba', requiredPermission: 'ASSET_CREATE' },
    ],
    modals: [
      {
        id: 'create-asset',
        title: 'Crear activo',
        description: 'Formulario para registrar un nuevo activo.',
        requiredPermission: 'ASSET_CREATE',
      },
      {
        id: 'view-asset',
        title: 'Ver activo',
        description: 'Detalle de un activo en panel modal.',
        params: [{ name: 'assetId', type: 'string', in: 'query', required: true }],
      },
      {
        id: 'edit-asset',
        title: 'Editar activo',
        description: 'Edición de los datos básicos de un activo.',
        requiredPermission: 'ASSET_UPDATE',
        params: [{ name: 'assetId', type: 'string', in: 'query', required: true }],
      },
      {
        id: 'assign-asset',
        title: 'Asignar activo',
        description: 'Asignar el activo a un usuario o área.',
        requiredPermission: 'ASSET_ASSIGN',
        params: [
          { name: 'assetId', type: 'string', in: 'query', required: true },
          { name: 'tipo', type: 'enum', in: 'query', enumValues: ['usuario', 'area'] },
        ],
      },
      {
        id: 'baja-asset',
        title: 'Dar de baja',
        description: 'Registrar la baja de un activo con un motivo.',
        requiredPermission: 'ASSET_UPDATE',
        params: [{ name: 'assetId', type: 'string', in: 'query', required: true }],
      },
      {
        id: 'asset-history',
        title: 'Historial de transferencias',
        description: 'Línea de tiempo de transferencias del activo.',
        params: [{ name: 'assetId', type: 'string', in: 'query', required: true }],
      },
    ],
    relatedPages: ['asset-detail', 'asset-history', 'transferencias'],
  },
  {
    id: 'asset-detail',
    path: '/activos/:id',
    title: 'Detalle de activo',
    description: 'Vista completa de un activo individual.',
    requiredPermission: 'ASSET_VIEW',
    tags: ['assets'],
    params: [{ name: 'id', type: 'string', in: 'path', required: true }],
    relatedPages: ['activos', 'asset-history'],
  },
  {
    id: 'asset-history',
    path: '/activos/:id/historial',
    title: 'Historial del activo',
    description: 'Historial completo de transferencias y eventos del activo.',
    requiredPermission: 'ASSET_VIEW',
    tags: ['assets', 'history'],
    params: [{ name: 'id', type: 'string', in: 'path', required: true }],
    relatedPages: ['asset-detail', 'activos'],
  },

  /* ---------------------------------------------------------- inventario */
  {
    id: 'inventario',
    path: '/inventario',
    title: 'Inventario',
    description:
      'Gestión de materiales/insumos: alta, ingresos, salidas, ajustes y consulta de historial de movimientos.',
    requiredPermission: 'INVENTORY_MANAGE',
    tags: ['inventory', 'stock'],
    params: [
      { name: 'q', type: 'string', in: 'query' },
      { name: 'categoriaId', type: 'string', in: 'query' },
      { name: 'estado', type: 'enum', in: 'query', enumValues: ['CRITICO', 'NORMAL'] },
      { name: 'page', type: 'number', in: 'query' },
    ],
    modals: [
      {
        id: 'material-form',
        title: 'Crear / editar material',
        description: 'Formulario de alta o edición de un material.',
        requiredPermission: 'INVENTORY_MANAGE',
        params: [{ name: 'materialId', type: 'string', in: 'query' }],
      },
      {
        id: 'ingreso-stock',
        title: 'Registrar ingreso de stock',
        requiredPermission: 'INVENTORY_MANAGE',
      },
      {
        id: 'salida-stock',
        title: 'Registrar salida de stock',
        requiredPermission: 'INVENTORY_MANAGE',
      },
      {
        id: 'ajuste-inventario',
        title: 'Ajuste de inventario',
        requiredPermission: 'INVENTORY_MANAGE',
      },
      {
        id: 'historial-material',
        title: 'Historial de movimientos',
        params: [{ name: 'materialId', type: 'string', in: 'query', required: true }],
      },
    ],
    actions: [
      { id: 'createDemoData', title: 'Crear datos demo', requiredPermission: 'INVENTORY_MANAGE' },
      { id: 'deleteDemoData', title: 'Borrar datos demo', requiredPermission: 'INVENTORY_MANAGE' },
    ],
  },

  /* ------------------------------------------------------ transferencias */
  {
    id: 'transferencias',
    path: '/transferencias',
    title: 'Transferencias',
    description:
      'Gestión de transferencias entre áreas/usuarios. Permite aprobar, rechazar y consultar pendientes (HU42).',
    requiredPermission: 'TRANSFER_MANAGE',
    tags: ['transfers'],
    modals: [
      {
        id: 'rechazar-transferencia',
        title: 'Rechazar transferencia',
        description: 'Diálogo para registrar el motivo del rechazo (HU42 PA2).',
        params: [{ name: 'transferenciaId', type: 'string', in: 'query', required: true }],
      },
    ],
    relatedPages: ['recepciones', 'activos'],
  },
  {
    id: 'recepciones',
    path: '/transferencias/recepciones',
    title: 'Recepciones',
    description: 'Pendientes de recepción para el responsable de área destino (HU21).',
    requiredPermission: 'ASSET_VIEW',
    tags: ['transfers', 'receptions'],
    modals: [
      {
        id: 'rechazar-recepcion',
        title: 'Rechazar recepción',
        description: 'Diálogo con motivo obligatorio para rechazar una recepción.',
        params: [{ name: 'recepcionId', type: 'string', in: 'query', required: true }],
      },
    ],
    relatedPages: ['transferencias'],
  },

  /* ------------------------------------------------------------- ubicaciones */
  {
    id: 'locations',
    path: '/locations',
    title: 'Ubicaciones',
    description: 'Gestión de ubicaciones físicas.',
    requiredPermission: 'ASSET_VIEW',
    tags: ['catalogs', 'locations'],
    modals: [
      {
        id: 'create-location',
        title: 'Crear ubicación',
        requiredPermission: 'ASSET_VIEW',
      },
    ],
  },

  /* ------------------------------------------------------------- usuarios */
  {
    id: 'users',
    path: '/users',
    title: 'Usuarios',
    description: 'Administración de usuarios del sistema.',
    requiredPermission: 'USER_MANAGE',
    tags: ['admin', 'users'],
    modals: [
      {
        id: 'create-user',
        title: 'Crear usuario',
        requiredPermission: 'USER_MANAGE',
      },
      {
        id: 'edit-user',
        title: 'Editar usuario',
        requiredPermission: 'USER_MANAGE',
        params: [{ name: 'userId', type: 'string', in: 'query', required: true }],
      },
    ],
  },

  /* ----------------------------------------------------------- reportes */
  {
    id: 'reportes',
    path: '/reportes',
    title: 'Reportes',
    description: 'Generación y consulta de reportes operacionales.',
    requiredPermission: 'REPORT_VIEW',
    tags: ['reports'],
  },

  /* ---------------------------------------------------------- auditoría */
  {
    id: 'auditoria',
    path: '/auditoria',
    title: 'Auditoría',
    description: 'Bitácora de auditoría del sistema.',
    requiredPermission: 'AUDIT_VIEW',
    tags: ['audit'],
  },

  /* ------------------------------------------------------ notificaciones */
  {
    id: 'notificaciones',
    path: '/notificaciones',
    title: 'Notificaciones',
    description: 'Centro de notificaciones del usuario.',
    requiredPermission: 'NOTIFICATION_VIEW',
    tags: ['notifications'],
    modals: [
      {
        id: 'view-notification',
        title: 'Ver notificación',
        params: [{ name: 'notificationId', type: 'string', in: 'query', required: true }],
      },
      {
        id: 'view-asset',
        title: 'Ver activo (desde notificación)',
        params: [{ name: 'assetId', type: 'string', in: 'query', required: true }],
      },
    ],
  },
];

let registered = false;

/**
 * Idempotently registers all page/modal definitions in the global registry.
 * Safe to call multiple times (e.g. from HMR).
 */
export function registerAppDeeplinks(): void {
  if (registered) return;
  deeplinkRegistry.registerPages(PAGES);
  registered = true;
}

// Auto-register on import. The provider also calls this defensively.
registerAppDeeplinks();
