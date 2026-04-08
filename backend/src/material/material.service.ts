import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  CreateMaterialDTO,
  UpdateMaterialDTO,
  MaterialResponseDTO,
} from './dto';
import { TipoMovimientoInventario } from '../generated/prisma/enums';

@Injectable()
export class MaterialService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear un nuevo material
   */
  async create(createMaterialDTO: CreateMaterialDTO): Promise<MaterialResponseDTO> {
    try {
      // Validar que el código sea único
      const existingMaterial = await this.prisma.material.findUnique({
        where: { codigo: createMaterialDTO.codigo },
      });

      if (existingMaterial) {
        throw new BadRequestException('El código de material ya existe');
      }

      // Validar que si proporciona categoriaId, que exista
      if (createMaterialDTO.categoriaId) {
        const categoria = await this.prisma.categoriaMaterial.findUnique({
          where: { id: createMaterialDTO.categoriaId },
        });

        if (!categoria) {
          throw new BadRequestException('La categoría especificada no existe');
        }
      }

      // Convertir strings a números si es necesario
      const stockActual = typeof createMaterialDTO.stockActual === 'string' 
        ? parseFloat(createMaterialDTO.stockActual) 
        : createMaterialDTO.stockActual;
      
      const stockMinimo = typeof createMaterialDTO.stockMinimo === 'string' 
        ? parseFloat(createMaterialDTO.stockMinimo) 
        : createMaterialDTO.stockMinimo;

      // Validar que stock mínimo no sea negativo
      if (stockMinimo < 0) {
        throw new BadRequestException('El stock mínimo no puede ser negativo');
      }

      // Crear el material
      const material = await this.prisma.material.create({
        data: {
          codigo: createMaterialDTO.codigo,
          nombre: createMaterialDTO.nombre,
          descripcion: createMaterialDTO.descripcion,
          unidad: createMaterialDTO.unidad,
          stockActual,
          stockMinimo,
          categoriaId: createMaterialDTO.categoriaId,
        },
      });

      // Obtener el material con la categoría incluida
      const materialConCategoria = await this.prisma.material.findUnique({
        where: { id: material.id },
        include: {
          categoria: true,
        },
      });

      // Nota: Registrar movimiento se haría aquí con el usuario autenticado
      // Por ahora se omite para las pruebas iniciales

      return this.mapMaterialToDTO(materialConCategoria);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al crear el material: ' + error.message,
      );
    }
  }

  /**
   * Obtener todos los materiales con filtros opcionales
   */
  async findAll(filters?: {
    nombre?: string;
    categoriaId?: string;
    skip?: number;
    take?: number;
  }): Promise<{
    data: MaterialResponseDTO[];
    total: number;
    skip?: number;
    take?: number;
  }> {
    try {
      const skip = filters?.skip || 0;
      const take = filters?.take || 10;

      const where: any = {};

      if (filters?.nombre) {
        where.nombre = { contains: filters.nombre, mode: 'insensitive' };
      }

      if (filters?.categoriaId) {
        where.categoriaId = filters.categoriaId;
      }

      const [materiales, total] = await Promise.all([
        this.prisma.material.findMany({
          where,
          skip,
          take,
          orderBy: { creadoEn: 'desc' },
          include: {
            categoria: true,
          },
        }),
        this.prisma.material.count({ where }),
      ]);

      return {
        data: materiales.map((m) => this.mapMaterialToDTO(m)),
        total,
        skip,
        take,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al obtener materiales: ' + error.message,
      );
    }
  }

  /**
   * Obtener un material por ID
   */
  async findById(id: string): Promise<MaterialResponseDTO> {
    try {
      const material = await this.prisma.material.findUnique({
        where: { id },
        include: {
          categoria: true,
        },
      });

      if (!material) {
        throw new NotFoundException(`Material con ID ${id} no encontrado`);
      }

      return this.mapMaterialToDTO(material);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al obtener el material: ' + error.message,
      );
    }
  }

  /**
   * Actualizar un material
   */
  async update(
    id: string,
    updateMaterialDTO: UpdateMaterialDTO,
  ): Promise<MaterialResponseDTO> {
    try {
      // Verificar que el material exista
      const material = await this.prisma.material.findUnique({
        where: { id },
      });

      if (!material) {
        throw new NotFoundException(`Material con ID ${id} no encontrado`);
      }

      // Si se intenta actualizar el categoriaId, validar que exista
      if (updateMaterialDTO.categoriaId) {
        const categoria = await this.prisma.categoriaMaterial.findUnique({
          where: { id: updateMaterialDTO.categoriaId },
        });

        if (!categoria) {
          throw new BadRequestException('La categoría especificada no existe');
        }
      }

      // Preparar datos a actualizar
      const data: any = {};
      if (updateMaterialDTO.nombre !== undefined) data.nombre = updateMaterialDTO.nombre;
      if (updateMaterialDTO.descripcion !== undefined) data.descripcion = updateMaterialDTO.descripcion;
      if (updateMaterialDTO.unidad !== undefined) data.unidad = updateMaterialDTO.unidad;
      if (updateMaterialDTO.categoriaId !== undefined) data.categoriaId = updateMaterialDTO.categoriaId;

      if (updateMaterialDTO.stockActual !== undefined) {
        const actualValue = typeof updateMaterialDTO.stockActual === 'string' 
          ? parseFloat(updateMaterialDTO.stockActual) 
          : updateMaterialDTO.stockActual;
        data.stockActual = actualValue;
      }

      if (updateMaterialDTO.stockMinimo !== undefined) {
        const stockMinimo = typeof updateMaterialDTO.stockMinimo === 'string' 
          ? parseFloat(updateMaterialDTO.stockMinimo) 
          : updateMaterialDTO.stockMinimo;
        if (stockMinimo < 0) {
          throw new BadRequestException('El stock mínimo no puede ser negativo');
        }
        data.stockMinimo = stockMinimo;
      }

      // Actualizar el material
      const updatedMaterial = await this.prisma.material.update({
        where: { id },
        data,
      });

      return this.mapMaterialToDTO(updatedMaterial);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al actualizar el material: ' + error.message,
      );
    }
  }

  /**
   * Eliminar un material
   */
  async delete(id: string): Promise<{ message: string }> {
    try {
      // Verificar que el material exista
      const material = await this.prisma.material.findUnique({
        where: { id },
      });

      if (!material) {
        throw new NotFoundException(`Material con ID ${id} no encontrado`);
      }

      // Eliminar el material (borra en cascada: movimientos_inventario y notificaciones)
      await this.prisma.material.delete({
        where: { id },
      });

      return { message: 'Material eliminado correctamente' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al eliminar el material: ' + error.message,
      );
    }
  }

  /**
   * Obtener todas las categorías de materiales
   */
  async obtenerCategorias(): Promise<{ id: string; nombre: string; descripcion?: string | null }[]> {
    try {
      const categorias = await this.prisma.categoriaMaterial.findMany({
        select: {
          id: true,
          nombre: true,
          descripcion: true,
        },
        orderBy: {
          nombre: 'asc',
        },
      });
      return categorias;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al obtener las categorías: ' + error.message,
      );
    }
  }

  /**
   * Mapear entidad Material a DTO de respuesta
   */
  private mapMaterialToDTO(material: any): MaterialResponseDTO {
    return {
      id: material.id,
      codigo: material.codigo,
      nombre: material.nombre,
      descripcion: material.descripcion,
      unidad: material.unidad,
      stockActual: Number(material.stockActual),
      stockMinimo: Number(material.stockMinimo),
      categoriaId: material.categoriaId,
      categoria: material.categoria,
      creadoEn: material.creadoEn,
      actualizadoEn: material.actualizadoEn,
    };
  }

  async aumentarStock(id: string, cantidad: number, userId: string) {
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad a ingresar debe ser mayor a 0',
      );
    }

    const materialExistente = await this.prisma.material.findUnique({
      where: { id },
      include: { categoria: true },
    });

    if (!materialExistente) {
      throw new NotFoundException(`Material con ID ${id} no encontrado`);
    }

    const stockAnterior = Number(materialExistente.stockActual);
    const stockNuevo = stockAnterior + Number(cantidad);

    const result = await this.prisma.$transaction(async (tx) => {
      const materialActualizado = await tx.material.update({
        where: { id },
        data: {
          stockActual: {
            increment: cantidad,
          },
        },
        include: { categoria: true },
      });

      const movimiento = await tx.movimientoInventario.create({
        data: {
          materialId: id,
          tipo: TipoMovimientoInventario.ENTRADA,
          cantidad,
          stockAnterior,
          stockNuevo,
          motivo: 'Ingreso de stock',
          realizadoPorId: userId,
        },
      });

      return { materialActualizado, movimiento };
    });

    return {
      message: `Se registró el ingreso de ${cantidad} unidades de ${result.materialActualizado.nombre}`,
      material: this.mapMaterialToDTO(result.materialActualizado),
      movimiento: {
        id: result.movimiento.id,
        tipo: result.movimiento.tipo,
        cantidad: Number(result.movimiento.cantidad),
        stockAnterior: Number(result.movimiento.stockAnterior),
        stockNuevo: Number(result.movimiento.stockNuevo),
        motivo: result.movimiento.motivo ?? null,
        creadoEn: result.movimiento.creadoEn,
      },
    };
  }
}
