import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

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
   * Solo incluye usuarios que tienen al menos 1 activo asignado.
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
      downloadReady: responsables.length > 0,
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
      INNER JOIN activos a ON a."responsableActualId" = u.id
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
    const label = this.formatDate(generatedAt);
    const content = [
      this.pdfRect(0, 704, 612, 88, '0.06 0.10 0.18'),
      this.pdfRect(0, 704, 612, 5, '0.15 0.39 0.92'),
      this.pdfText('Reporte general del inventario', 48, 754, 22, '1 1 1'),
      this.pdfText('Sistema de Seguimiento de Activos', 48, 728, 10, '0.82 0.88 0.96'),
      this.pdfText(`Generado: ${label}`, 392, 728, 10, '0.82 0.88 0.96'),
      this.pdfText('Resumen ejecutivo', 48, 660, 16, '0.06 0.10 0.18'),
      this.pdfText(
        'Vista consolidada de activos, materiales y alertas de inventario.',
        48, 640, 10, '0.39 0.45 0.55',
      ),
      this.pdfMetricCard(48, 548, 150, 'Activos registrados', report.assets.total, '0.15 0.39 0.92'),
      this.pdfMetricCard(230, 548, 150, 'Materiales registrados', report.materials.total, '0.02 0.59 0.41'),
      this.pdfMetricCard(412, 548, 150, 'Stock bajo', report.materials.lowStock, '0.92 0.48 0.03'),
      this.pdfText('Activos por estado', 48, 500, 14, '0.06 0.10 0.18'),
      this.pdfRect(48, 465, 516, 26, '0.09 0.14 0.23'),
      this.pdfText('Estado', 62, 474, 10, '1 1 1'),
      this.pdfText('Cantidad', 474, 474, 10, '1 1 1'),
      ...report.assets.byStatus.flatMap((item, index) => {
        const y = 439 - index * 30;
        const background = index % 2 === 0 ? '0.97 0.98 1' : '1 1 1';
        return [
          this.pdfRect(48, y, 516, 30, background),
          this.pdfStrokeRect(48, y, 516, 30, '0.82 0.86 0.91'),
          this.pdfText(item.label, 62, y + 10, 10, '0.15 0.19 0.27'),
          this.pdfText(String(item.quantity), 500, y + 10, 10, '0.15 0.19 0.27'),
        ];
      }),
      this.pdfRect(48, 72, 516, 1, '0.82 0.86 0.91'),
      this.pdfText(
        'Reporte generado automaticamente desde el microservicio de Reportes y Exportacion.',
        48, 50, 8, '0.45 0.50 0.58',
      ),
    ].join('\n');

    return this.createSimplePdf(content);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF — Categoría (HU28)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildCategoryPdf(report: CategoryReport, generatedAt: Date) {
    const label = this.formatDate(generatedAt);
    const cats = report.categories;

    const header = [
      this.pdfRect(0, 704, 612, 88, '0.06 0.10 0.18'),
      this.pdfRect(0, 704, 612, 5, '0.15 0.39 0.92'),
      this.pdfText('Reporte por categoria de activos', 48, 754, 20, '1 1 1'),
      this.pdfText('Sistema de Seguimiento de Activos', 48, 728, 10, '0.82 0.88 0.96'),
      this.pdfText(`Generado: ${label}`, 392, 728, 10, '0.82 0.88 0.96'),
      this.pdfText('Distribucion de activos por categoria', 48, 660, 14, '0.06 0.10 0.18'),
      this.pdfText(
        `Total categorias: ${cats.length}  |  Total activos: ${report.totalAssets}`,
        48, 640, 10, '0.39 0.45 0.55',
      ),
      this.pdfRect(48, 610, 516, 24, '0.09 0.14 0.23'),
      this.pdfText('Categoria', 62, 618, 9, '1 1 1'),
      this.pdfText('Total activos', 360, 618, 9, '1 1 1'),
      this.pdfText('Participacion', 460, 618, 9, '1 1 1'),
    ];

    const rows = cats.flatMap((cat, i) => {
      const y = 586 - i * 24;
      if (y < 80) return [];
      const bg = i % 2 === 0 ? '0.97 0.98 1' : '1 1 1';
      const nombre = cat.name.length > 40 ? cat.name.slice(0, 40) + '...' : cat.name;
      return [
        this.pdfRect(48, y, 516, 24, bg),
        this.pdfStrokeRect(48, y, 516, 24, '0.82 0.86 0.91'),
        this.pdfText(nombre, 62, y + 7, 9, '0.15 0.19 0.27'),
        this.pdfText(String(cat.total), 385, y + 7, 9, '0.15 0.19 0.27'),
        this.pdfText(`${cat.percentage}%`, 474, y + 7, 9, '0.15 0.39 0.92'),
      ];
    });

    const footer = [
      this.pdfRect(48, 72, 516, 1, '0.82 0.86 0.91'),
      this.pdfText(
        'Reporte generado automaticamente desde el microservicio de Reportes y Exportacion.',
        48, 50, 8, '0.45 0.50 0.58',
      ),
    ];

    return this.createSimplePdf([...header, ...rows, ...footer].join('\n'));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF — Responsable (HU47)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildResponsablePdf(report: ResponsableReport, generatedAt: Date) {
    const label = this.formatDate(generatedAt);
    const resps = report.responsables;

    const header = [
      this.pdfRect(0, 704, 612, 88, '0.06 0.10 0.18'),
      this.pdfRect(0, 704, 612, 5, '0.15 0.39 0.92'),
      this.pdfText('Reporte por responsable actual', 48, 754, 20, '1 1 1'),
      this.pdfText('Sistema de Seguimiento de Activos', 48, 728, 10, '0.82 0.88 0.96'),
      this.pdfText(`Generado: ${label}`, 392, 728, 10, '0.82 0.88 0.96'),
      this.pdfText('Activos agrupados por responsable actual', 48, 660, 14, '0.06 0.10 0.18'),
      this.pdfText(
        `Total responsables: ${resps.length}  |  Total activos: ${report.totalAssets}`,
        48, 640, 10, '0.39 0.45 0.55',
      ),
      this.pdfRect(48, 610, 516, 24, '0.09 0.14 0.23'),
      this.pdfText('Responsable', 62, 618, 9, '1 1 1'),
      this.pdfText('Total activos', 360, 618, 9, '1 1 1'),
      this.pdfText('Participacion', 460, 618, 9, '1 1 1'),
    ];

    const rows = resps.flatMap((resp, i) => {
      const y = 586 - i * 24;
      if (y < 80) return [];
      const bg = i % 2 === 0 ? '0.97 0.98 1' : '1 1 1';
      const nombre = resp.name.length > 38 ? resp.name.slice(0, 38) + '...' : resp.name;
      return [
        this.pdfRect(48, y, 516, 24, bg),
        this.pdfStrokeRect(48, y, 516, 24, '0.82 0.86 0.91'),
        this.pdfText(nombre, 62, y + 7, 9, '0.15 0.19 0.27'),
        this.pdfText(String(resp.total), 385, y + 7, 9, '0.15 0.19 0.27'),
        this.pdfText(`${resp.percentage}%`, 474, y + 7, 9, '0.15 0.39 0.92'),
      ];
    });

    const footer = [
      this.pdfRect(48, 72, 516, 1, '0.82 0.86 0.91'),
      this.pdfText(
        'Reporte generado automaticamente desde el microservicio de Reportes y Exportacion.',
        48, 50, 8, '0.45 0.50 0.58',
      ),
    ];

    return this.createSimplePdf([...header, ...rows, ...footer].join('\n'));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Excel — General (HU27)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildGeneralExcelHtml(report: GeneralInventoryReport, generatedAt: Date) {
    const label = this.formatDate(generatedAt);
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; background: #f5f7fb; color: #111827; font-family: Arial, Helvetica, sans-serif; }
      .sheet { width: 100%; border-collapse: collapse; }
      .hero { background: #111827; color: #ffffff; font-size: 28px; font-weight: 700; padding: 24px 28px 8px; }
      .subtitle { background: #111827; color: #cbd5e1; padding: 0 28px 24px; font-size: 12px; }
      .section-title { color: #111827; font-size: 16px; font-weight: 700; padding: 22px 28px 10px; }
      .metric { background: #ffffff; border: 1px solid #d9e2ef; padding: 16px; }
      .metric-label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
      .metric-value { color: #0f172a; font-size: 26px; font-weight: 700; padding-top: 8px; }
      .table { width: 100%; border-collapse: collapse; margin: 0 28px 22px; }
      .table th { background: #1e293b; color: #ffffff; border: 1px solid #1e293b; padding: 10px 12px; text-align: left; }
      .table td { background: #ffffff; border: 1px solid #d9e2ef; padding: 10px 12px; }
      .table .number { text-align: right; font-weight: 700; }
      .footer { color: #64748b; font-size: 11px; padding: 14px 28px 22px; }
    </style>
  </head>
  <body>
    <table class="sheet">
      <tr><td colspan="6" class="hero">Reporte general del inventario</td></tr>
      <tr><td colspan="6" class="subtitle">Sistema de Seguimiento de Activos | Generado: ${this.escapeHtml(label)}</td></tr>
      <tr><td colspan="6" class="section-title">Resumen ejecutivo</td></tr>
      <tr>
        <td class="metric" colspan="2"><div class="metric-label">Activos registrados</div><div class="metric-value">${report.assets.total}</div></td>
        <td class="metric" colspan="2"><div class="metric-label">Materiales registrados</div><div class="metric-value">${report.materials.total}</div></td>
        <td class="metric" colspan="2"><div class="metric-label">Materiales con stock bajo</div><div class="metric-value">${report.materials.lowStock}</div></td>
      </tr>
      <tr><td colspan="6" class="section-title">Activos por estado</td></tr>
    </table>
    <table class="table">
      <thead><tr><th>Estado</th><th>Cantidad</th><th>Participacion</th></tr></thead>
      <tbody>
        ${report.assets.byStatus.map((item) => {
          const pct = report.assets.total
            ? `${Math.round((item.quantity / report.assets.total) * 100)}%`
            : '0%';
          return `<tr><td>${this.escapeHtml(item.label)}</td><td class="number">${item.quantity}</td><td class="number">${pct}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
    <table class="sheet">
      <tr><td colspan="6" class="footer">Reporte generado automaticamente desde el microservicio de Reportes y Exportacion.</td></tr>
    </table>
  </body>
</html>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Excel — Categoría (HU28)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildCategoryExcelHtml(report: CategoryReport, generatedAt: Date) {
    const label = this.formatDate(generatedAt);
    const rows = report.categories
      .map((cat) =>
        `<tr>
          <td>${this.escapeHtml(cat.name)}</td>
          <td class="number">${cat.total}</td>
          <td class="number">${cat.percentage}%</td>
        </tr>`,
      )
      .join('');

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; background: #f5f7fb; color: #111827; font-family: Arial, Helvetica, sans-serif; }
      .sheet { width: 100%; border-collapse: collapse; }
      .hero { background: #111827; color: #ffffff; font-size: 24px; font-weight: 700; padding: 24px 28px 8px; }
      .subtitle { background: #111827; color: #cbd5e1; padding: 0 28px 24px; font-size: 12px; }
      .section-title { color: #111827; font-size: 15px; font-weight: 700; padding: 20px 28px 10px; }
      .metric { background: #ffffff; border: 1px solid #d9e2ef; padding: 16px; }
      .metric-label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
      .metric-value { color: #0f172a; font-size: 26px; font-weight: 700; padding-top: 6px; }
      .table { width: calc(100% - 56px); border-collapse: collapse; margin: 0 28px 22px; }
      .table th { background: #1e293b; color: #ffffff; border: 1px solid #1e293b; padding: 10px 12px; text-align: left; font-size: 12px; }
      .table td { background: #ffffff; border: 1px solid #d9e2ef; padding: 10px 12px; font-size: 12px; }
      .number { text-align: right; font-weight: 700; }
      .footer { color: #64748b; font-size: 11px; padding: 14px 28px 22px; }
    </style>
  </head>
  <body>
    <table class="sheet">
      <tr><td colspan="3" class="hero">Reporte por categoria de activos</td></tr>
      <tr><td colspan="3" class="subtitle">Sistema de Seguimiento de Activos | Generado: ${this.escapeHtml(label)}</td></tr>
      <tr>
        <td class="metric"><div class="metric-label">Total de categorias</div><div class="metric-value">${report.categories.length}</div></td>
        <td class="metric" colspan="2"><div class="metric-label">Total de activos</div><div class="metric-value">${report.totalAssets}</div></td>
      </tr>
      <tr><td colspan="3" class="section-title">Distribucion por categoria</td></tr>
    </table>
    <table class="table">
      <thead><tr><th>Categoria</th><th>Total activos</th><th>Participacion</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="sheet">
      <tr><td colspan="3" class="footer">Reporte generado automaticamente desde el microservicio de Reportes y Exportacion.</td></tr>
    </table>
  </body>
</html>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Excel — Responsable (HU47)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildResponsableExcelHtml(report: ResponsableReport, generatedAt: Date) {
    const label = this.formatDate(generatedAt);
    const rows = report.responsables
      .map((resp) =>
        `<tr>
          <td>${this.escapeHtml(resp.name)}</td>
          <td class="number">${resp.total}</td>
          <td class="number">${resp.percentage}%</td>
        </tr>`,
      )
      .join('');

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; background: #f5f7fb; color: #111827; font-family: Arial, Helvetica, sans-serif; }
      .sheet { width: 100%; border-collapse: collapse; }
      .hero { background: #111827; color: #ffffff; font-size: 24px; font-weight: 700; padding: 24px 28px 8px; }
      .subtitle { background: #111827; color: #cbd5e1; padding: 0 28px 24px; font-size: 12px; }
      .section-title { color: #111827; font-size: 15px; font-weight: 700; padding: 20px 28px 10px; }
      .metric { background: #ffffff; border: 1px solid #d9e2ef; padding: 16px; }
      .metric-label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
      .metric-value { color: #0f172a; font-size: 26px; font-weight: 700; padding-top: 6px; }
      .table { width: calc(100% - 56px); border-collapse: collapse; margin: 0 28px 22px; }
      .table th { background: #1e293b; color: #ffffff; border: 1px solid #1e293b; padding: 10px 12px; text-align: left; font-size: 12px; }
      .table td { background: #ffffff; border: 1px solid #d9e2ef; padding: 10px 12px; font-size: 12px; }
      .number { text-align: right; font-weight: 700; }
      .footer { color: #64748b; font-size: 11px; padding: 14px 28px 22px; }
    </style>
  </head>
  <body>
    <table class="sheet">
      <tr><td colspan="3" class="hero">Reporte por responsable actual</td></tr>
      <tr><td colspan="3" class="subtitle">Sistema de Seguimiento de Activos | Generado: ${this.escapeHtml(label)}</td></tr>
      <tr>
        <td class="metric"><div class="metric-label">Total de responsables</div><div class="metric-value">${report.responsables.length}</div></td>
        <td class="metric" colspan="2"><div class="metric-label">Total de activos asignados</div><div class="metric-value">${report.totalAssets}</div></td>
      </tr>
      <tr><td colspan="3" class="section-title">Distribucion por responsable</td></tr>
    </table>
    <table class="table">
      <thead><tr><th>Responsable</th><th>Total activos</th><th>Participacion</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="sheet">
      <tr><td colspan="3" class="footer">Reporte generado automaticamente desde el microservicio de Reportes y Exportacion.</td></tr>
    </table>
  </body>
</html>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private createSimplePdf(content: string) {
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream\nendobj\n`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += object;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    pdf += offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
      .join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'latin1');
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/La_Paz',
    }).format(date);
  }

  private escapePdfText(text: string) {
    return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  private pdfText(text: string, x: number, y: number, size: number, color: string) {
    return [
      'BT',
      `${color} rg`,
      '/F1 ' + size + ' Tf',
      `${x} ${y} Td`,
      `(${this.escapePdfText(text)}) Tj`,
      'ET',
    ].join('\n');
  }

  private pdfRect(x: number, y: number, width: number, height: number, color: string) {
    return `q\n${color} rg\n${x} ${y} ${width} ${height} re\nf\nQ`;
  }

  private pdfStrokeRect(x: number, y: number, width: number, height: number, color: string) {
    return `q\n${color} RG\n0.75 w\n${x} ${y} ${width} ${height} re\nS\nQ`;
  }

  private pdfMetricCard(
    x: number, y: number, width: number,
    label: string, value: number, accentColor: string,
  ) {
    return [
      this.pdfRect(x, y, width, 78, '1 1 1'),
      this.pdfStrokeRect(x, y, width, 78, '0.82 0.86 0.91'),
      this.pdfRect(x, y + 74, width, 4, accentColor),
      this.pdfText(label, x + 14, y + 48, 9, '0.39 0.45 0.55'),
      this.pdfText(String(value), x + 14, y + 18, 24, '0.06 0.10 0.18'),
    ].join('\n');
  }

  private escapeHtml(text: string) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
