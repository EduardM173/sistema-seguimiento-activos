import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';
import { EstadoDto } from './dto/estado.dto';

@ApiTags('Catálogos')
@Controller('catalogs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get('categorias')
  @ApiOperation({ summary: 'Obtener categorías de activos' })
  @SwaggerApiResponse({ status: 200, description: 'Lista de categorías' })
  async getCategorias() {
    const data = await this.catalogsService.findAllCategorias();
    return ApiResponse.success(data);
  }

  @Get('ubicaciones')
  @ApiOperation({ summary: 'Obtener ubicaciones' })
  @SwaggerApiResponse({ status: 200, description: 'Lista de ubicaciones' })
  async getUbicaciones() {
    const data = await this.catalogsService.findAllUbicaciones();
    return ApiResponse.success(data);
  }

  @Get('areas')
  @ApiOperation({ summary: 'Obtener áreas' })
  @SwaggerApiResponse({ status: 200, description: 'Lista de áreas' })
  async getAreas() {
    const data = await this.catalogsService.findAllAreas();
    return ApiResponse.success(data);
  }

  @Get('usuarios')
  @ApiOperation({ summary: 'Obtener usuarios' })
  @SwaggerApiResponse({ status: 200, description: 'Lista de usuarios' })
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
  @Get('estados')
  @ApiOperation({
    summary: 'Obtener estados de activos',
    description: 'Retorna la lista de estados disponibles para los activos según el enum del sistema'
  })
  @ApiQuery({
    name: 'incluirDadosDeBaja',
    required: false,
    type: Boolean,
    description: 'Si es true, incluye el estado DADO_DE_BAJA en la respuesta. Por defecto: false'
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Lista de estados obtenida exitosamente',
    type: [EstadoDto]
  })
  @SwaggerApiResponse({ status: 401, description: 'No autorizado - Se requiere token JWT' })
  @SwaggerApiResponse({ status: 500, description: 'Error interno del servidor' })
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