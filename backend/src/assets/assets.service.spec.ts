import { EstadoActivo, EstadoNotificacion, TipoNotificacion } from '../generated/prisma/client';
import { AssetsService } from './assets.service';

describe('AssetsService notifications for HU32', () => {
  let service: AssetsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      activo: {
        findUnique: jest.fn(),
      },
      area: {
        findUnique: jest.fn(),
      },
      asignacionActivo: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new AssetsService(prisma);
  });

  it('creates a notification when an assigned asset changes state', async () => {
    const notificationCreate = jest.fn();
    const assetUpdate = jest.fn().mockResolvedValue({
      id: 'asset-1',
      codigo: 'ACT-001',
      nombre: 'Laptop Dell',
      estado: EstadoActivo.MANTENIMIENTO,
      categoria: null,
      ubicacion: null,
      areaActual: { id: 'area-1', nombre: 'Sistemas' },
    });

    prisma.activo.findUnique.mockImplementation(({ where }: { where: Record<string, string> }) => {
      if (where.id === 'asset-1') {
        return Promise.resolve({
          id: 'asset-1',
          codigo: 'ACT-001',
          nombre: 'Laptop Dell',
          estado: EstadoActivo.OPERATIVO,
          categoriaId: 'cat-1',
          ubicacionId: null,
          areaActualId: 'area-1',
          responsableActualId: null,
          numeroSerie: null,
        });
      }

      return Promise.resolve(null);
    });

    prisma.area.findUnique.mockResolvedValue({
      id: 'area-1',
      nombre: 'Sistemas',
      encargadoId: 'user-1',
    });
    prisma.asignacionActivo.findFirst.mockResolvedValue(null);

    prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        activo: {
          update: assetUpdate,
        },
        notificacion: {
          create: notificationCreate,
        },
        movimientoActivo: {
          create: jest.fn(),
        },
      }),
    );

    await service.update(
      'asset-1',
      {
        estado: EstadoActivo.MANTENIMIENTO,
      } as any,
      'admin-1',
    );

    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: 'user-1',
        areaId: 'area-1',
        tipo: TipoNotificacion.ALERTA_SISTEMA,
        titulo: 'Cambios en el activo ACT-001',
        estado: EstadoNotificacion.NO_LEIDA,
        mensaje: expect.stringContaining('[ASSET_ID:asset-1]'),
      }),
    });

    expect(notificationCreate.mock.calls[0][0].data.mensaje).toContain(
      'Estado: Operativo -> Mantenimiento',
    );
    expect(notificationCreate.mock.calls[0][0].data.mensaje).toContain(
      'El activo Laptop Dell asignado al área Sistemas fue actualizado.',
    );
  });
});
