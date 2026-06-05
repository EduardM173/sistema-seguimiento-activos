import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, q = '') {
    await this.assertUserHasPermission(userId, 'SUPPLIER_MANAGE');

    const query = q.trim();
    return this.prisma.proveedor.findMany({
      where: query
        ? {
            OR: [
              { nombre: { contains: query, mode: 'insensitive' } },
              { nit: { contains: query, mode: 'insensitive' } },
              { rubro: { contains: query, mode: 'insensitive' } },
              { contacto: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { creadoEn: 'desc' },
      take: 100,
    });
  }

  async create(userId: string, dto: CreateSupplierDto) {
    await this.assertUserHasPermission(userId, 'SUPPLIER_MANAGE');

    const nit = this.clean(dto.nit);
    if (nit) {
      const existing = await this.prisma.proveedor.findUnique({
        where: { nit },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException('Ya existe un proveedor con ese NIT');
      }
    }

    return this.prisma.proveedor.create({
      data: {
        nombre: dto.nombre.trim(),
        nit,
        contacto: this.clean(dto.contacto),
        telefono: this.clean(dto.telefono),
        correo: this.clean(dto.correo),
        direccion: this.clean(dto.direccion),
        rubro: this.clean(dto.rubro),
        observaciones: this.clean(dto.observaciones),
      },
    });
  }

  private clean(value?: string) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private async assertUserHasPermission(userId: string, permissionCode: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        rol: {
          select: {
            permisos: {
              where: { permiso: { codigo: permissionCode } },
              select: { permisoId: true },
            },
          },
        },
      },
    });

    if (!usuario?.rol.permisos.length) {
      throw new ForbiddenException('No tienes permiso para registrar proveedores');
    }
  }
}
