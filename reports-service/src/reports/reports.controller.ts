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

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Error al consultar el microservicio de reportes';
  }
}
