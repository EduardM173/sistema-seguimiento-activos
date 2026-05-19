import {
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // HU27 — Reporte general del inventario (sin cambios)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('inventory/general')
  async getGeneralInventoryReport() {
    try {
      return await this.reportsService.getGeneralInventoryReport();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(this.getErrorMessage(error));
    }
  }

  @Get('inventory/general/download/:format')
  async downloadGeneralInventoryReport(
    @Param('format') format: 'pdf' | 'excel',
    @Query('generatedById') generatedById: string | undefined,
    @Res() response: Response,
  ) {
    const file = await this.reportsService
      .generateGeneralInventoryFile(format, generatedById)
      .catch((error) => {
        if (error instanceof HttpException) {
          throw error;
        }
        throw new InternalServerErrorException(this.getErrorMessage(error));
      });

    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    response.send(file.buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HU28 — Reporte por categoría de activos
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /reports/inventory/category
   * PROSIN-443 / PA1
   * Retorna la cantidad de activos agrupados por cada categoría.
   */
  @Get('inventory/category')
  async getCategoryReport() {
    try {
      return await this.reportsService.getCategoryReport();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(this.getErrorMessage(error));
    }
  }

  /**
   * GET /reports/inventory/category/:categoryId/assets
   * PROSIN-444 / PA2 / PA3 / PA4 / PA5
   * Retorna activos (código, nombre, estado, ubicación) de la categoría seleccionada.
   * Lista vacía cuando la categoría no tiene activos → PA5.
   *
   * IMPORTANTE: esta ruta debe ir ANTES de /category/download/:format
   * para que NestJS no confunda "download" con un categoryId.
   */
  @Get('inventory/category/:categoryId/assets')
  async getCategoryAssets(@Param('categoryId') categoryId: string) {
    try {
      return await this.reportsService.getCategoryAssets(categoryId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(this.getErrorMessage(error));
    }
  }

  /**
   * GET /reports/inventory/category/download/:format
   * HU28 + HU30
   * Descarga PDF o Excel del resumen de categorías.
   */
  @Get('inventory/category/download/:format')
  async downloadCategoryReport(
    @Param('format') format: 'pdf' | 'excel',
    @Query('generatedById') generatedById: string | undefined,
    @Res() response: Response,
  ) {
    const file = await this.reportsService
      .generateCategoryReportFile(format, generatedById)
      .catch((error) => {
        if (error instanceof HttpException) {
          throw error;
        }
        throw new InternalServerErrorException(this.getErrorMessage(error));
      });

    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    response.send(file.buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Error al consultar el microservicio de reportes';
  }
}
