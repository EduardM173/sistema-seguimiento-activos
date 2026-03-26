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
import { MaterialService } from './material.service';
import { CreateMaterialDTO, UpdateMaterialDTO, MaterialResponseDTO } from './dto';

@Controller('inventory-items')
export class MaterialController {
  constructor(private readonly materialService: MaterialService) {}

  /**
   * POST /inventory-items
   * Crear un nuevo material
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createMaterialDTO: CreateMaterialDTO): Promise<MaterialResponseDTO> {
    return this.materialService.create(createMaterialDTO);
  }

  /**
   * GET /inventory-items
   * Obtener listado de materiales con filtros opcionales
   */
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
  @Get('categorias')
  async obtenerCategorias(): Promise<{ id: string; nombre: string; descripcion?: string | null }[]> {
    return this.materialService.obtenerCategorias();
  }

  /**
   * GET /inventory-items/:id
   * Obtener un material por ID
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<MaterialResponseDTO> {
    return this.materialService.findById(id);
  }

  /**
   * PUT /inventory-items/:id
   * Actualizar un material
   */
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
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.materialService.delete(id);
  }
}
