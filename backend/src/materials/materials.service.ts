import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  async create(createMaterialDto: CreateMaterialDto) {
    return this.prisma.material.create({
      data: {
        codigo: createMaterialDto.codigo,
        nombre: createMaterialDto.nombre,
        descripcion: createMaterialDto.descripcion,
        unidad: createMaterialDto.unidad,
        stockActual: createMaterialDto.stockActual,
        stockMinimo: createMaterialDto.stockMinimo,
        categoriaId: createMaterialDto.categoriaId,
      },
    });
  }

  async findAll() {
    return this.prisma.material.findMany({
      include: {
        categoria: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.material.findUnique({
      where: { id },
      include: {
        categoria: true,
      },
    });
  }
}
