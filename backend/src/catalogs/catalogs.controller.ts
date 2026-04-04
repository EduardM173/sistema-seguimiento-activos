import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';

@ApiTags('catalogs')
@ApiBearerAuth()
@Controller('catalogs')
@UseGuards(JwtAuthGuard)
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @ApiOperation({
    summary: 'Listar categorías de activos',
    description: 'Obtiene el catálogo de categorías usado por los filtros y formularios de activos.',
  })
  @ApiOkResponse({ description: 'Categorías obtenidas correctamente' })
  @Get('categorias')
  async getCategorias() {
    const data = await this.catalogsService.findAllCategorias();
    return ApiResponse.success(data);
  }

  @ApiOperation({
    summary: 'Listar ubicaciones',
    description: 'Obtiene el catálogo de ubicaciones usado por los filtros y formularios de activos.',
  })
  @ApiOkResponse({ description: 'Ubicaciones obtenidas correctamente' })
  @Get('ubicaciones')
  async getUbicaciones() {
    const data = await this.catalogsService.findAllUbicaciones();
    return ApiResponse.success(data);
  }

  @ApiOperation({
    summary: 'Listar áreas',
    description: 'Obtiene el catálogo de áreas activas para formularios y asignaciones.',
  })
  @ApiOkResponse({ description: 'Áreas obtenidas correctamente' })
  @Get('areas')
  async getAreas() {
    const data = await this.catalogsService.findAllAreas();
    return ApiResponse.success(data);
  }

  @ApiOperation({
    summary: 'Listar usuarios activos',
    description: 'Obtiene usuarios activos para selección en filtros, formularios y asignaciones.',
  })
  @ApiOkResponse({ description: 'Usuarios activos obtenidos correctamente' })
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
