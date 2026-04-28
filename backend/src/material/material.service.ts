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
  MaterialEstadoFilter,
  MaterialResponseDTO,
  MaterialSortBy,
  MaterialSortType,
  SearchMaterialDTO,
} from './dto';
import { TipoMovimientoInventario } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';

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

      if (createMaterialDTO.areaId) {
        const area = await this.prisma.area.findUnique({
          where: { id: createMaterialDTO.areaId },
        });

        if (!area) {
          throw new BadRequestException('El area especificada no existe');
        }
      }

      // Convertir strings a números si es necesario
      const stockActual =
        typeof createMaterialDTO.stockActual === 'string'
          ? parseFloat(createMaterialDTO.stockActual)
          : createMaterialDTO.stockActual;

      const stockMinimo =
        typeof createMaterialDTO.stockMinimo === 'string'
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
          areaId: createMaterialDTO.areaId,
        },
      });

      // Obtener el material con la categoría incluida
      const materialConCategoria = await this.prisma.material.findUnique({
        where: { id: material.id },
        include: {
          categoria: true,
          area: true,
        },
      });

      // Nota: Registrar movimiento se haría aquí con el usuario autenticado
      // Por ahora se omite para las pruebas iniciales

      return this.mapMaterialToDTO(materialConCategoria);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new InternalServerErrorException(
        'Error al obtener historial del material: ' + message,
      );
    }
  }

  /**
   * Obtener todos los materiales con filtros opcionales
   */
  async findAll(filters?: SearchMaterialDTO, user?: any): Promise<{
    data: MaterialResponseDTO[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const pageSize = filters?.take ?? filters?.pageSize ?? 10;
      const page =
        filters?.skip !== undefined
          ? Math.floor(filters.skip / pageSize) + 1
          : (filters?.page ?? 1);
      const skip =
        filters?.skip !== undefined ? filters.skip : (page - 1) * pageSize;

      const where: Prisma.MaterialWhereInput = {};
      const estadoFilter = filters?.estado ?? null;

      if (filters?.q) {
        where.OR = [
          { nombre: { contains: filters.q, mode: 'insensitive' } },
          { codigo: { contains: filters.q, mode: 'insensitive' } },
        ];
      }

      if (filters?.categoriaId) {
        where.categoriaId = filters.categoriaId;
      }

      if (filters?.areaId) {
        where.areaId = filters.areaId;
      }

      const isAreaManager = this.isAreaManagerRole(user?.rol);

      if (isAreaManager && user?.id) {
        const userScope = await this.prisma.usuario.findUnique({
          where: { id: user.id },
          select: {
            areaId: true,
            areasGestionadas: {
              select: { id: true },
            },
          },
        });

        const scopedAreaIds = [
          userScope?.areaId ?? null,
          ...(userScope?.areasGestionadas.map((area) => area.id) ?? []),
        ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);

        if (scopedAreaIds.length === 1) {
          where.areaId = scopedAreaIds[0];
        } else if (scopedAreaIds.length > 1) {
          where.areaId = { in: scopedAreaIds };
        } else {
          where.areaId = '__AREA_SIN_ACCESO__';
        }
      }

      const orderDirection: Prisma.SortOrder =
        filters?.sortType === MaterialSortType.ASC ? 'asc' : 'desc';

      const orderBy: Prisma.MaterialOrderByWithRelationInput =
        filters?.sortBy === MaterialSortBy.CODIGO
          ? { codigo: orderDirection }
          : filters?.sortBy === MaterialSortBy.NOMBRE
            ? { nombre: orderDirection }
            : filters?.sortBy === MaterialSortBy.CATEGORIA
              ? { categoria: { nombre: orderDirection } }
              : filters?.sortBy === MaterialSortBy.STOCK_ACTUAL
                ? { stockActual: orderDirection }
                : filters?.sortBy === MaterialSortBy.STOCK_MINIMO
                  ? { stockMinimo: orderDirection }
                  : filters?.sortBy === MaterialSortBy.UNIDAD
                    ? { unidad: orderDirection }
                    : filters?.sortBy === MaterialSortBy.AREA
                      ? { area: { nombre: orderDirection } }
                      : { creadoEn: orderDirection };

      // Prisma no permite comparar columnas (stockActual vs stockMinimo) directamente en `where`.
      // Para mantener el filtro CRITICO/NORMAL sin tocar BD, filtramos en backend y luego paginamos.
      const shouldFilterByEstado =
        estadoFilter === MaterialEstadoFilter.CRITICO ||
        estadoFilter === MaterialEstadoFilter.NORMAL;

      const [materialesRaw, totalRaw] = await Promise.all([
        this.prisma.material.findMany({
          where,
          ...(shouldFilterByEstado ? {} : { skip, take: pageSize }),
          orderBy,
          include: {
            categoria: true,
            area: true,
          },
        }),
        this.prisma.material.count({ where }),
      ]);

      const materialesFiltrados = shouldFilterByEstado
        ? materialesRaw.filter((m) => {
            const actual = Number(m.stockActual);
            const minimo = Number(m.stockMinimo);
            if (estadoFilter === MaterialEstadoFilter.CRITICO) {
              return actual > 0 && actual < minimo;
            }
            return actual >= minimo;
          })
        : materialesRaw;

      const total = shouldFilterByEstado ? materialesFiltrados.length : totalRaw;
      const paged = shouldFilterByEstado
        ? materialesFiltrados.slice(skip, skip + pageSize)
        : materialesFiltrados;

      return {
        data: paged.map((m) => this.mapMaterialToDTO(m)),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    } catch (error) {
       const message = error instanceof Error ? error.message : String(error);

      throw new InternalServerErrorException(
        'Error al obtener materiales: ' + message,
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
          area: true,
        },
      });

      if (!material) {
        throw new NotFoundException(`Material con ID ${id} no encontrado`);
      }

      return this.mapMaterialToDTO(material);
    } catch (error) {
       const message = error instanceof Error ? error.message : String(error);

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al obtener el material: ' + message,
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

      if (updateMaterialDTO.areaId) {
        const area = await this.prisma.area.findUnique({
          where: { id: updateMaterialDTO.areaId },
        });

        if (!area) {
          throw new BadRequestException('El area especificada no existe');
        }
      }

      // Preparar datos a actualizar
      const data: any = {};
      if (updateMaterialDTO.nombre !== undefined) data.nombre = updateMaterialDTO.nombre;
      if (updateMaterialDTO.descripcion !== undefined) data.descripcion = updateMaterialDTO.descripcion;
      if (updateMaterialDTO.unidad !== undefined) data.unidad = updateMaterialDTO.unidad;
      if (updateMaterialDTO.categoriaId !== undefined) data.categoriaId = updateMaterialDTO.categoriaId;
      if (updateMaterialDTO.areaId !== undefined) data.areaId = updateMaterialDTO.areaId || null;

      if (updateMaterialDTO.stockActual !== undefined) {
        const actualValue =
          typeof updateMaterialDTO.stockActual === 'string'
            ? parseFloat(updateMaterialDTO.stockActual)
            : updateMaterialDTO.stockActual;
        data.stockActual = actualValue;
      }

      if (updateMaterialDTO.stockMinimo !== undefined) {
        const stockMinimo =
          typeof updateMaterialDTO.stockMinimo === 'string'
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
        include: {
          categoria: true,
          area: true,
        },
      });

      return this.mapMaterialToDTO(updatedMaterial);
    } catch (error) {
       const message = error instanceof Error ? error.message : String(error);

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error al actualizar el material: ' + message,
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
       const message = error instanceof Error ? error.message : String(error);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error al eliminar el material: ' + message,
      );
    }
  }

  /**
   * Obtener todas las categorías de materiales
   */
  async obtenerCategorias(): Promise<
    { id: string; nombre: string; descripcion?: string | null }[]
  > {
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
       const message = error instanceof Error ? error.message : String(error);

      throw new InternalServerErrorException(
        'Error al obtener las categorías: ' + message,
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
      areaId: material.areaId,
      area: material.area
        ? {
            id: material.area.id,
            nombre: material.area.nombre,
          }
        : null,
      creadoEn: material.creadoEn,
      actualizadoEn: material.actualizadoEn,
    };
  }

  /**
   * Registrar ingreso de stock
   */
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

  async reducirStock(id: string, cantidad: number, motivo: string, userId: string) {
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad de salida debe ser mayor a 0',
      );
    }

    const motivoNormalizado = motivo?.trim();

    if (!motivoNormalizado) {
      throw new BadRequestException(
        'Debe ingresar el motivo de la salida',
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

    if (cantidad > stockAnterior) {
      throw new BadRequestException(
        `La cantidad solicitada (${cantidad}) supera el stock disponible (${stockAnterior})`,
      );
    }

    const stockNuevo = stockAnterior - Number(cantidad);

    const result = await this.prisma.$transaction(async (tx) => {
      const materialActualizado = await tx.material.update({
        where: { id },
        data: {
          stockActual: {
            decrement: cantidad,
          },
        },
        include: { categoria: true },
      });

      const movimiento = await tx.movimientoInventario.create({
        data: {
          materialId: id,
          tipo: TipoMovimientoInventario.SALIDA,
          cantidad,
          stockAnterior,
          stockNuevo,
          motivo: motivoNormalizado,
          realizadoPorId: userId,
        },
      });

      return { materialActualizado, movimiento };
    });

    return {
      message: `Se registró la salida de ${cantidad} unidades de ${result.materialActualizado.nombre}`,
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

  async ajustarStock(
    id: string,
    cantidadRegistrada: number,
    cantidadFisica: number,
    motivo: string,
    userId: string,
  ) {
    if (!Number.isFinite(cantidadRegistrada) || cantidadRegistrada < 0) {
      throw new BadRequestException(
        'La cantidad registrada debe ser un número válido mayor o igual a 0',
      );
    }

    if (!Number.isFinite(cantidadFisica) || cantidadFisica < 0) {
      throw new BadRequestException(
        'La cantidad física debe ser un número válido mayor o igual a 0',
      );
    }

    const motivoNormalizado = motivo?.trim();

    if (!motivoNormalizado) {
      throw new BadRequestException(
        'Debe ingresar un motivo para registrar el ajuste',
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

    if (stockAnterior !== Number(cantidadRegistrada)) {
      throw new BadRequestException(
        `La cantidad registrada no coincide con el stock actual del sistema (${stockAnterior})`,
      );
    }

    const stockNuevo = Number(cantidadFisica);
    const diferencia = stockNuevo - stockAnterior;

    const result = await this.prisma.$transaction(async (tx) => {
      const materialActualizado = await tx.material.update({
        where: { id },
        data: {
          stockActual: stockNuevo,
        },
        include: { categoria: true },
      });

      const movimiento = await tx.movimientoInventario.create({
        data: {
          materialId: id,
          tipo: TipoMovimientoInventario.AJUSTE,
          cantidad: diferencia,
          stockAnterior,
          stockNuevo,
          motivo: motivoNormalizado,
          realizadoPorId: userId,
        },
      });

      return { materialActualizado, movimiento };
    });

    return {
      message: `Ajuste registrado correctamente para ${result.materialActualizado.nombre}`,
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

  /**
   * Obtener historial de movimientos de un material
   */
 /**
 * Obtener historial de movimientos de un material
 */
async getHistory(
  id: string,
  filters?: { startDate?: string; endDate?: string },
) {
  try {
    const material = await this.prisma.material.findUnique({
      where: { id },
    });

    if (!material) {
      throw new NotFoundException(`Material con ID ${id} no encontrado`);
    }

    const where: Prisma.MovimientoInventarioWhereInput = {
      materialId: id,
    };

    const creadoEnFilter: Prisma.DateTimeFilter = {};

    if (filters?.startDate) {
      creadoEnFilter.gte = new Date(filters.startDate);
    }

    if (filters?.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      creadoEnFilter.lte = end;
    }

    if (filters?.startDate || filters?.endDate) {
      where.creadoEn = creadoEnFilter;
    }

    const movimientosRaw = await this.prisma.movimientoInventario.findMany({
      where,
      orderBy: {
        creadoEn: 'desc',
      },
      include: {
        realizadoPor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    const movimientos = movimientosRaw as any[];

    return movimientos.map((movimiento) => ({
      id: movimiento.id,
      tipo: movimiento.tipo,
      cantidad: Number(movimiento.cantidad),
      fecha: movimiento.creadoEn,
      responsable: movimiento.realizadoPor
        ? `${movimiento.realizadoPor.nombres} ${movimiento.realizadoPor.apellidos}`.trim()
        : null,
      usuario: movimiento.realizadoPor
        ? {
            id: movimiento.realizadoPor.id,
            nombreCompleto: `${movimiento.realizadoPor.nombres} ${movimiento.realizadoPor.apellidos}`,
          }
        : null,
      observacion: movimiento.motivo ?? null,
      material: {
        id: material.id,
        codigo: material.codigo,
        nombre: material.nombre,
      },
    }));
  } catch (error) {
    if (error instanceof NotFoundException) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    throw new InternalServerErrorException(
      'Error al obtener historial del material: ' + message,
    );
  }
}

  async createFakeBulk(count: number) {
    const safeCount = Number.isFinite(count) ? Math.trunc(count) : 0;

    if (safeCount <= 0) {
      throw new BadRequestException(
        'La cantidad de materiales ficticios debe ser mayor a 0',
      );
    }

    if (safeCount > 500) {
      throw new BadRequestException(
        'Por seguridad, la carga rápida permite como máximo 500 materiales por vez',
      );
    }

    const categorias = await this.prisma.categoriaMaterial.findMany({
      select: { id: true, nombre: true },
      take: 10,
      orderBy: { nombre: 'asc' },
    });

    const unidades = ['unidad', 'caja', 'paquete', 'resma', 'litro'];
    const batchId = Date.now().toString(36).toUpperCase();

    const data = Array.from({ length: safeCount }, (_, index) => {
      const categoria = categorias[index % Math.max(categorias.length, 1)];
      const sequence = String(index + 1).padStart(3, '0');
      const stockMinimo = (index % 12) + 2;
      const stockActual =
        index % 5 === 0 ? 0 : index % 4 === 0 ? stockMinimo - 1 : stockMinimo + 8;

      return {
        codigo: `MAT-DEMO-${batchId}-${sequence}`,
        nombre: `Material Demo ${sequence}`,
        descripcion: `Registro ficticio para pruebas de inventario${
          categoria ? ` (${categoria.nombre})` : ''
        }.`,
        unidad: unidades[index % unidades.length],
        stockActual,
        stockMinimo,
          categoriaId: categoria?.id,
      };
    });

    const result = await this.prisma.material.createMany({ data });
    return result.count;
  }

  private isAreaManagerRole(roleName?: string | null): boolean {
    if (!roleName) {
      return false;
    }

    const normalized = roleName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\s]+/g, ' ')
      .trim()
      .toUpperCase();

    return (
      normalized === 'RESPONSABLE DE AREA' ||
      normalized === 'RESPONSABLE AREA'
    );
  }

  async deleteFakeBulk() {
    const result = await this.prisma.material.deleteMany({
      where: {
        codigo: {
          startsWith: 'MAT-DEMO-',
        },
      },
    });

    return result.count;
  }
}
