import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { SearchLocationsDto } from './dto/search-location.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   * GET /api/locations
   * Paginated list with optional search by pattern (string similarity on nombre).
   */
  @ApiOperation({
    summary: 'Buscar ubicaciones',
    description:
      'Obtiene una lista paginada de ubicaciones. Permite filtrar por patrón de nombre (similitud de texto), edificio, piso y ambiente.',
  })
  @ApiQuery({ name: 'pattern', required: false, description: 'Patrón de búsqueda por similitud sobre el nombre de la ubicación' })
  @ApiQuery({ name: 'edificio', required: false, description: 'Filtrar por edificio' })
  @ApiQuery({ name: 'piso', required: false, description: 'Filtrar por piso' })
  @ApiQuery({ name: 'ambiente', required: false, description: 'Filtrar por ambiente' })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Registros por página' })
  @ApiOkResponse({ description: 'Listado paginado de ubicaciones obtenido correctamente' })
  @ApiBadRequestResponse({ description: 'Parámetros de búsqueda inválidos' })
  @Get()
  async findAll(@Query() query: SearchLocationsDto) {
    const result = await this.locationsService.findAll(query);
    return ApiResponse.paginated(
      result.data,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * GET /api/locations/:id
   * Get a single location by ID.
   */
  @ApiOperation({
    summary: 'Obtener detalle de una ubicación',
    description: 'Recupera la información completa de una ubicación por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la ubicación' })
  @ApiOkResponse({ description: 'Ubicación obtenida correctamente' })
  @ApiNotFoundResponse({ description: 'No se encontró la ubicación solicitada' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const ubicacion = await this.locationsService.findOne(id);
    return ApiResponse.success(ubicacion);
  }

  /**
   * POST /api/locations
   * Create a new location.
   */
  @ApiOperation({
    summary: 'Registrar ubicación',
    description: 'Crea una nueva ubicación en el sistema.',
  })
  @ApiBody({ type: CreateLocationDto })
  @ApiCreatedResponse({ description: 'Ubicación registrada exitosamente' })
  @ApiBadRequestResponse({ description: 'Datos inválidos para registrar la ubicación' })
  @ApiConflictResponse({ description: 'Ya existe una ubicación con la misma combinación nombre/edificio/piso/ambiente' })
  @Post()
  async create(@Body() dto: CreateLocationDto) {
    const ubicacion = await this.locationsService.create(dto);
    return ApiResponse.success(ubicacion, 'Ubicación registrada exitosamente');
  }

  /**
   * PATCH /api/locations/:id
   * Update an existing location.
   */
  @ApiOperation({
    summary: 'Actualizar ubicación',
    description: 'Actualiza parcialmente la información de una ubicación existente.',
  })
  @ApiParam({ name: 'id', description: 'ID de la ubicación' })
  @ApiBody({ type: UpdateLocationDto })
  @ApiOkResponse({ description: 'Ubicación actualizada exitosamente' })
  @ApiBadRequestResponse({ description: 'Datos inválidos para actualizar la ubicación' })
  @ApiNotFoundResponse({ description: 'No se encontró la ubicación solicitada' })
  @ApiConflictResponse({ description: 'Ya existe otra ubicación con la misma combinación nombre/edificio/piso/ambiente' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    const ubicacion = await this.locationsService.update(id, dto);
    return ApiResponse.success(ubicacion, 'Ubicación actualizada exitosamente');
  }

  /**
   * DELETE /api/locations/:id
   * Delete a location.
   */
  @ApiOperation({
    summary: 'Eliminar ubicación',
    description: 'Elimina una ubicación del sistema. No se puede eliminar si tiene activos o áreas asignadas.',
  })
  @ApiParam({ name: 'id', description: 'ID de la ubicación' })
  @ApiOkResponse({ description: 'Ubicación eliminada exitosamente' })
  @ApiNotFoundResponse({ description: 'No se encontró la ubicación solicitada' })
  @ApiConflictResponse({ description: 'No se puede eliminar porque tiene activos o áreas asociadas' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.locationsService.remove(id);
    return ApiResponse.success(null, 'Ubicación eliminada exitosamente');
  }
}
