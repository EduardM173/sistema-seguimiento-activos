import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @ApiOkResponse({ description: 'Listado de proveedores externos' })
  @Get()
  async findAll(@Req() req: Request, @Query('q') q = '') {
    const userId = (req.user as { id: string }).id;
    const proveedores = await this.suppliersService.findAll(userId, q);
    return ApiResponse.success(proveedores);
  }

  @ApiCreatedResponse({ description: 'Proveedor registrado correctamente' })
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateSupplierDto) {
    const userId = (req.user as { id: string }).id;
    const proveedor = await this.suppliersService.create(userId, dto);
    return ApiResponse.success(proveedor, 'Proveedor registrado correctamente');
  }
}
