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
  // HU27 — Reporte general del inventario
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('inventory/general')
  async getGeneralInventoryReport() {
    try {
      return await this.reportsService.getGeneralInventoryReport();
    } catch (error) {
      if (error instanceof HttpException) throw error;
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
        if (error instanceof HttpException) throw error;
        throw new InternalServerErrorException(this.getErrorMessage(error));
      });
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.send(file.buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HU28 — Reporte por categoría de activos
  // IMPORTANTE: /category/download/:format debe ir ANTES de /category/:id/assets
  // para que NestJS no interprete "download" como un categoryId
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('inventory/category')
  async getCategoryReport() {
    try {
      return await this.reportsService.getCategoryReport();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(this.getErrorMessage(error));
    }
  }

  @Get('inventory/category/download/:format')
  async downloadCategoryReport(
    @Param('format') format: 'pdf' | 'excel',
    @Query('generatedById') generatedById: string | undefined,
    @Res() response: Response,
  ) {
    const file = await this.reportsService
      .generateCategoryReportFile(format, generatedById)
      .catch((error) => {
        if (error instanceof HttpException) throw error;
        throw new InternalServerErrorException(this.getErrorMessage(error));
      });
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.send(file.buffer);
  }

  @Get('inventory/category/:categoryId/assets')
  async getCategoryAssets(@Param('categoryId') categoryId: string) {
    try {
      return await this.reportsService.getCategoryAssets(categoryId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(this.getErrorMessage(error));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HU47 — Reporte por responsable actual
  // IMPORTANTE: /responsable/download/:format debe ir ANTES de /responsable/:id/assets
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /reports/inventory/responsable
   * PROSIN-491 / PA1 — Cantidad de activos agrupados por responsable actual
   */
  @Get('inventory/responsable')
  async getResponsableReport() {
    try {
      return await this.reportsService.getResponsableReport();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(this.getErrorMessage(error));
    }
  }

  /**
   * GET /reports/inventory/responsable/download/:format
   * HU47 + HU30 — Descarga PDF o Excel del resumen por responsable
   */
  @Get('inventory/responsable/download/:format')
  async downloadResponsableReport(
    @Param('format') format: 'pdf' | 'excel',
    @Query('generatedById') generatedById: string | undefined,
    @Res() response: Response,
  ) {
    const file = await this.reportsService
      .generateResponsableReportFile(format, generatedById)
      .catch((error) => {
        if (error instanceof HttpException) throw error;
        throw new InternalServerErrorException(this.getErrorMessage(error));
      });
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.send(file.buffer);
  }

  /**
   * GET /reports/inventory/responsable/:responsableId/assets
   * PROSIN-492 / PA2 / PA3 / PA4 / PA5
   * Activos (código, nombre, categoría, estado, ubicación) del responsable seleccionado.
   * Lista vacía → PA5 "No existen activos asignados a este responsable"
   */
  @Get('inventory/responsable/:responsableId/assets')
  async getResponsableAssets(@Param('responsableId') responsableId: string) {
    try {
      return await this.reportsService.getResponsableAssets(responsableId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(this.getErrorMessage(error));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return 'Error al consultar el microservicio de reportes';
  }
}
