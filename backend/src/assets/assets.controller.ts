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

import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { SearchAssetsDto } from './dto/search-assets.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';

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
