import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';
import { AuditoriaService } from './auditoria.service';
import { SearchNotificationsDto } from './dto/search-notifications.dto';

@ApiTags('auditoria')
@ApiBearerAuth()
@Controller('auditoria')
@UseGuards(JwtAuthGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @ApiOperation({
    summary: 'Obtener bandeja de notificaciones',
    description: 'Lista las notificaciones asociadas al usuario autenticado o al área a la que pertenece.',
  })
  @ApiQuery({
    name: 'leidas',
    required: false,
    type: Boolean,
    description: 'Filtra las notificaciones leídas o no leídas',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Cantidad de registros por página',
  })
  @ApiOkResponse({ description: 'Bandeja de notificaciones obtenida correctamente' })
  @Get('notificaciones')
  async getNotifications(
    @Query() query: SearchNotificationsDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id;
    return this.auditoriaService.getNotifications(userId, query);
  }

  @ApiOperation({
    summary: 'Marcar notificación como leída',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la notificación' })
  @ApiOkResponse({ description: 'Notificación marcada como leída' })
  @ApiNotFoundResponse({ description: 'Notificación no encontrada' })
  @Post('notificaciones/:id/marcar-leida')
  async markAsRead(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const data = await this.auditoriaService.markAsRead(userId, id);
    return ApiResponse.success(data, 'Notificación marcada como leída');
  }

  @ApiOperation({
    summary: 'Marcar todas las notificaciones como leídas',
  })
  @ApiOkResponse({ description: 'Notificaciones marcadas como leídas' })
  @Post('notificaciones/marcar-todas-leidas')
  async markAllAsRead(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const data = await this.auditoriaService.markAllAsRead(userId);
    return ApiResponse.success(data, 'Notificaciones actualizadas');
  }

  @ApiOperation({
    summary: 'Eliminar notificación',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la notificación' })
  @ApiOkResponse({ description: 'Notificación eliminada correctamente' })
  @ApiNotFoundResponse({ description: 'Notificación no encontrada' })
  @Delete('notificaciones/:id')
  async deleteNotification(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    await this.auditoriaService.deleteNotification(userId, id);
    return ApiResponse.success(null, 'Notificación eliminada correctamente');
  }

  @ApiOperation({
    summary: 'Obtener contador de notificaciones no leídas',
  })
  @ApiOkResponse({ description: 'Contador obtenido correctamente' })
  @Get('notificaciones/contador')
  async getUnreadCount(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const data = await this.auditoriaService.getUnreadCount(userId);
    return ApiResponse.success(data);
  }
}
