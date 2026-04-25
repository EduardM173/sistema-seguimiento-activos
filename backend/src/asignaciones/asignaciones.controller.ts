import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AsignacionesService } from './asignaciones.service';
import { ConfirmarRecepcionDTO, RechazarRecepcionDTO } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('asignaciones')
@ApiBearerAuth()
@Controller('asignaciones')
@UseGuards(JwtAuthGuard)
export class AsignacionesController {
  constructor(private readonly asignacionesService: AsignacionesService) {}

  /**
   * GET /asignaciones/pendientes/area
   * Obtener asignaciones pendientes del área del usuario autenticado
   */
  @Get('pendientes/area')
  @ApiOperation({
    summary: 'Obtener asignaciones pendientes por área',
    description: 'Retorna las asignaciones pendientes del área del usuario autenticado',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Tamaño de página' })
  @ApiResponse({ status: 200, description: 'Lista de asignaciones pendientes' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findPendientesByArea(
    @Request() req,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const usuarioId = req.user?.id;
    const areaId = req.user?.areaId;

    if (!areaId) {
      throw new ForbiddenException('El usuario no tiene un área asignada');
    }

    return this.asignacionesService.findPendientesByArea(
      areaId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 100,
    );
  }

  /**
   * POST /asignaciones/:id/recibir
   * Confirmar recepción de activo
   */
  @Post(':id/recibir')
  @ApiOperation({
    summary: 'Confirmar recepción de activo',
    description: 'Registra la recepción de un activo por parte del responsable del área',
  })
  @ApiParam({ name: 'id', description: 'ID de la asignación' })
  @ApiResponse({ status: 200, description: 'Recepción confirmada correctamente' })
  @ApiResponse({ status: 400, description: 'La asignación ya fue procesada' })
  @ApiResponse({ status: 403, description: 'No autorizado para esta acción' })
  @ApiResponse({ status: 404, description: 'Asignación no encontrada' })
  async confirmarRecepcion(
    @Param('id') id: string,
    @Body() data: ConfirmarRecepcionDTO,
    @Request() req,
  ) {
    const usuarioId = req.user?.id;
    const areaId = req.user?.areaId;

    // Verificar que el usuario es responsable del área
    const esResponsable = await this.asignacionesService.verificarResponsableArea(
      usuarioId,
      areaId,
    );

    if (!esResponsable) {
      throw new ForbiddenException(
        'No tiene permisos para confirmar recepciones de esta área',
      );
    }

    return this.asignacionesService.confirmarRecepcion(id, usuarioId, data);
  }

  /**
   * POST /asignaciones/:id/rechazar
   * Rechazar recepción de activo
   */
  @Post(':id/rechazar')
  @ApiOperation({
    summary: 'Rechazar recepción de activo',
    description: 'Rechaza la recepción de un activo indicando el motivo',
  })
  @ApiParam({ name: 'id', description: 'ID de la asignación' })
  @ApiResponse({ status: 200, description: 'Rechazo registrado correctamente' })
  @ApiResponse({ status: 400, description: 'La asignación ya fue procesada' })
  @ApiResponse({ status: 403, description: 'No autorizado para esta acción' })
  @ApiResponse({ status: 404, description: 'Asignación no encontrada' })
  async rechazarRecepcion(
    @Param('id') id: string,
    @Body() data: RechazarRecepcionDTO,
    @Request() req,
  ) {
    const usuarioId = req.user?.id;
    const areaId = req.user?.areaId;

    // Verificar que el usuario es responsable del área
    const esResponsable = await this.asignacionesService.verificarResponsableArea(
      usuarioId,
      areaId,
    );

    if (!esResponsable) {
      throw new ForbiddenException(
        'No tiene permisos para rechazar recepciones de esta área',
      );
    }

    return this.asignacionesService.rechazarRecepcion(id, usuarioId, data);
  }
}