import {
  Body,
  Controller,
  Delete,
  Get,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { SearchAssetsDto } from './dto/search-assets.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';
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
   * GET /api/assets/:id
   * Get single asset with full details.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const activo = await this.assetsService.findOne(id);
    return ApiResponse.success(activo);
  }

  /**
   * POST /api/assets
   * Create a new asset.
   */
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

  /**
   * DELETE /api/assets/:id
   * Soft-delete (dar de baja) an asset.
   */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const activo = await this.assetsService.remove(id, userId);
    return ApiResponse.success(activo, 'Activo dado de baja exitosamente');
  }
}
