import { Controller, Get, UseGuards } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';

@Controller('catalogs')
@UseGuards(JwtAuthGuard)
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get('categorias')
  async getCategorias() {
    const data = await this.catalogsService.findAllCategorias();
    return ApiResponse.success(data);
  }

  @Get('ubicaciones')
  async getUbicaciones() {
    const data = await this.catalogsService.findAllUbicaciones();
    return ApiResponse.success(data);
  }

  @Get('areas')
  async getAreas() {
    const data = await this.catalogsService.findAllAreas();
    return ApiResponse.success(data);
  }

  @Get('usuarios')
  async getUsuarios() {
    const data = await this.catalogsService.findAllUsuarios();
    return ApiResponse.success(
      data.map((u) => ({
        id: u.id,
        nombres: u.nombres,
        apellidos: u.apellidos,
        nombreCompleto: `${u.nombres} ${u.apellidos}`,
        correo: u.correo,
        area: u.area,
      })),
    );
  }
}
