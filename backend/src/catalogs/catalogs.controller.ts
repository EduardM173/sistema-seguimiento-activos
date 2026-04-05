import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiResponse as SwaggerApiResponse,
} from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';
import { EstadoDto } from './dto/estado.dto';

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

  // ========== ENDPOINT PARA ESTADOS DE ACTIVOS (PROSIN-182 y PROSIN-183) ==========
  @ApiOperation({
    summary: 'Obtener estados de activos',
    description: 'Retorna la lista de estados disponibles para los activos según el enum del sistema',
  })
  @ApiOkResponse({
    description: 'Lista de estados obtenida exitosamente',
    type: [EstadoDto],
  })
  @ApiQuery({
    name: 'incluirDadosDeBaja',
    required: false,
    type: Boolean,
    description: 'Si es true, incluye el estado DADO_DE_BAJA en la respuesta. Por defecto: false',
  })
  @Get('estados')
  async getEstadosActivos(
    @Query('incluirDadosDeBaja') incluirDadosDeBaja?: string,
  ) {
    // Estados según el enum EstadoActivo del schema Prisma
    let estados = [
      { valor: 'OPERATIVO', label: 'Operativo', descripcion: 'Activo funcionando correctamente' },
      { valor: 'MANTENIMIENTO', label: 'En mantenimiento', descripcion: 'Activo en proceso de mantenimiento' },
      { valor: 'FUERA_DE_SERVICIO', label: 'Fuera de servicio', descripcion: 'Activo no disponible temporalmente' },
      { valor: 'DADO_DE_BAJA', label: 'Dado de baja', descripcion: 'Activo retirado del inventario' },
    ];

    // Filtrar DADO_DE_BAJA si no se pide explícitamente
    const incluirBaja = incluirDadosDeBaja === 'true' || incluirDadosDeBaja === '1';
    if (!incluirBaja) {
      estados = estados.filter(e => e.valor !== 'DADO_DE_BAJA');
    }

    return ApiResponse.success(estados);
  }
}