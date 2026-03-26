import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Controller('material-categories')
export class MaterialCategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    return this.prisma.categoriaMaterial.findMany({
      select: {
        id: true,
        nombre: true,
        descripcion: true,
      },
    });
  }
}
