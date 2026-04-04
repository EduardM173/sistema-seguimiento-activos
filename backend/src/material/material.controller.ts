import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MaterialService } from './material.service';
import { CreateMaterialDTO, UpdateMaterialDTO, MaterialResponseDTO } from './dto';

@ApiTags('inventory-items')
@ApiBearerAuth()
@Controller('inventory-items')
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
    description: 'Obtiene el listado de materiales con filtros y paginación opcionales.',
  })
  @ApiQuery({ name: 'nombre', required: false, type: String })
  @ApiQuery({ name: 'categoriaId', required: false, type: String })
  @ApiQuery({ name: 'skip', required: false, type: String })
  @ApiQuery({ name: 'take', required: false, type: String })
  @ApiOkResponse({
    description: 'Listado de materiales obtenido correctamente',
  })
  @Get()
  async findAll(
    @Query('nombre') nombre?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ): Promise<{
    data: MaterialResponseDTO[];
    total: number;
    skip?: number;
    take?: number;
  }> {
    return this.materialService.findAll({
      nombre,
      categoriaId,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
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
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos para actualizar el material',
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
}
