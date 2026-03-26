import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class CatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllCategorias() {
    return this.prisma.categoriaActivo.findMany({
      select: { id: true, nombre: true, descripcion: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async findAllUbicaciones() {
    return this.prisma.ubicacion.findMany({
      select: {
        id: true,
        nombre: true,
        edificio: true,
        piso: true,
        ambiente: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findAllAreas() {
    return this.prisma.area.findMany({
      select: { id: true, nombre: true, descripcion: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async findAllUsuarios() {
    return this.prisma.usuario.findMany({
      where: { estado: 'ACTIVO' },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        area: { select: { id: true, nombre: true } },
      },
      orderBy: { apellidos: 'asc' },
    });
  }
}
