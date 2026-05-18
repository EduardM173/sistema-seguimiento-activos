import {
  EstadoNotificacion,
  TipoMovimientoActivo,
  TipoNotificacion,
} from '../generated/prisma/client';
import { AuditoriaService } from './auditoria.service';

describe('AuditoriaService notification inbox for HU32', () => {
  let service: AuditoriaService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      activo: {
        findUnique: jest.fn(),
      },
      movimientoActivo: {
        findMany: jest.fn(),
      },
      auditoria: {
        findMany: jest.fn(),
      },
      area: {
        findMany: jest.fn(),
      },
      notificacion: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new AuditoriaService(prisma);
  });

  it('returns notifications for the authenticated user with asset detail reference', async () => {
    prisma.area.findMany.mockResolvedValue([]);
    prisma.usuario.findUnique.mockResolvedValue({
      areaId: 'area-1',
      rol: {
        permisos: [{ permiso: { codigo: 'NOTIFICATION_VIEW' } }],
      },
    });

    prisma.notificacion.findMany.mockResolvedValue([
      {
        id: 'notif-1',
        usuarioId: 'user-1',
        areaId: 'area-1',
        materialId: null,
        tipo: TipoNotificacion.ALERTA_SISTEMA,
        titulo: 'Cambios en el activo ACT-001',
        mensaje:
          '[ASSET_ID:asset-1] El activo Laptop Dell asignado al área Sistemas fue actualizado. Estado: Operativo -> Mantenimiento',
        estado: EstadoNotificacion.NO_LEIDA,
        creadoEn: new Date('2026-04-23T10:00:00.000Z'),
        leidoEn: null,
        usuario: {
          id: 'user-1',
          nombres: 'Maria',
          apellidos: 'Responsable',
          correo: 'maria@demo.bo',
        },
        material: null,
      },
    ]);
    prisma.notificacion.count.mockResolvedValue(1);

    const result = await service.getNotifications('user-1', {
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        asunto: 'Cambios en el activo ACT-001',
        contenido:
          'El activo Laptop Dell asignado al área Sistemas fue actualizado. Estado: Operativo -> Mantenimiento',
        leida: false,
        referencias: {
          recursoTipo: 'activo',
          recursoId: 'asset-1',
        },
        accion: {
          label: 'Ver activo',
          url: '/activos/asset-1',
        },
      }),
    );
  });

  it('keeps notifications available until the user explicitly reviews them', async () => {
    prisma.area.findMany.mockResolvedValue([]);
    prisma.usuario.findUnique.mockResolvedValue({
      areaId: 'area-1',
      rol: {
        permisos: [{ permiso: { codigo: 'NOTIFICATION_VIEW' } }],
      },
    });

    prisma.notificacion.findMany.mockResolvedValue([
      {
        id: 'notif-1',
        usuarioId: 'user-1',
        areaId: 'area-1',
        materialId: null,
        tipo: TipoNotificacion.ALERTA_SISTEMA,
        titulo: 'Cambios en el activo ACT-001',
        mensaje: '[ASSET_ID:asset-1] Cambio detectado',
        estado: EstadoNotificacion.NO_LEIDA,
        creadoEn: new Date('2026-04-23T10:00:00.000Z'),
        leidoEn: null,
        usuario: null,
        material: null,
      },
    ]);
    prisma.notificacion.count.mockResolvedValue(1);
    prisma.notificacion.findFirst.mockResolvedValue({
      id: 'notif-1',
      estado: EstadoNotificacion.NO_LEIDA,
    });
    prisma.notificacion.update.mockResolvedValue({
      id: 'notif-1',
      estado: EstadoNotificacion.LEIDA,
    });

    const inbox = await service.getNotifications('user-1', {
      page: 1,
      pageSize: 20,
    });

    expect(inbox.data[0].leida).toBe(false);

    await service.markAsRead('user-1', 'notif-1');

    expect(prisma.notificacion.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: expect.objectContaining({
        estado: EstadoNotificacion.LEIDA,
      }),
    });
  });

  it('returns consolidated traceability for a selected asset', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      rol: {
        permisos: [{ permiso: { codigo: 'AUDIT_VIEW' } }],
      },
    });

    prisma.activo.findUnique.mockResolvedValue({
      id: 'asset-1',
      codigo: 'ACT-001',
      nombre: 'Laptop Dell',
      descripcion: 'Equipo institucional',
      estado: 'OPERATIVO',
      creadoEn: new Date('2026-05-01T09:00:00.000Z'),
      actualizadoEn: new Date('2026-05-10T12:00:00.000Z'),
      dadoDeBajaEn: null,
      motivoBaja: null,
      categoria: { id: 'cat-1', nombre: 'Laptop' },
      ubicacion: { id: 'ubi-1', nombre: 'Oficina Central' },
      areaActual: { id: 'area-2', nombre: 'Sistemas' },
      responsableActual: {
        id: 'user-2',
        nombres: 'Maria',
        apellidos: 'Responsable',
      },
    });

    prisma.movimientoActivo.findMany.mockResolvedValue([
      {
        id: 'mov-1',
        tipo: 'TRANSFERENCIA',
        areaOrigenId: 'area-1',
        areaDestinoId: 'area-2',
        usuarioOrigenId: null,
        usuarioDestinoId: null,
        asignacionId: 'asig-1',
        detalle: 'Transferencia registrada de Administración a Sistemas',
        creadoEn: new Date('2026-05-05T10:00:00.000Z'),
        realizadoPor: {
          id: 'user-1',
          nombres: 'Juan',
          apellidos: 'Operativo',
        },
      },
    ]);

    prisma.auditoria.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        accion: 'ACTUALIZACION',
        valoresAnteriores: { estado: 'OPERATIVO' },
        valoresNuevos: { estado: 'MANTENIMIENTO' },
        creadoEn: new Date('2026-05-06T08:30:00.000Z'),
        direccionIp: '127.0.0.1',
        userAgent: 'jest',
        usuario: {
          id: 'user-3',
          nombres: 'Ana',
          apellidos: 'Auditora',
        },
      },
    ]);

    prisma.area.findMany.mockResolvedValue([
      { id: 'area-1', nombre: 'Administración' },
      { id: 'area-2', nombre: 'Sistemas' },
    ]);
    prisma.usuario.findMany.mockResolvedValue([]);

    const result = await service.getAssetTraceability('auditor-1', 'asset-1');

    expect(result.activo).toEqual(
      expect.objectContaining({
        id: 'asset-1',
        codigo: 'ACT-001',
        nombre: 'Laptop Dell',
      }),
    );
    expect(result.resumen).toEqual({
      totalEventos: 2,
      totalMovimientos: 1,
      totalRegistrosAuditoria: 1,
      movimientosPorTipo: expect.objectContaining({
        [TipoMovimientoActivo.TRANSFERENCIA]: 1,
      }),
    });
    expect(result.movimientos).toHaveLength(1);
    expect(result.timeline).toHaveLength(2);
    expect(result.timeline[0]).toEqual(
      expect.objectContaining({
        fuente: 'MOVIMIENTO',
        etiqueta: 'Transferencia',
        areaOrigen: { id: 'area-1', nombre: 'Administración' },
        areaDestino: { id: 'area-2', nombre: 'Sistemas' },
      }),
    );
    expect(result.timeline[1]).toEqual(
      expect.objectContaining({
        fuente: 'AUDITORIA',
        etiqueta: 'ACTUALIZACION',
        auditoria: expect.objectContaining({
          valoresNuevos: { estado: 'MANTENIMIENTO' },
        }),
      }),
    );
  });

  it('unifies every registered asset movement type in the response', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      rol: {
        permisos: [{ permiso: { codigo: 'AUDIT_VIEW' } }],
      },
    });

    prisma.activo.findUnique.mockResolvedValue({
      id: 'asset-1',
      codigo: 'ACT-001',
      nombre: 'Laptop Dell',
      descripcion: null,
      estado: 'OPERATIVO',
      creadoEn: new Date('2026-05-01T09:00:00.000Z'),
      actualizadoEn: new Date('2026-05-10T12:00:00.000Z'),
      dadoDeBajaEn: null,
      motivoBaja: null,
      categoria: null,
      ubicacion: null,
      areaActual: null,
      responsableActual: null,
    });

    const movementTypes = [
      TipoMovimientoActivo.REGISTRO,
      TipoMovimientoActivo.ASIGNACION,
      TipoMovimientoActivo.TRANSFERENCIA,
      TipoMovimientoActivo.DEVOLUCION,
      TipoMovimientoActivo.BAJA,
      TipoMovimientoActivo.ACTUALIZACION,
    ];

    prisma.movimientoActivo.findMany.mockResolvedValue(
      movementTypes.map((tipo, index) => ({
        id: `mov-${index + 1}`,
        tipo,
        areaOrigenId: index === 2 ? 'area-1' : null,
        areaDestinoId: index === 2 ? 'area-2' : null,
        usuarioOrigenId: index === 1 ? 'user-1' : null,
        usuarioDestinoId: index === 1 ? 'user-2' : null,
        asignacionId: index === 1 ? 'asig-1' : null,
        detalle: `Movimiento ${tipo}`,
        creadoEn: new Date(`2026-05-0${index + 1}T10:00:00.000Z`),
        realizadoPor: {
          id: 'auditor-1',
          nombres: 'Ana',
          apellidos: 'Auditora',
        },
      })),
    );

    prisma.auditoria.findMany.mockResolvedValue([]);
    prisma.area.findMany.mockResolvedValue([
      { id: 'area-1', nombre: 'Administración' },
      { id: 'area-2', nombre: 'Sistemas' },
    ]);
    prisma.usuario.findMany.mockResolvedValue([
      { id: 'user-1', nombres: 'Carlos', apellidos: 'Origen' },
      { id: 'user-2', nombres: 'Maria', apellidos: 'Destino' },
    ]);

    const result = await service.getAssetTraceability('auditor-1', 'asset-1');

    expect(result.movimientos.map((movimiento) => movimiento.tipo)).toEqual(
      movementTypes,
    );
    expect(result.timeline.map((event) => event.tipo)).toEqual(movementTypes);
    expect(result.resumen.totalMovimientos).toBe(6);

    for (const tipo of movementTypes) {
      expect(result.resumen.movimientosPorTipo[tipo]).toBe(1);
    }

    expect(result.movimientos[1]).toEqual(
      expect.objectContaining({
        tipo: TipoMovimientoActivo.ASIGNACION,
        usuarioOrigen: {
          id: 'user-1',
          nombreCompleto: 'Carlos Origen',
        },
        usuarioDestino: {
          id: 'user-2',
          nombreCompleto: 'Maria Destino',
        },
      }),
    );
  });

  it('filters asset traceability by date range', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      rol: {
        permisos: [{ permiso: { codigo: 'AUDIT_VIEW' } }],
      },
    });

    prisma.activo.findUnique.mockResolvedValue({
      id: 'asset-1',
      codigo: 'ACT-001',
      nombre: 'Laptop Dell',
      descripcion: null,
      estado: 'OPERATIVO',
      creadoEn: new Date('2026-05-01T09:00:00.000Z'),
      actualizadoEn: new Date('2026-05-10T12:00:00.000Z'),
      dadoDeBajaEn: null,
      motivoBaja: null,
      categoria: null,
      ubicacion: null,
      areaActual: null,
      responsableActual: null,
    });

    prisma.movimientoActivo.findMany.mockResolvedValue([]);
    prisma.auditoria.findMany.mockResolvedValue([]);
    prisma.area.findMany.mockResolvedValue([]);
    prisma.usuario.findMany.mockResolvedValue([]);

    await service.getAssetTraceability('auditor-1', 'asset-1', {
      fechaDesde: '2026-05-03',
      fechaHasta: '2026-05-08',
    });

    expect(prisma.movimientoActivo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activoId: 'asset-1',
          creadoEn: {
            gte: new Date('2026-05-03T00:00:00.000Z'),
            lte: new Date('2026-05-08T23:59:59.999Z'),
          },
        }),
      }),
    );
    expect(prisma.auditoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entidadId: 'asset-1',
          creadoEn: {
            gte: new Date('2026-05-03T00:00:00.000Z'),
            lte: new Date('2026-05-08T23:59:59.999Z'),
          },
        }),
      }),
    );
  });

  it('rejects inverted date ranges for asset traceability', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      rol: {
        permisos: [{ permiso: { codigo: 'AUDIT_VIEW' } }],
      },
    });

    prisma.activo.findUnique.mockResolvedValue({
      id: 'asset-1',
      codigo: 'ACT-001',
      nombre: 'Laptop Dell',
      descripcion: null,
      estado: 'OPERATIVO',
      creadoEn: new Date('2026-05-01T09:00:00.000Z'),
      actualizadoEn: new Date('2026-05-10T12:00:00.000Z'),
      dadoDeBajaEn: null,
      motivoBaja: null,
      categoria: null,
      ubicacion: null,
      areaActual: null,
      responsableActual: null,
    });

    await expect(
      service.getAssetTraceability('auditor-1', 'asset-1', {
        fechaDesde: '2026-05-10',
        fechaHasta: '2026-05-01',
      }),
    ).rejects.toThrow('La fecha desde no puede ser posterior a la fecha hasta');

    expect(prisma.movimientoActivo.findMany).not.toHaveBeenCalled();
    expect(prisma.auditoria.findMany).not.toHaveBeenCalled();
  });
});
