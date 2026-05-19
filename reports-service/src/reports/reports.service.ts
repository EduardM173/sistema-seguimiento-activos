import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { PdfBuilder, ExcelBuilder } from './builders';

// ─── Row types ───────────────────────────────────────────────────────────────

type CountRow = {
  total: string;
};

type AssetStatusRow = {
  estado: string;
  cantidad: string;
};

// HU28 — Resumen agrupado por categoría (PROSIN-443)
type CategorySummaryRow = {
  categoria_id: string;
  categoria_nombre: string;
  cantidad: string;
};

// HU28 — Detalle activos de categoría seleccionada (PROSIN-444 / PA3)
type CategoryAssetDetailRow = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  ubicacion: string | null;
};

// HU47 — Resumen agrupado por responsable (PROSIN-491)
type ResponsableSummaryRow = {
  responsable_id: string;
  responsable_nombre: string;
  cantidad: string;
};

// HU47 — Detalle activos de responsable seleccionado (PROSIN-492 / PA3)
type ResponsableAssetDetailRow = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string | null;
  estado: string;
  ubicacion: string | null;
};

type ReportFormat = 'pdf' | 'excel';

type GeneralInventoryReport = Awaited<
  ReturnType<ReportsService['getGeneralInventoryReport']>
>;

type CategoryReport = Awaited<ReturnType<ReportsService['getCategoryReport']>>;

type ResponsableReport = Awaited<ReturnType<ReportsService['getResponsableReport']>>;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  private readonly assetStatuses = [
    'OPERATIVO',
    'MANTENIMIENTO',
    'FUERA_DE_SERVICIO',
    'DADO_DE_BAJA',
  ];

  private readonly pdf = new PdfBuilder();
  private readonly excel = new ExcelBuilder();

  constructor(private readonly database: DatabaseService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // HU27 — Reporte general del inventario (sin cambios)
  // ═══════════════════════════════════════════════════════════════════════════

  async getGeneralInventoryReport() {
    const [assetsByStatus, totalMaterials, lowStockMaterials] =
      await Promise.all([
        this.getAssetsByStatus(),
        this.getTotalMaterials(),
        this.getLowStockMaterials(),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      assets: {
        byStatus: assetsByStatus,
        total: assetsByStatus.reduce((sum, item) => sum + item.quantity, 0),
      },
      materials: {
        total: totalMaterials,
        lowStock: lowStockMaterials,
      },
      downloadReady: true,
    };
  }

  async generateGeneralInventoryFile(format: ReportFormat, generatedById?: string) {
    if (!['pdf', 'excel'].includes(format)) {
      throw new BadRequestException('Formato de reporte no soportado');
    }

    const report = await this.getGeneralInventoryReport();

    if (!this.hasDownloadableData(report)) {
      throw new NotFoundException('No hay informacion disponible para descargar');
    }

    const generatedAt = new Date();
    const filename = this.buildFilename('reporte-general-inventario', format, generatedAt);

    if (generatedById) {
      await this.registerGeneratedReport(
        format,
        generatedById,
        generatedAt,
        'Reporte general del inventario',
        'inventario_general',
      );
    }

    if (format === 'pdf') {
      return {
        filename,
        contentType: 'application/pdf',
        buffer: this.buildGeneralPdf(report, generatedAt),
      };
    }

    return {
      filename,
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      buffer: Buffer.from(this.buildGeneralExcelHtml(report, generatedAt), 'utf8'),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HU28 — Reporte por categoría de activos (sin cambios)
  // ═══════════════════════════════════════════════════════════════════════════

  async getCategoryReport() {
    const summaries = await this.getCategorySummaries();

    const totalAssets = summaries.reduce((sum, r) => sum + Number(r.cantidad), 0);

    const categories = summaries.map((r) => ({
      id: r.categoria_id,
      name: r.categoria_nombre,
      total: Number(r.cantidad),
      percentage:
        totalAssets > 0 ? Math.round((Number(r.cantidad) / totalAssets) * 100) : 0,
    }));

    return {
      generatedAt: new Date().toISOString(),
      totalAssets,
      categories,
      downloadReady: categories.some((c) => c.total > 0),
    };
  }

  async getCategoryAssets(categoryId: string) {
    const catResult = await this.database.query<{ id: string; nombre: string }>(
      `SELECT id, nombre FROM categorias_activos WHERE id = $1`,
      [categoryId],
    );

    if (!catResult.rows.length) {
      throw new NotFoundException('Categoria no encontrada');
    }

    const category = catResult.rows[0];

    const result = await this.database.query<CategoryAssetDetailRow>(
      `
      SELECT
        a.id,
        a.codigo,
        a.nombre,
        a.estado,
        u.nombre AS ubicacion
      FROM activos a
      LEFT JOIN ubicaciones u ON u.id = a."ubicacionId"
      WHERE a."categoriaId" = $1
      ORDER BY a.nombre ASC
      `,
      [categoryId],
    );

    return {
      categoryId: category.id,
      categoryName: category.nombre,
      assets: result.rows.map((row) => ({
        id: row.id,
        codigo: row.codigo,
        nombre: row.nombre,
        estado: row.estado,
        estadoLabel: this.formatStatus(row.estado),
        ubicacion: row.ubicacion ?? 'Sin ubicacion',
      })),
      total: result.rows.length,
    };
  }

  async generateCategoryReportFile(format: ReportFormat, generatedById?: string) {
    if (!['pdf', 'excel'].includes(format)) {
      throw new BadRequestException('Formato de reporte no soportado');
    }

    const report = await this.getCategoryReport();

    if (!report.downloadReady) {
      throw new NotFoundException('No hay informacion disponible para descargar');
    }

    const generatedAt = new Date();
    const filename = this.buildFilename('reporte-por-categoria', format, generatedAt);

    if (generatedById) {
      await this.registerGeneratedReport(
        format,
        generatedById,
        generatedAt,
        'Reporte por categoria de activos',
        'categoria_activos',
      );
    }

    if (format === 'pdf') {
      return {
        filename,
        contentType: 'application/pdf',
        buffer: this.buildCategoryPdf(report, generatedAt),
      };
    }

    return {
      filename,
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      buffer: Buffer.from(this.buildCategoryExcelHtml(report, generatedAt), 'utf8'),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HU47 — Reporte por responsable actual
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * PROSIN-491 / PA1
   * Retorna la cantidad de activos agrupados por responsable actual.
   * Incluye TODOS los usuarios activos del sistema, incluso si tienen 0 activos
   * asignados — así el frontend puede mostrar el mensaje PA5.
   */
  async getResponsableReport() {
    const summaries = await this.getResponsableSummaries();

    const totalAssets = summaries.reduce((sum, r) => sum + Number(r.cantidad), 0);

    const responsables = summaries.map((r) => ({
      id: r.responsable_id,
      name: r.responsable_nombre,
      total: Number(r.cantidad),
      percentage:
        totalAssets > 0 ? Math.round((Number(r.cantidad) / totalAssets) * 100) : 0,
    }));

    return {
      generatedAt: new Date().toISOString(),
      totalAssets,
      responsables,
      downloadReady: totalAssets > 0,
    };
  }

  /**
   * PROSIN-492 / PA2 / PA3 / PA4 / PA5
   * Retorna los activos asignados a UN responsable seleccionado.
   * - Solo activos de ese responsable (PA4)
   * - Campos: código, nombre, categoría, estado, ubicación (PA3)
   * - Lista vacía → frontend muestra "No existen activos asignados a este responsable" (PA5)
   */
  async getResponsableAssets(responsableId: string) {
    const userResult = await this.database.query<{
      id: string;
      nombres: string;
      apellidos: string;
    }>(
      `SELECT id, nombres, apellidos FROM usuarios WHERE id = $1`,
      [responsableId],
    );

    if (!userResult.rows.length) {
      throw new NotFoundException('Responsable no encontrado');
    }

    const user = userResult.rows[0];

    const result = await this.database.query<ResponsableAssetDetailRow>(
      `
      SELECT
        a.id,
        a.codigo,
        a.nombre,
        ca.nombre  AS categoria,
        a.estado,
        u.nombre   AS ubicacion
      FROM activos a
      LEFT JOIN categorias_activos ca ON ca.id = a."categoriaId"
      LEFT JOIN ubicaciones u ON u.id = a."ubicacionId"
      WHERE a."responsableActualId" = $1
      ORDER BY a.nombre ASC
      `,
      [responsableId],
    );

    return {
      responsableId: user.id,
      responsableName: `${user.nombres} ${user.apellidos}`,
      assets: result.rows.map((row) => ({
        id: row.id,
        codigo: row.codigo,
        nombre: row.nombre,
        categoria: row.categoria ?? 'Sin categoria',
        estado: row.estado,
        estadoLabel: this.formatStatus(row.estado),
        ubicacion: row.ubicacion ?? 'Sin ubicacion',
      })),
      total: result.rows.length,
    };
  }

  /**
   * HU47 + HU30
   * Genera PDF o Excel del resumen por responsable para descarga.
   */
  async generateResponsableReportFile(format: ReportFormat, generatedById?: string) {
    if (!['pdf', 'excel'].includes(format)) {
      throw new BadRequestException('Formato de reporte no soportado');
    }

    const report = await this.getResponsableReport();

    if (!report.downloadReady) {
      throw new NotFoundException('No hay informacion disponible para descargar');
    }

    const generatedAt = new Date();
    const filename = this.buildFilename('reporte-por-responsable', format, generatedAt);

    if (generatedById) {
      await this.registerGeneratedReport(
        format,
        generatedById,
        generatedAt,
        'Reporte por responsable actual',
        'responsable_activos',
      );
    }

    if (format === 'pdf') {
      return {
        filename,
        contentType: 'application/pdf',
        buffer: this.buildResponsablePdf(report, generatedAt),
      };
    }

    return {
      filename,
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      buffer: Buffer.from(this.buildResponsableExcelHtml(report, generatedAt), 'utf8'),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Queries privadas
  // ═══════════════════════════════════════════════════════════════════════════

  private async getCategorySummaries() {
    const result = await this.database.query<CategorySummaryRow>(`
      SELECT
        ca.id              AS categoria_id,
        ca.nombre          AS categoria_nombre,
        COUNT(a.id)::text  AS cantidad
      FROM categorias_activos ca
      LEFT JOIN activos a ON a."categoriaId" = ca.id
      GROUP BY ca.id, ca.nombre
      ORDER BY ca.nombre ASC
    `);
    return result.rows;
  }

  private async getResponsableSummaries() {
    const result = await this.database.query<ResponsableSummaryRow>(`
      SELECT
        u.id                                 AS responsable_id,
        CONCAT(u.nombres, ' ', u.apellidos)  AS responsable_nombre,
        COUNT(a.id)::text                    AS cantidad
      FROM usuarios u
      LEFT JOIN activos a ON a."responsableActualId" = u.id
      WHERE u.estado = 'ACTIVO'
      GROUP BY u.id, u.nombres, u.apellidos
      ORDER BY u.nombres ASC, u.apellidos ASC
    `);
    return result.rows;
  }

  private async getAssetsByStatus() {
    const result = await this.database.query<AssetStatusRow>(`
      SELECT estado, COUNT(*)::text AS cantidad
      FROM activos
      GROUP BY estado
    `);

    const counts = new Map(
      result.rows.map((row) => [row.estado, Number(row.cantidad)]),
    );

    return this.assetStatuses.map((status) => ({
      status,
      label: this.formatStatus(status),
      quantity: counts.get(status) || 0,
    }));
  }

  private async getTotalMaterials() {
    const result = await this.database.query<CountRow>(`
      SELECT COUNT(*)::text AS total
      FROM materiales
    `);
    return Number(result.rows[0]?.total || 0);
  }

  private async getLowStockMaterials() {
    const result = await this.database.query<CountRow>(`
      SELECT COUNT(*)::text AS total
      FROM materiales
      WHERE "stockActual" <= "stockMinimo"
    `);
    return Number(result.rows[0]?.total || 0);
  }

  private hasDownloadableData(report: GeneralInventoryReport) {
    return report.assets.total > 0 || report.materials.total > 0;
  }

  private async registerGeneratedReport(
    format: ReportFormat,
    generatedById: string,
    generatedAt: Date,
    nombre: string,
    tipo: string,
  ) {
    const userExists = await this.database.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM usuarios
          WHERE id = $1
        ) AS exists
      `,
      [generatedById],
    );

    if (!userExists.rows[0]?.exists) {
      return;
    }

    await this.database.query(
      `
        INSERT INTO reportes_generados
          (id, "generadoPorId", nombre, tipo, formato, filtros, "urlArchivo", "creadoEn")
        VALUES
          ($1, $2, $3, $4, $5::"FormatoReporte", $6::jsonb, $7, $8)
      `,
      [
        randomUUID(),
        generatedById,
        nombre,
        tipo,
        format === 'pdf' ? 'PDF' : 'EXCEL',
        JSON.stringify({ origen: 'microservicio-reportes', datos: 'consulta_visible' }),
        null,
        generatedAt,
      ],
    );
  }

  private buildFilename(prefix: string, format: ReportFormat, at: Date) {
    const stamp = at.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    return `${prefix}-${stamp}.${format === 'pdf' ? 'pdf' : 'xls'}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF — General (HU27)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildGeneralPdf(report: GeneralInventoryReport, generatedAt: Date) {
    return this.pdf.build({
      title: 'Reporte general del inventario',
      generatedAt,
      description: 'Vista consolidada de activos, materiales y alertas de inventario.',
      metrics: [
        { label: 'Activos registrados',    value: report.assets.total,      accentColor: '0.15 0.39 0.92' },
        { label: 'Materiales registrados', value: report.materials.total,    accentColor: '0.02 0.59 0.41' },
        { label: 'Stock bajo',             value: report.materials.lowStock, accentColor: '0.92 0.48 0.03' },
      ],
      tableTitle: 'Activos por estado',
      columns: [
        { label: 'Estado',   x: 62  },
        { label: 'Cantidad', x: 474 },
      ],
      rows: report.assets.byStatus.map((item) => ({
        cells: [item.label, String(item.quantity)],
      })),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF — Categoría (HU28)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildCategoryPdf(report: CategoryReport, generatedAt: Date) {
    return this.pdf.build({
      title: 'Reporte por categoria de activos',
      generatedAt,
      description: `Total categorias: ${report.categories.length}  |  Total activos: ${report.totalAssets}`,
      tableTitle: 'Distribucion de activos por categoria',
      columns: [
        { label: 'Categoria',     x: 62  },
        { label: 'Total activos', x: 360 },
        { label: 'Participacion', x: 460 },
      ],
      rows: report.categories.map((cat) => ({
        cells: [
          cat.name.length > 40 ? cat.name.slice(0, 40) + '...' : cat.name,
          String(cat.total),
          `${cat.percentage}%`,
        ],
      })),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF — Responsable (HU47)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildResponsablePdf(report: ResponsableReport, generatedAt: Date) {
    return this.pdf.build({
      title: 'Reporte por responsable actual',
      generatedAt,
      description: `Total responsables: ${report.responsables.length}  |  Total activos: ${report.totalAssets}`,
      tableTitle: 'Activos agrupados por responsable actual',
      columns: [
        { label: 'Responsable',   x: 62  },
        { label: 'Total activos', x: 360 },
        { label: 'Participacion', x: 460 },
      ],
      rows: report.responsables.map((resp) => ({
        cells: [
          resp.name.length > 38 ? resp.name.slice(0, 38) + '...' : resp.name,
          String(resp.total),
          `${resp.percentage}%`,
        ],
      })),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Excel — General (HU27)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildGeneralExcelHtml(report: GeneralInventoryReport, generatedAt: Date) {
    return this.excel.build({
      title: 'Reporte general del inventario',
      generatedAt,
      metrics: [
        { label: 'Activos registrados',          value: report.assets.total    },
        { label: 'Materiales registrados',        value: report.materials.total },
        { label: 'Materiales con stock bajo',     value: report.materials.lowStock },
      ],
      tableTitle: 'Activos por estado',
      columns: [
        { label: 'Estado'       },
        { label: 'Cantidad',     numeric: true },
        { label: 'Participacion', numeric: true },
      ],
      rows: report.assets.byStatus.map((item) => {
        const pct = report.assets.total
          ? `${Math.round((item.quantity / report.assets.total) * 100)}%`
          : '0%';
        return { cells: [item.label, item.quantity, pct] };
      }),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Excel — Categoría (HU28)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildCategoryExcelHtml(report: CategoryReport, generatedAt: Date) {
    return this.excel.build({
      title: 'Reporte por categoria de activos',
      generatedAt,
      metrics: [
        { label: 'Total de categorias', value: report.categories.length },
        { label: 'Total de activos',    value: report.totalAssets       },
      ],
      tableTitle: 'Distribucion por categoria',
      columns: [
        { label: 'Categoria'      },
        { label: 'Total activos', numeric: true },
        { label: 'Participacion', numeric: true },
      ],
      rows: report.categories.map((cat) => ({
        cells: [cat.name, cat.total, `${cat.percentage}%`],
      })),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Excel — Responsable (HU47)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildResponsableExcelHtml(report: ResponsableReport, generatedAt: Date) {
    return this.excel.build({
      title: 'Reporte por responsable actual',
      generatedAt,
      metrics: [
        { label: 'Total de responsables',    value: report.responsables.length },
        { label: 'Total de activos asignados', value: report.totalAssets        },
      ],
      tableTitle: 'Distribucion por responsable',
      columns: [
        { label: 'Responsable'   },
        { label: 'Total activos', numeric: true },
        { label: 'Participacion', numeric: true },
      ],
      rows: report.responsables.map((resp) => ({
        cells: [resp.name, resp.total, `${resp.percentage}%`],
      })),
    });
  }

  private formatStatus(status: string) {
    const labels: Record<string, string> = {
      OPERATIVO: 'Operativo',
      MANTENIMIENTO: 'Mantenimiento',
      FUERA_DE_SERVICIO: 'Fuera de servicio',
      DADO_DE_BAJA: 'Dado de baja',
    };
    return labels[status] || status;
  }
}
