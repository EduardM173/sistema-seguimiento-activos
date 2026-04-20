import {
  ParseIntPipe,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MaterialService } from './material.service';
import {
  CreateMaterialDTO,
  UpdateMaterialDTO,
  MaterialResponseDTO,
  MaterialEstadoFilter,
  AumentarStockDTO,
  MaterialSortBy,
  MaterialSortType,
  SearchMaterialDTO,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiResponse } from '../common/api-response';

@ApiTags('inventory-items')
@ApiBearerAuth()
@Controller('inventory-items')
@UseGuards(JwtAuthGuard)
export class MaterialController {
  constructor(private readonly materialService: MaterialService) {}

  /**
   * POST /inventory-items
   * Crear un nuevo material
   */
  @ApiOperation({
    summary: 'Registrar material',
    description: 'Crea un nuevo material dentro del inventario institucional.',
  })
  @ApiBody({ type: CreateMaterialDTO })
  @ApiCreatedResponse({
    description: 'Material registrado correctamente',
    type: MaterialResponseDTO,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos para registrar el material',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createMaterialDTO: CreateMaterialDTO): Promise<MaterialResponseDTO> {
    return this.materialService.create(createMaterialDTO);
  }

  /**
   * GET /inventory-items
   * Obtener listado de materiales con filtros opcionales
   */
  @ApiOperation({
    summary: 'Listar materiales',
    description: 'Obtiene el listado de materiales o recursos del inventario, incluyendo su stock actual y stock mínimo.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Filtra materiales por coincidencia en código o nombre',
    example: 'papel',
  })
  @ApiQuery({
    name: 'categoriaId',
    required: false,
    type: String,
    description: 'Filtra materiales por categoría',
    example: 'cmnkly3id000w2wl6qls04snz',
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
    description: 'Cantidad máxima de registros a devolver',
    example: 10,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: MaterialSortBy,
    description: 'Campo por el cual ordenar el listado',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: MaterialEstadoFilter,
    description: 'Filtra materiales por estado de stock',
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    enum: MaterialSortType,
    description: 'Dirección de ordenación',
  })
  @ApiOkResponse({
    description: 'Listado de materiales obtenido correctamente',
    schema: {
      example: {
        data: [
          {
            id: 'cmnmaterial123',
            codigo: 'MAT-001',
            nombre: 'Papel bond carta',
            unidad: 'paquete',
            stockActual: 15,
            stockMinimo: 10,
            categoria: {
              id: 'cmncat123',
              nombre: 'Papelería',
              descripcion: 'Materiales de oficina',
            },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    },
  })
  @Get()
  async findAll(@Query() query: SearchMaterialDTO): Promise<{
    data: MaterialResponseDTO[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return this.materialService.findAll(query);
  }

  /**
   * GET /inventory-items/categorias
   * Obtener todas las categorías de materiales
   */
  @ApiOperation({
    summary: 'Listar categorías de materiales',
    description: 'Obtiene las categorías válidas para registrar materiales.',
  })
  @ApiOkResponse({
    description: 'Categorías de materiales obtenidas correctamente',
  })
  @Get('categorias')
  async obtenerCategorias(): Promise<{ id: string; nombre: string; descripcion?: string | null }[]> {
    return this.materialService.obtenerCategorias();
  }

  /**
   * GET /inventory-items/:id
   * Obtener un material por ID
   */
  @ApiOperation({
    summary: 'Obtener material por ID',
    description: 'Recupera el detalle de un material específico.',
  })
  @ApiParam({ name: 'id', description: 'ID del material' })
  @ApiOkResponse({
    description: 'Material encontrado correctamente',
    type: MaterialResponseDTO,
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el material solicitado',
  })
  @Get(':id')
  async findById(@Param('id') id: string): Promise<MaterialResponseDTO> {
    return this.materialService.findById(id);
  }

  /**
   * PUT /inventory-items/:id
   * Actualizar un material
   */
  @ApiOperation({
    summary: 'Actualizar material',
    description: 'Actualiza los datos de un material existente.',
  })
  @ApiParam({ name: 'id', description: 'ID del material' })
  @ApiBody({ type: UpdateMaterialDTO })
  @ApiOkResponse({
    description: 'Material actualizado correctamente',
    type: MaterialResponseDTO,
    schema: {
      example: {
        id: 'cmnmaterial123',
        codigo: 'MAT-001',
        nombre: 'Papel bond oficio',
        unidad: 'resma',
        stockActual: 20,
        stockMinimo: 5,
        categoriaId: 'cmncat123',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos para actualizar el material',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el material solicitado',
  })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateMaterialDTO: UpdateMaterialDTO,
  ): Promise<MaterialResponseDTO> {
    return this.materialService.update(id, updateMaterialDTO);
  }

  /**
   * DELETE /inventory-items/:id
   * Eliminar un material
   */
  @ApiOperation({
    summary: 'Eliminar material',
    description: 'Elimina un material del inventario.',
  })
  @ApiParam({ name: 'id', description: 'ID del material' })
  @ApiOkResponse({
    description: 'Material eliminado correctamente',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.materialService.delete(id);
  }

  @ApiOperation({
    summary: 'Registrar ingreso de stock',
    description:
      'Registra una entrada de inventario para un material existente y aumenta su stock disponible.',
  })
  @ApiParam({ name: 'id', description: 'ID del material' })
  @ApiBody({
    type: AumentarStockDTO,
    examples: {
      ingresoStock: {
        summary: 'Ingreso de stock',
        value: {
          cantidad: 25,
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Ingreso registrado correctamente y stock actualizado',
    schema: {
      example: {
        success: true,
        message: 'Ingreso de stock registrado correctamente',
        data: {
          message: 'Se registró el ingreso de 25 unidades de Papel bond carta',
          material: {
            id: 'cmnmaterial123',
            codigo: 'MAT-001',
            nombre: 'Papel bond carta',
            unidad: 'paquete',
            stockActual: 40,
            stockMinimo: 10,
          },
          movimiento: {
            id: 'cmnmov123',
            tipo: 'ENTRADA',
            cantidad: 25,
            stockAnterior: 15,
            stockNuevo: 40,
            motivo: 'Ingreso de stock',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'La cantidad ingresada es inválida o menor o igual a cero',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el material solicitado',
  })
  @Patch(':id/aumentar-stock')
  async aumentarStock(
    @Param('id') id: string,
    @Body() dto: AumentarStockDTO,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id;
    const result = await this.materialService.aumentarStock(id, dto.cantidad, userId);
    return ApiResponse.success(result, 'Ingreso de stock registrado correctamente');
  }

  @ApiOperation({
    summary: 'Cargar materiales demo rápidamente',
    description:
      'Genera una cantidad de materiales ficticios para pruebas rápidas del inventario.',
  })
  @ApiQuery({
    name: 'count',
    required: false,
    type: Number,
    description: 'Cantidad de materiales ficticios a insertar',
    example: 100,
  })
  @ApiOkResponse({
    description: 'Materiales ficticios insertados correctamente',
    schema: {
      example: {
        success: true,
        message: 'Se generaron 100 materiales ficticios correctamente',
        data: {
          inserted: 100,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'La cantidad es inválida para la carga rápida de materiales demo',
  })
  @Post('dev/fake-bulk')
  async createFakeBulk(
    @Query('count', new ParseIntPipe({ optional: true })) count?: number,
  ) {
    const inserted = await this.materialService.createFakeBulk(count ?? 100);
    return ApiResponse.success(
      { inserted },
      `Se generaron ${inserted} materiales ficticios correctamente`,
    );
  }

  @ApiOperation({
    summary: 'Eliminar materiales demo rápidamente',
    description:
      'Elimina únicamente los materiales ficticios generados por la carga rápida demo.',
  })
  @ApiOkResponse({
    description: 'Materiales ficticios eliminados correctamente',
    schema: {
      example: {
        success: true,
        message: 'Se eliminaron 100 materiales ficticios correctamente',
        data: {
          deleted: 100,
        },
      },
    },
  })
  @Delete('dev/fake-bulk')
  async deleteFakeBulk() {
    const deleted = await this.materialService.deleteFakeBulk();
    return ApiResponse.success(
      { deleted },
      `Se eliminaron ${deleted} materiales ficticios correctamente`,
    );
  }
}
