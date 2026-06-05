import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';
import { TipoSolicitudCompra } from '../generated/prisma/client';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('purchases')
@ApiBearerAuth()
@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @ApiOkResponse({ description: 'Catálogo liviano para compradores' })
  @Get('catalog')
  async catalog(
    @Query('tipo') tipo: TipoSolicitudCompra = TipoSolicitudCompra.ACTIVO,
    @Query('q') q = '',
  ) {
    const data = await this.purchasesService.searchCatalog(tipo, q);
    return ApiResponse.success(data);
  }

  @ApiCreatedResponse({ description: 'Solicitud de compra registrada correctamente' })
  @Post()
  async create(@Body() dto: CreatePurchaseRequestDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const solicitud = await this.purchasesService.create(dto, userId);
    return ApiResponse.success(
      solicitud,
      'Solicitud de compra registrada correctamente',
    );
  }

  @ApiOkResponse({ description: 'Solicitudes de compra del usuario autenticado' })
  @Get('mine')
  async findMine(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const solicitudes = await this.purchasesService.findMine(userId);
    return ApiResponse.success(solicitudes);
  }
}
