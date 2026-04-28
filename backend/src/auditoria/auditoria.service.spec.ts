import { EstadoNotificacion, TipoNotificacion } from '../generated/prisma/client';
import { AuditoriaService } from './auditoria.service';

describe('AuditoriaService notification inbox for HU32', () => {
  let service: AuditoriaService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
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
    prisma.usuario.findUnique
      .mockResolvedValueOnce({
        rol: {
          permisos: [{ permiso: { codigo: 'NOTIFICATION_VIEW' } }],
        },
      })
      .mockResolvedValueOnce({
        areaId: 'area-1',
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
    prisma.usuario.findUnique
      .mockResolvedValueOnce({
        rol: {
          permisos: [{ permiso: { codigo: 'NOTIFICATION_VIEW' } }],
        },
      })
      .mockResolvedValueOnce({
        areaId: 'area-1',
      })
      .mockResolvedValueOnce({
        rol: {
          permisos: [{ permiso: { codigo: 'NOTIFICATION_VIEW' } }],
        },
      })
      .mockResolvedValueOnce({
        areaId: 'area-1',
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
});
