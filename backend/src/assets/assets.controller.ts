import {
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
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

import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { SearchAssetsDto } from './dto/search-assets.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';
import { TransferAssetDto } from './dto/transfer-asset.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  /**
   * GET /api/assets
   * Paginated list with optional search and filters.
   *
   * Query params: q, estado, categoriaId, page, pageSize
   */
  @ApiOperation({
    summary: 'Listar activos con filtros',
    description: 'Obtiene una lista paginada de activos y permite filtrar por texto, estado, categoría y ubicación.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Texto libre para buscar por código, nombre, categoría, ubicación o responsable',
    example: 'laptop sistemas',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['OPERATIVO', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'],
    description: 'Filtra activos por estado operativo',
  })
  @ApiQuery({
    name: 'categoriaId',
    required: false,
    type: String,
    description: 'Filtra activos por categoría',
    example: 'cmnkly3gf000j2wl67vioxkws',
  })
  @ApiQuery({
    name: 'ubicacionId',
    required: false,
    type: String,
    description: 'Filtra activos por ubicación',
    example: 'cmnkly39f000d2wl6qbcilxb2',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['codigo', 'nombre', 'categoria', 'ubicacion', 'responsable', 'estado', 'creadoEn'],
    description: 'Campo por el cual ordenar el listado',
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Dirección de ordenación',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Cantidad de resultados por página',
    example: 10,
  })
  @ApiQuery({
    name: 'soloTransferibles',
    required: false,
    type: Boolean,
    description:
      'Cuando es true, devuelve solo activos disponibles para registrar una transferencia',
    example: true,
  })
  @ApiOkResponse({
    description: 'Listado paginado de activos obtenido correctamente',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'cm1activo123',
            codigo: 'ACT-001',
            nombre: 'Laptop Dell Latitude 5420',
            estado: 'OPERATIVO',
            estadoLabel: 'Operativo',
            categoria: { id: 'cm1cat123', nombre: 'Laptop' },
            ubicacion: { id: 'cm1ubi123', nombre: 'Oficina de Sistemas' },
            area: { id: 'cm1area123', nombre: 'Sistemas' },
            responsable: { id: 'cm1user123', nombreCompleto: 'Maria Operativa' },
          },
        ],
        meta: {
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Los filtros o parámetros de paginación enviados no son válidos',
  })
  @Get()
  async findAll(@Query() query: SearchAssetsDto) {
    const result = await this.assetsService.findAll(query);
    return ApiResponse.paginated(
      result.data,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * GET /api/assets/generate-code
   * Generate a unique asset code.
   */
  @ApiOperation({
    summary: 'Generar código único de activo',
    description: 'Genera un código único que no existe en la base de datos para asignar a un nuevo activo.',
  })
  @ApiOkResponse({
    description: 'Código único generado exitosamente',
    schema: {
      example: {
        success: true,
        message: 'Código generado exitosamente',
        data: {
          code: 'ACT-9F3D2A1B',
        },
      },
    },
  })
  @Get('generate-code')
  async generateCode() {
    const code = await this.assetsService.generateUniqueCode();
    return ApiResponse.success({ code }, 'Código generado exitosamente');
  }

  @ApiOperation({
    summary: 'Cargar activos demo rápidamente',
    description:
      'Genera una cantidad de activos ficticios para pruebas rápidas del listado y filtrado.',
  })
  @ApiQuery({
    name: 'count',
    required: false,
    type: Number,
    description: 'Cantidad de activos ficticios a insertar',
    example: 1000,
  })
  @ApiOkResponse({
    description: 'Activos ficticios insertados correctamente',
    schema: {
      example: {
        success: true,
        message: 'Se generaron 1000 activos ficticios correctamente',
        data: {
          inserted: 1000,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'La cantidad es inválida o faltan categorías/ubicaciones para generar activos demo',
  })
  @Post('dev/fake-bulk')
  async createFakeBulk(
    @Req() req: Request,
    @Query('count', new ParseIntPipe({ optional: true })) count?: number,
  ) {
    const userId = (req.user as { id: string }).id;
    const inserted = await this.assetsService.createFakeBulk(userId, count ?? 1000);
    return ApiResponse.success(
      { inserted },
      `Se generaron ${inserted} activos ficticios correctamente`,
    );
  }

  @ApiOperation({
    summary: 'Eliminar activos demo rápidamente',
    description:
      'Elimina únicamente los activos ficticios generados por la carga rápida demo.',
  })
  @ApiOkResponse({
    description: 'Activos ficticios eliminados correctamente',
    schema: {
      example: {
        success: true,
        message: 'Se eliminaron 1000 activos ficticios correctamente',
        data: {
          deleted: 1000,
        },
      },
    },
  })
  @Delete('dev/fake-bulk')
  async deleteFakeBulk() {
    const deleted = await this.assetsService.deleteFakeBulk();
    return ApiResponse.success(
      { deleted },
      `Se eliminaron ${deleted} activos ficticios correctamente`,
    );
  }

  /**
   * GET /api/assets/:id
   * Get single asset with full details.
   */
  @ApiOperation({
    summary: 'Obtener detalle de un activo',
    description: 'Recupera el detalle completo de un activo por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del activo' })
  @ApiOkResponse({
    description: 'Detalle del activo obtenido correctamente',
    schema: {
      example: {
        success: true,
        data: {
          id: 'cm1activo123',
          codigo: 'ACT-001',
          nombre: 'Laptop Dell Latitude 5420',
          descripcion: 'Equipo asignado al área de Sistemas',
          marca: 'Dell',
          modelo: 'Latitude 5420',
          numeroSerie: 'SN-5420-001',
          fechaAdquisicion: '2026-01-15T00:00:00.000Z',
          costoAdquisicion: '8200.00',
          vencimientoGarantia: '2028-01-15T00:00:00.000Z',
          estado: 'OPERATIVO',
          estadoLabel: 'Operativo',
          categoria: {
            id: 'cm1cat123',
            nombre: 'Laptop',
          },
          ubicacion: {
            id: 'cm1ubi123',
            nombre: 'Oficina de Sistemas',
          },
          area: {
            id: 'cm1area123',
            nombre: 'Sistemas',
          },
          responsable: {
            id: 'cm1user123',
            nombreCompleto: 'Maria Operativa',
          },
          responsableActual: {
            id: 'cm1user123',
            nombres: 'Maria',
            apellidos: 'Operativa',
            correo: 'maria@activos.bo',
            nombreCompleto: 'Maria Operativa',
          },
          areaActual: {
            id: 'cm1area123',
            nombre: 'Sistemas',
          },
          creadoPor: {
            id: 'cm1admin123',
            nombreCompleto: 'Admin General',
          },
          actualizadoPor: {
            id: 'cm1admin123',
            nombreCompleto: 'Admin General',
          },
          creadoEn: '2026-01-15T12:00:00.000Z',
          actualizadoEn: '2026-01-18T09:30:00.000Z',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Confirmar recepción de transferencia (HU41)' })
  @ApiParam({ name: 'asignacionId', description: 'ID de la asignación pendiente' })
  @ApiOkResponse({ description: 'Recepción confirmada correctamente' })
  @ApiConflictResponse({
    description: 'La recepción no está pendiente o el usuario no pertenece al área destino',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la asignación solicitada' })
  @Patch('asignaciones/:asignacionId/confirmar')
  async confirmarRecepcion(
    @Param('asignacionId') asignacionId: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id;
    const result = await this.assetsService.confirmarRecepcion(asignacionId, userId);
    return ApiResponse.success(result, result.message);
  }

  @ApiOperation({ summary: 'Rechazar recepción de transferencia (HU41)' })
  @ApiParam({ name: 'asignacionId', description: 'ID de la asignación pendiente' })
  @ApiOkResponse({ description: 'Recepción rechazada correctamente' })
  @ApiConflictResponse({
    description: 'La recepción no está pendiente o el usuario no pertenece al área destino',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la asignación solicitada' })
  @Patch('asignaciones/:asignacionId/rechazar')
  async rechazarRecepcion(
    @Param('asignacionId') asignacionId: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id;
    const result = await this.assetsService.rechazarRecepcion(asignacionId, userId);
    return ApiResponse.success(result, result.message);
  }

  @ApiNotFoundResponse({
    description: 'No se encontró el activo solicitado',
  })
  @ApiOperation({
    summary: 'Transferencias pendientes de recepción de un área',
    description:
      'HU41 – Devuelve los activos con recepción pendiente cuyo área de destino es el área indicada.',
  })
  @ApiQuery({
    name: 'areaId',
    required: true,
    type: String,
    description: 'ID del área de destino para filtrar las recepciones pendientes',
  })
  @ApiOkResponse({
    description: 'Listado de transferencias pendientes de recepción para el área',
  })
  @ApiBadRequestResponse({ description: 'El areaId enviado no es válido' })
  @Get('pendientes-recepcion')
  async pendientesDeRecepcion(@Query('areaId') areaId: string) {
    const data = await this.assetsService.pendientesDeRecepcion(areaId ?? '');
    return ApiResponse.success(data, 'Transferencias pendientes obtenidas correctamente');
  }

  @ApiOperation({
    summary: 'Solicitudes de transferencia enviadas por usuario (HU41)',
    description:
      'Lista transferencias pendientes registradas por el usuario. Puede filtrarse opcionalmente por área origen.',
  })
  @ApiQuery({
    name: 'registradoPorId',
    required: true,
    type: String,
    description: 'ID del usuario que registró la transferencia',
  })
  @ApiQuery({
    name: 'areaOrigenId',
    required: false,
    type: String,
    description: 'ID del área origen que envió la transferencia',
  })
  @ApiOkResponse({
    description: 'Listado de solicitudes enviadas pendientes',
  })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos' })
  @Get('solicitudes-enviadas')
  async solicitudesEnviadas(
    @Query('registradoPorId') registradoPorId: string,
    @Query('areaOrigenId') areaOrigenId?: string,
  ) {
    const data = await this.assetsService.solicitudesEnviadas(
      registradoPorId ?? '',
      areaOrigenId,
    );
    return ApiResponse.success(data, 'Solicitudes enviadas obtenidas correctamente');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const activo = await this.assetsService.findOne(id);
    return ApiResponse.success(activo);
  }

  /**
   * POST /api/assets
   * Create a new asset.
   */
  @ApiOperation({
    summary: 'Registrar activo',
    description: 'Crea un nuevo activo dentro del inventario institucional.',
  })
  @ApiBody({ type: CreateAssetDto })
  @ApiCreatedResponse({
    description: 'Activo registrado exitosamente',
    schema: {
      example: {
        success: true,
        message: 'Activo registrado exitosamente',
        data: {
          id: 'cm1activo123',
          codigo: 'ACT-9F3D2A1B',
          nombre: 'Laptop Dell Latitude 5420',
          categoriaId: 'cm1cat123',
          ubicacionId: 'cm1ubi123',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos para registrar el activo',
  })
  @ApiConflictResponse({
    description: 'Ya existe un activo con el mismo código o número de serie',
  })
  @Post()
  async create(@Body() dto: CreateAssetDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const activo = await this.assetsService.create(dto, userId);
    return ApiResponse.success(activo, 'Activo registrado exitosamente');
  }

  /**
   * PATCH /api/assets/:id
   * Update an existing asset (partial update).
   */
  @ApiOperation({
    summary: 'Actualizar activo',
    description: 'Actualiza parcialmente la información de un activo existente.',
  })
  @ApiParam({ name: 'id', description: 'ID del activo' })
  @ApiBody({ type: UpdateAssetDto })
  @ApiOkResponse({
    description: 'Activo actualizado exitosamente',
    schema: {
      example: {
        success: true,
        message: 'Activo actualizado exitosamente',
        data: {
          id: 'cm1activo123',
          codigo: 'ACT-9F3D2A1B',
          nombre: 'Laptop Dell Latitude 7430',
          estado: 'MANTENIMIENTO',
          categoria: { id: 'cm1cat123', nombre: 'Laptop' },
          ubicacion: { id: 'cm1ubi123', nombre: 'Oficina de Sistemas' },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos para actualizar el activo',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el activo solicitado',
  })
  @ApiConflictResponse({
    description: 'Ya existe un activo con el mismo código o número de serie',
  })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id;
    const activo = await this.assetsService.update(id, dto, userId);
    return ApiResponse.success(activo, 'Activo actualizado exitosamente');
  }

  /**
   * POST /api/assets/:id/assign
   * Assign an asset to a user or area.
   */
  @ApiOperation({
    summary: 'Asignar activo a un usuario o a un área',
    description:
      'Registra la asignación de un activo y actualiza su responsable o área actual.',
  })
  @ApiBody({
    type: AssignAssetDto,
    examples: {
      asignacionUsuario: {
        summary: 'Asignar a usuario',
        value: {
          usuarioAsignadoId: 'cm1usuario123',
          observaciones: 'Asignación para uso diario',
        },
      },
      asignacionArea: {
        summary: 'Asignar a área',
        value: {
          areaAsignadaId: 'cm1area123',
          observaciones: 'Activo bajo custodia del área',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Activo asignado exitosamente',
  })
  @ApiBadRequestResponse({
    description:
      'Solicitud inválida. Debe enviarse un usuario o un área, pero no ambos.',
  })
  @ApiNotFoundResponse({
    description: 'Activo, usuario o área no encontrado',
  })
  @ApiConflictResponse({
    description: 'El activo no puede asignarse en su estado actual',
  })
  @Post(':id/assign')
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignAssetDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id;
    const result = await this.assetsService.assign(id, dto, userId);
    return ApiResponse.success(result, 'Activo asignado exitosamente');
  }

  @ApiOperation({
    summary: 'Registrar transferencia de un activo entre áreas',
    description:
      'Crea la transferencia del activo, registra el movimiento y deja una recepción pendiente para el área de destino.',
  })
  @ApiParam({ name: 'id', description: 'ID del activo a transferir' })
  @ApiBody({
    type: TransferAssetDto,
    examples: {
      transferenciaArea: {
        summary: 'Transferencia entre áreas',
        value: {
          areaDestinoId: 'cm1area124',
          observaciones: 'Transferencia operativa entre áreas',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Transferencia registrada exitosamente',
  })
  @ApiBadRequestResponse({
    description:
      'Solicitud inválida. El activo no tiene área de origen o el área de destino coincide con la de origen.',
  })
  @ApiNotFoundResponse({
    description: 'Activo o área de destino no encontrado',
  })
  @ApiConflictResponse({
    description:
      'El activo no está operativo o ya tiene una recepción pendiente por una transferencia o asignación anterior.',
  })
  @Post(':id/transfer')
  async transfer(
    @Param('id') id: string,
    @Body() dto: TransferAssetDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id;
    const result = await this.assetsService.transfer(id, dto, userId);
    return ApiResponse.success(result, 'Transferencia registrada exitosamente');
  }

  /**
   * DELETE /api/assets/:id
   * Soft-delete (dar de baja) an asset.
   */
  @ApiOperation({
    summary: 'Dar de baja un activo',
    description: 'Realiza la baja lógica de un activo existente.',
  })
  @ApiParam({ name: 'id', description: 'ID del activo' })
  @ApiOkResponse({
    description: 'Activo dado de baja exitosamente',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el activo solicitado',
  })
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const activo = await this.assetsService.remove(id, userId);
    return ApiResponse.success(activo, 'Activo dado de baja exitosamente');
  }
}
