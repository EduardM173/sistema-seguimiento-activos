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

// HU-AREA — Resumen agrupado por área
type AreaSummaryRow = {
  area_id: string;
  area_nombre: string;
  cantidad: string;
};

// HU-AREA — Detalle activos de área seleccionada
type AreaAssetDetailRow = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  ubicacion: string | null;
  responsable: string | null;
};

// HU-AREA — Todos los activos con su área (para PDF/Excel completo)
type AreaAllAssetsRow = {
  area_nombre: string;
  codigo: string;
  nombre: string;
  estado: string;
  ubicacion: string | null;
  responsable: string | null;
};

// HU-UBICACION — Resumen agrupado por ubicación
type UbicacionSummaryRow = {
  ubicacion_id: string;
  ubicacion_nombre: string;
  cantidad: string;
};

// HU-UBICACION — Detalle activos de ubicación seleccionada
type UbicacionAssetDetailRow = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  area: string | null;
  responsable: string | null;
};

// HU-UBICACION — Todos los activos con su ubicación (para PDF/Excel completo)
type UbicacionAllAssetsRow = {
  ubicacion_nombre: string;
  codigo: string;
  nombre: string;
  estado: string;
  area: string | null;
  responsable: string | null;
};

type ReportFormat = 'pdf' | 'excel';

type GeneralInventoryReport = Awaited<
  ReturnType<ReportsService['getGeneralInventoryReport']>
>;

type CategoryReport = Awaited<ReturnType<ReportsService['getCategoryReport']>>;

type MovementReportRow = {
  id: string;
  tipo: string;
  creado_en: Date;
  detalle: string | null;
  activo_codigo: string;
  activo_nombre: string;
  area_origen_nombre: string | null;
  area_destino_nombre: string | null;
  realizado_por_nombres: string;
  realizado_por_apellidos: string;
};

type MovementReportParams = {
  fechaDesde?: string;
  fechaHasta?: string;
  tipo?: string;
};

type MovementReportResponse = {
  generatedAt: string;
  filters: {
    fechaDesde: string;
    fechaHasta: string;
    tipo: string | null;
  };
  totalMovimientos: number;
  movements: Array<{
    id: string;
    tipo: string;
    tipoLabel: string;
    fecha: string;
    activo: {
      codigo: string;
      nombre: string;
    };
    areaOrigen: string | null;
    areaDestino: string | null;
    realizadoPor: string;
    detalle: string | null;
  }>;
  downloadReady: boolean;
};

type ResponsableReport = Awaited<ReturnType<ReportsService['getResponsableReport']>>;

type AreaReport = Awaited<ReturnType<ReportsService['getAreaReport']>>;

type UbicacionReport = Awaited<ReturnType<ReportsService['getUbicacionReport']>>;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  private readonly assetStatuses = [
    'OPERATIVO',
    'MANTENIMIENTO',
    'FUERA_DE_SERVICIO',
    'DADO_DE_BAJA',
  ];

  private readonly movementTypes = [
    'REGISTRO',
    'ASIGNACION',
    'TRANSFERENCIA',
    'DEVOLUCION',
    'BAJA',
    'ACTUALIZACION',
    'INCIDENTE',
  ] as const;

  private readonly pdf = new PdfBuilder();
  private readonly excel = new ExcelBuilder();

  constructor(private readonly database: DatabaseService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // HU45 — Reporte de movimientos de activos
  // ═══════════════════════════════════════════════════════════════════════════

  async getMovementsReport(params: MovementReportParams): Promise<MovementReportResponse> {
    const fechaHasta = this.normalizeDateParam(params.fechaHasta) ?? this.endOfToday();
    const fechaDesde = this.normalizeDateParam(params.fechaDesde) ?? this.startOfMonth(fechaHasta);

    if (fechaDesde > fechaHasta) {
      throw new BadRequestException('La fecha inicial no puede ser mayor que la fecha final');
    }

    const tipoFilter = params.tipo?.trim() || null;

    if (tipoFilter && !this.movementTypes.includes(tipoFilter as (typeof this.movementTypes)[number])) {
      throw new BadRequestException('Tipo de movimiento no soportado');
    }

    const queryParams: unknown[] = [fechaDesde, fechaHasta];
    let tipoClause = '';

    if (tipoFilter) {
      queryParams.push(tipoFilter);
      tipoClause = 'AND m.tipo = $3::"TipoMovimientoActivo"';
    }

    const result = await this.database.query<MovementReportRow>(`
      SELECT
        m.id,
        m.tipo,
        m."creadoEn" AS creado_en,
        m.detalle,
        a.codigo AS activo_codigo,
        a.nombre AS activo_nombre,
        ao.nombre AS area_origen_nombre,
        ad.nombre AS area_destino_nombre,
        rp.nombres AS realizado_por_nombres,
        rp.apellidos AS realizado_por_apellidos
      FROM movimientos_activos m
      INNER JOIN activos a ON a.id = m."activoId"
      LEFT JOIN areas ao ON ao.id = m."areaOrigenId"
      LEFT JOIN areas ad ON ad.id = m."areaDestinoId"
      INNER JOIN usuarios rp ON rp.id = m."realizadoPorId"
      WHERE m."creadoEn"::date BETWEEN $1::date AND $2::date
      ${tipoClause}
      ORDER BY m."creadoEn" DESC, m.id DESC
    `, queryParams);

    const movements = result.rows.map((row) => ({
      id: row.id,
      tipo: row.tipo,
      tipoLabel: this.formatMovementType(row.tipo),
      fecha: row.creado_en.toISOString(),
      activo: {
        codigo: row.activo_codigo,
        nombre: row.activo_nombre,
      },
      areaOrigen: row.area_origen_nombre,
      areaDestino: row.area_destino_nombre,
      realizadoPor: `${row.realizado_por_nombres} ${row.realizado_por_apellidos}`,
      detalle: row.detalle,
    }));

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        fechaDesde: this.formatDateOnly(fechaDesde),
        fechaHasta: this.formatDateOnly(fechaHasta),
        tipo: tipoFilter,
      },
      totalMovimientos: movements.length,
      movements,
      downloadReady: movements.length > 0,
    };
  }

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

    const assetsTotal = assetsByStatus.reduce((sum, item) => sum + item.quantity, 0);

    return {
      generatedAt: new Date().toISOString(),
      assets: {
        byStatus: assetsByStatus,
        total: assetsTotal,
      },
      materials: {
        total: totalMaterials,
        lowStock: lowStockMaterials,
      },
      downloadReady: assetsTotal > 0 || totalMaterials > 0,
    };
  }

  async generateGeneralInventoryFile(format: ReportFormat, generatedById?: string) {
    if (!['pdf', 'excel'].includes(format)) {
      throw new BadRequestException('Formato de reporte no soportado');
    }

    if (!generatedById) {
      throw new BadRequestException('Usuario generador requerido para registrar el reporte');
    }

    const report = await this.getGeneralInventoryReport();

    if (!this.hasDownloadableData(report)) {
      throw new NotFoundException('No hay informacion disponible para descargar');
    }

    const generatedAt = new Date();
    const filename = this.buildFilename('reporte-general-inventario', format, generatedAt);

    await this.registerGeneratedReport(
      format,
      generatedById,
      generatedAt,
      'Reporte general del inventario',
      'inventario_general',
    );

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

  async generateCategoryReportFile(
    format: ReportFormat,
    generatedById?: string,
    categoryId?: string,
  ) {
    if (!['pdf', 'excel'].includes(format)) {
      throw new BadRequestException('Formato de reporte no soportado');
    }

    if (!generatedById) {
      throw new BadRequestException('Usuario generador requerido para registrar el reporte');
    }

    const report = await this.getCategoryReport();

    if (categoryId) {
      const matchedCategory = report.categories.find((category) => category.id === categoryId);

      if (!matchedCategory) {
        throw new NotFoundException('Categoria no encontrada');
      }

      report.categories = [matchedCategory];
      report.totalAssets = matchedCategory.total;
      report.downloadReady = matchedCategory.total > 0;
    }

    if (!report.downloadReady) {
      throw new NotFoundException('No hay informacion disponible para descargar');
    }

    const generatedAt = new Date();
    const filename = this.buildFilename('reporte-por-categoria', format, generatedAt);

    await this.registerGeneratedReport(
      format,
      generatedById,
      generatedAt,
      'Reporte por categoria de activos',
      'categoria_activos',
    );

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
  async generateResponsableReportFile(
    format: ReportFormat,
    generatedById?: string,
    responsableId?: string,
  ) {
    if (!['pdf', 'excel'].includes(format)) {
      throw new BadRequestException('Formato de reporte no soportado');
    }

    if (!generatedById) {
      throw new BadRequestException('Usuario generador requerido para registrar el reporte');
    }

    const report = await this.getResponsableReport();

    if (responsableId) {
      const matchedResponsable = report.responsables.find(
        (responsable) => responsable.id === responsableId,
      );

      if (!matchedResponsable) {
        throw new NotFoundException('Responsable no encontrado');
      }

      report.responsables = [matchedResponsable];
      report.totalAssets = matchedResponsable.total;
      report.downloadReady = matchedResponsable.total > 0;
    }

    if (!report.downloadReady) {
      throw new NotFoundException('No hay informacion disponible para descargar');
    }

    const generatedAt = new Date();
    const filename = this.buildFilename('reporte-por-responsable', format, generatedAt);

    await this.registerGeneratedReport(
      format,
      generatedById,
      generatedAt,
      'Reporte por responsable actual',
      'responsable_activos',
    );

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
      throw new BadRequestException('Usuario generador no encontrado');
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

  // ═══════════════════════════════════════════════════════════════════════════
  // HU-AREA — Reporte por área o departamento
  // ═══════════════════════════════════════════════════════════════════════════

  /** PA1 — Cantidad de activos agrupados por área */
  async getAreaReport() {
    const summaries = await this.getAreaSummaries();

    const totalAssets = summaries.reduce((sum, r) => sum + Number(r.cantidad), 0);

    const areas = summaries.map((r) => ({
      id: r.area_id,
      name: r.area_nombre,
      total: Number(r.cantidad),
      percentage:
        totalAssets > 0 ? Math.round((Number(r.cantidad) / totalAssets) * 100) : 0,
    }));

    return {
      generatedAt: new Date().toISOString(),
      totalAssets,
      areas,
      downloadReady: totalAssets > 0,
    };
  }

  /** PA2/PA3/PA4/PA5 — Activos de un área seleccionada */
  async getAreaAssets(areaId: string) {
    const areaResult = await this.database.query<{ id: string; nombre: string }>(
      `SELECT id, nombre FROM areas WHERE id = $1`,
      [areaId],
    );

    if (!areaResult.rows.length) {
      throw new NotFoundException('Area no encontrada');
    }

    const area = areaResult.rows[0];

    const result = await this.database.query<AreaAssetDetailRow>(
      `
      SELECT
        a.id,
        a.codigo,
        a.nombre,
        a.estado,
        u.nombre                                   AS ubicacion,
        CONCAT(usr.nombres, ' ', usr.apellidos)    AS responsable
      FROM activos a
      LEFT JOIN ubicaciones u   ON u.id   = a."ubicacionId"
      LEFT JOIN usuarios    usr ON usr.id = a."responsableActualId"
      WHERE a."areaActualId" = $1
      ORDER BY a.nombre ASC
      `,
      [areaId],
    );

    return {
      areaId: area.id,
      areaName: area.nombre,
      assets: result.rows.map((row) => ({
        id: row.id,
        codigo: row.codigo,
        nombre: row.nombre,
        estado: row.estado,
        estadoLabel: this.formatStatus(row.estado),
        ubicacion: row.ubicacion ?? 'Sin ubicacion',
        responsable: row.responsable ?? 'Sin responsable',
      })),
      total: result.rows.length,
    };
  }

  /** Genera PDF o Excel del resumen por área para descarga */
  async generateAreaReportFile(
    format: ReportFormat,
    generatedById?: string,
    areaId?: string,
  ) {
    if (!['pdf', 'excel'].includes(format)) {
      throw new BadRequestException('Formato de reporte no soportado');
    }

    const [report, allAssetsRaw] = await Promise.all([
      this.getAreaReport(),
      this.getAllAreaAssetsForReport(),
    ]);

    if (!report.downloadReady) {
      throw new NotFoundException('No hay informacion disponible para descargar');
    }

    // Si se especifica un área, filtrar el reporte a esa área solamente
    if (areaId) {
      const matchedArea = report.areas.find((a) => a.id === areaId);
      if (!matchedArea) {
        throw new NotFoundException('Area no encontrada');
      }
      report.areas = [matchedArea];
      report.totalAssets = matchedArea.total;
      // Normalizar participación a 100 % cuando es solo un área
      matchedArea.percentage = 100;
    }

    const allAssets = allAssetsRaw
      .map((row) => ({
        areaNombre: row.area_nombre,
        codigo: row.codigo,
        nombre: row.nombre,
        estado: row.estado,
        estadoLabel: this.formatStatus(row.estado),
        ubicacion: row.ubicacion ?? 'Sin ubicacion',
        responsable: row.responsable ?? 'Sin responsable',
      }))
      // Si hay filtro de área, conservar solo los activos de esa área
      .filter((a) =>
        areaId ? report.areas.some((ra) => ra.name === a.areaNombre) : true,
      );

    const generatedAt = new Date();
    const filename = this.buildFilename('reporte-por-area', format, generatedAt);

    if (generatedById) {
      await this.registerGeneratedReport(
        format,
        generatedById,
        generatedAt,
        'Reporte por area o departamento',
        'dispersion_activos',
      );
    }

    if (format === 'pdf') {
      return {
        filename,
        contentType: 'application/pdf',
        buffer: this.buildAreaPdf(report, allAssets, generatedAt),
      };
    }

    return {
      filename,
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      buffer: Buffer.from(this.buildAreaExcelHtml(report, allAssets, generatedAt), 'utf8'),
    };
  }

  private async getAreaSummaries() {
    const result = await this.database.query<AreaSummaryRow>(`
      SELECT
        ar.id              AS area_id,
        ar.nombre          AS area_nombre,
        COUNT(a.id)::text  AS cantidad
      FROM areas ar
      LEFT JOIN activos a ON a."areaActualId" = ar.id
      GROUP BY ar.id, ar.nombre
      ORDER BY ar.nombre ASC
    `);
    return result.rows;
  }

  private async getAllAreaAssetsForReport() {
    const result = await this.database.query<AreaAllAssetsRow>(`
      SELECT
        ar.nombre                                  AS area_nombre,
        a.codigo,
        a.nombre,
        a.estado,
        u.nombre                                   AS ubicacion,
        CONCAT(usr.nombres, ' ', usr.apellidos)    AS responsable
      FROM activos a
      JOIN  areas       ar  ON ar.id  = a."areaActualId"
      LEFT JOIN ubicaciones u   ON u.id   = a."ubicacionId"
      LEFT JOIN usuarios    usr ON usr.id = a."responsableActualId"
      ORDER BY ar.nombre ASC, a.nombre ASC
    `);
    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF — Área (HU-AREA)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildAreaPdf(
    report: AreaReport,
    assets: Array<{
      areaNombre: string;
      codigo: string;
      nombre: string;
      estadoLabel: string;
      ubicacion: string;
      responsable: string;
    }>,
    generatedAt: Date,
  ) {
    // Agrupar activos por área, manteniendo el orden de las áreas del resumen
    const areaOrder = report.areas.map((a) => a.name);
    const byArea = new Map<string, typeof assets>();
    for (const asset of assets) {
      const list = byArea.get(asset.areaNombre) ?? [];
      list.push(asset);
      byArea.set(asset.areaNombre, list);
    }

    const areaDetails = areaOrder
      .filter((name) => (byArea.get(name)?.length ?? 0) > 0)
      .map((name) => ({
        areaName: name,
        assets: (byArea.get(name) ?? []).map((a) => ({
          codigo: a.codigo,
          nombre: a.nombre,
          estadoLabel: a.estadoLabel,
          ubicacion: a.ubicacion,
          responsable: a.responsable,
        })),
      }));

    return this.pdf.buildAreaReport({
      generatedAt,
      totalAreas: report.areas.length,
      totalAssets: report.totalAssets,
      areas: report.areas,
      areaDetails,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Excel — Área (HU-AREA)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildAreaExcelHtml(
    report: AreaReport,
    assets: Array<{
      areaNombre: string;
      codigo: string;
      nombre: string;
      estadoLabel: string;
      ubicacion: string;
      responsable: string;
    }>,
    generatedAt: Date,
  ) {
    const dateLabel = new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(generatedAt);

    const esc = (s: string | number) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const TH = 'background:#1e293b; color:#fff; border:1px solid #1e293b; padding:9px 12px; text-align:left; font-size:12px;';
    const TD = 'background:#fff; border:1px solid #d9e2ef; padding:9px 12px; font-size:12px;';

    // ── Resumen por área ────────────────────────────────────────────────────
    const summaryRows = report.areas
      .map(
        (a) =>
          `<tr>
            <td style="${TD}">${esc(a.name)}</td>
            <td style="${TD} text-align:right; font-weight:700">${a.total}</td>
            <td style="${TD} text-align:right">${a.percentage}%</td>
          </tr>`,
      )
      .join('');

    // ── Detalle agrupado por área ───────────────────────────────────────────
    const areaNames = [...new Set(assets.map((a) => a.areaNombre))];

    const detailSections = areaNames
      .map((areaName) => {
        const areaAssets = assets.filter((a) => a.areaNombre === areaName);
        const assetRows = areaAssets
          .map(
            (a) =>
              `<tr>
                <td style="${TD} font-family:monospace; font-size:11px; color:#64748b">${esc(a.codigo)}</td>
                <td style="${TD}">${esc(a.nombre)}</td>
                <td style="${TD}">${esc(a.estadoLabel)}</td>
                <td style="${TD} color:#64748b">${esc(a.ubicacion)}</td>
                <td style="${TD} color:#64748b">${esc(a.responsable)}</td>
              </tr>`,
          )
          .join('');
        return `
          <tr><td colspan="5" style="background:#1e293b; color:#fff; font-size:13px; font-weight:700; padding:10px 12px">${esc(areaName)}</td></tr>
          <tr style="background:#334155">
            <th style="${TH}">Codigo</th>
            <th style="${TH}">Nombre</th>
            <th style="${TH}">Estado</th>
            <th style="${TH}">Ubicacion</th>
            <th style="${TH}">Responsable</th>
          </tr>
          ${assetRows}
          <tr><td colspan="5" style="padding:6px"></td></tr>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="UTF-8" /><title>Reporte por area</title></head>
<body style="margin:0; background:#f5f7fb; font-family:Arial,Helvetica,sans-serif; color:#111827">

  <!-- Header -->
  <table width="100%" cellspacing="0" cellpadding="0">
    <tr><td style="background:#111827; color:#fff; font-size:22px; font-weight:700; padding:22px 28px 6px">Reporte por area o departamento</td></tr>
    <tr><td style="background:#111827; color:#cbd5e1; font-size:12px; padding:0 28px 20px">Sistema de Seguimiento de Activos | Generado: ${esc(dateLabel)}</td></tr>
  </table>

  <!-- Metricas -->
  <table width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0">
    <tr>
      <td width="28"></td>
      <td style="background:#fff; border:1px solid #d9e2ef; padding:16px; width:200px">
        <div style="color:#64748b; font-size:11px; font-weight:700; text-transform:uppercase">Total de areas</div>
        <div style="color:#0f172a; font-size:26px; font-weight:700; padding-top:6px">${report.areas.length}</div>
      </td>
      <td width="16"></td>
      <td style="background:#fff; border:1px solid #d9e2ef; padding:16px; width:200px">
        <div style="color:#64748b; font-size:11px; font-weight:700; text-transform:uppercase">Total de activos</div>
        <div style="color:#0f172a; font-size:26px; font-weight:700; padding-top:6px">${report.totalAssets}</div>
      </td>
      <td></td>
    </tr>
  </table>

  <!-- Resumen por area -->
  <p style="color:#111827; font-size:14px; font-weight:700; padding:12px 28px 8px; margin:0">Resumen por area</p>
  <table width="calc(100% - 56px)" cellspacing="0" cellpadding="0" style="margin:0 28px 24px; border-collapse:collapse">
    <tr style="background:#1e293b">
      <th style="${TH}">Area / Departamento</th>
      <th style="${TH} text-align:right">Total activos</th>
      <th style="${TH} text-align:right">Participacion</th>
    </tr>
    ${summaryRows}
  </table>

  <!-- Detalle por area -->
  <p style="color:#111827; font-size:14px; font-weight:700; padding:12px 28px 8px; margin:0">Detalle de activos por area</p>
  <table width="calc(100% - 56px)" cellspacing="0" cellpadding="0" style="margin:0 28px 28px; border-collapse:collapse">
    ${detailSections}
  </table>

  <!-- Footer -->
  <p style="color:#64748b; font-size:11px; padding:12px 28px 22px; margin:0">
    Reporte generado automaticamente desde el microservicio de Reportes y Exportacion.
  </p>

</body></html>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HU-UBICACION — Reporte por ubicación
  // ═══════════════════════════════════════════════════════════════════════════

  /** PA1 — Cantidad de activos agrupados por ubicación */
  async getUbicacionReport() {
    const summaries = await this.getUbicacionSummaries();

    const totalAssets = summaries.reduce((sum, r) => sum + Number(r.cantidad), 0);

    const ubicaciones = summaries.map((r) => ({
      id: r.ubicacion_id,
      name: r.ubicacion_nombre,
      total: Number(r.cantidad),
      percentage:
        totalAssets > 0 ? Math.round((Number(r.cantidad) / totalAssets) * 100) : 0,
    }));

    return {
      generatedAt: new Date().toISOString(),
      totalAssets,
      ubicaciones,
      downloadReady: totalAssets > 0,
    };
  }

  /** PA2/PA3/PA4/PA5 — Activos de una ubicación seleccionada */
  async getUbicacionAssets(ubicacionId: string) {
    const ubicResult = await this.database.query<{ id: string; nombre: string }>(
      `SELECT id, nombre FROM ubicaciones WHERE id = $1`,
      [ubicacionId],
    );

    if (!ubicResult.rows.length) {
      throw new NotFoundException('Ubicacion no encontrada');
    }

    const ubicacion = ubicResult.rows[0];

    const result = await this.database.query<UbicacionAssetDetailRow>(
      `
      SELECT
        a.id,
        a.codigo,
        a.nombre,
        a.estado,
        ar.nombre                                  AS area,
        CONCAT(usr.nombres, ' ', usr.apellidos)    AS responsable
      FROM activos a
      LEFT JOIN areas       ar  ON ar.id  = a."areaActualId"
      LEFT JOIN usuarios    usr ON usr.id = a."responsableActualId"
      WHERE a."ubicacionId" = $1
      ORDER BY a.nombre ASC
      `,
      [ubicacionId],
    );

    return {
      ubicacionId: ubicacion.id,
      ubicacionName: ubicacion.nombre,
      assets: result.rows.map((row) => ({
        id: row.id,
        codigo: row.codigo,
        nombre: row.nombre,
        estado: row.estado,
        estadoLabel: this.formatStatus(row.estado),
        area: row.area ?? 'Sin area',
        responsable: row.responsable ?? 'Sin responsable',
      })),
      total: result.rows.length,
    };
  }

  /** Genera PDF o Excel del resumen por ubicación para descarga */
  async generateUbicacionReportFile(
    format: ReportFormat,
    generatedById?: string,
    ubicacionId?: string,
  ) {
    if (!['pdf', 'excel'].includes(format)) {
      throw new BadRequestException('Formato de reporte no soportado');
    }

    const [report, allAssetsRaw] = await Promise.all([
      this.getUbicacionReport(),
      this.getAllUbicacionAssetsForReport(),
    ]);

    if (!report.downloadReady) {
      throw new NotFoundException('No hay informacion disponible para descargar');
    }

    // Si se especifica una ubicación, filtrar el reporte a esa ubicación solamente
    if (ubicacionId) {
      const matched = report.ubicaciones.find((u) => u.id === ubicacionId);
      if (!matched) {
        throw new NotFoundException('Ubicacion no encontrada');
      }
      report.ubicaciones = [matched];
      report.totalAssets = matched.total;
      matched.percentage = 100;
    }

    const allAssets = allAssetsRaw
      .map((row) => ({
        ubicacionNombre: row.ubicacion_nombre,
        codigo: row.codigo,
        nombre: row.nombre,
        estado: row.estado,
        estadoLabel: this.formatStatus(row.estado),
        area: row.area ?? 'Sin area',
        responsable: row.responsable ?? 'Sin responsable',
      }))
      .filter((a) =>
        ubicacionId
          ? report.ubicaciones.some((u) => u.name === a.ubicacionNombre)
          : true,
      );

    const generatedAt = new Date();
    const filename = this.buildFilename('reporte-por-ubicacion', format, generatedAt);

    if (generatedById) {
      await this.registerGeneratedReport(
        format,
        generatedById,
        generatedAt,
        'Reporte por ubicacion',
        'dispersion_activos',
      );
    }

    if (format === 'pdf') {
      return {
        filename,
        contentType: 'application/pdf',
        buffer: this.buildUbicacionPdf(report, allAssets, generatedAt),
      };
    }

    return {
      filename,
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      buffer: Buffer.from(
        this.buildUbicacionExcelHtml(report, allAssets, generatedAt),
        'utf8',
      ),
    };
  }

  private async getUbicacionSummaries() {
    const result = await this.database.query<UbicacionSummaryRow>(`
      SELECT
        u.id               AS ubicacion_id,
        u.nombre           AS ubicacion_nombre,
        COUNT(a.id)::text  AS cantidad
      FROM ubicaciones u
      LEFT JOIN activos a ON a."ubicacionId" = u.id
      GROUP BY u.id, u.nombre
      ORDER BY u.nombre ASC
    `);
    return result.rows;
  }

  private async getAllUbicacionAssetsForReport() {
    const result = await this.database.query<UbicacionAllAssetsRow>(`
      SELECT
        u.nombre                                   AS ubicacion_nombre,
        a.codigo,
        a.nombre,
        a.estado,
        ar.nombre                                  AS area,
        CONCAT(usr.nombres, ' ', usr.apellidos)    AS responsable
      FROM activos a
      JOIN  ubicaciones u   ON u.id   = a."ubicacionId"
      LEFT JOIN areas       ar  ON ar.id  = a."areaActualId"
      LEFT JOIN usuarios    usr ON usr.id = a."responsableActualId"
      ORDER BY u.nombre ASC, a.nombre ASC
    `);
    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF — Ubicación (HU-UBICACION)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildUbicacionPdf(
    report: UbicacionReport,
    assets: Array<{
      ubicacionNombre: string;
      codigo: string;
      nombre: string;
      estadoLabel: string;
      area: string;
      responsable: string;
    }>,
    generatedAt: Date,
  ) {
    const ubicOrder = report.ubicaciones.map((u) => u.name);
    const byUbic = new Map<string, typeof assets>();
    for (const asset of assets) {
      const list = byUbic.get(asset.ubicacionNombre) ?? [];
      list.push(asset);
      byUbic.set(asset.ubicacionNombre, list);
    }

    const ubicDetails = ubicOrder
      .filter((name) => (byUbic.get(name)?.length ?? 0) > 0)
      .map((name) => ({
        ubicacionName: name,
        assets: (byUbic.get(name) ?? []).map((a) => ({
          codigo: a.codigo,
          nombre: a.nombre,
          estadoLabel: a.estadoLabel,
          area: a.area,
          responsable: a.responsable,
        })),
      }));

    return this.pdf.buildUbicacionReport({
      generatedAt,
      totalUbicaciones: report.ubicaciones.length,
      totalAssets: report.totalAssets,
      ubicaciones: report.ubicaciones,
      ubicacionDetails: ubicDetails,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Excel — Ubicación (HU-UBICACION)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildUbicacionExcelHtml(
    report: UbicacionReport,
    assets: Array<{
      ubicacionNombre: string;
      codigo: string;
      nombre: string;
      estadoLabel: string;
      area: string;
      responsable: string;
    }>,
    generatedAt: Date,
  ) {
    const dateLabel = new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(generatedAt);

    const esc = (s: string | number) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const TH =
      'background:#1e293b; color:#fff; border:1px solid #1e293b; padding:9px 12px; text-align:left; font-size:12px;';
    const TD = 'background:#fff; border:1px solid #d9e2ef; padding:9px 12px; font-size:12px;';

    const summaryRows = report.ubicaciones
      .map(
        (u) =>
          `<tr>
            <td style="${TD}">${esc(u.name)}</td>
            <td style="${TD} text-align:right; font-weight:700">${u.total}</td>
            <td style="${TD} text-align:right">${u.percentage}%</td>
          </tr>`,
      )
      .join('');

    const ubicNames = [...new Set(assets.map((a) => a.ubicacionNombre))];

    const detailSections = ubicNames
      .map((ubicName) => {
        const ubicAssets = assets.filter((a) => a.ubicacionNombre === ubicName);
        const assetRows = ubicAssets
          .map(
            (a) =>
              `<tr>
                <td style="${TD} font-family:monospace; font-size:11px; color:#64748b">${esc(a.codigo)}</td>
                <td style="${TD}">${esc(a.nombre)}</td>
                <td style="${TD}">${esc(a.estadoLabel)}</td>
                <td style="${TD} color:#64748b">${esc(a.area)}</td>
                <td style="${TD} color:#64748b">${esc(a.responsable)}</td>
              </tr>`,
          )
          .join('');
        return `
          <tr><td colspan="5" style="background:#1e293b; color:#fff; font-size:13px; font-weight:700; padding:10px 12px">${esc(ubicName)}</td></tr>
          <tr style="background:#334155">
            <th style="${TH}">Codigo</th>
            <th style="${TH}">Nombre</th>
            <th style="${TH}">Estado</th>
            <th style="${TH}">Area</th>
            <th style="${TH}">Responsable</th>
          </tr>
          ${assetRows}
          <tr><td colspan="5" style="padding:6px"></td></tr>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="UTF-8" /><title>Reporte por ubicacion</title></head>
<body style="margin:0; background:#f5f7fb; font-family:Arial,Helvetica,sans-serif; color:#111827">

  <!-- Header -->
  <table width="100%" cellspacing="0" cellpadding="0">
    <tr><td style="background:#111827; color:#fff; font-size:22px; font-weight:700; padding:22px 28px 6px">Reporte por ubicacion</td></tr>
    <tr><td style="background:#111827; color:#cbd5e1; font-size:12px; padding:0 28px 20px">Sistema de Seguimiento de Activos | Generado: ${esc(dateLabel)}</td></tr>
  </table>

  <!-- Metricas -->
  <table width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0">
    <tr>
      <td width="28"></td>
      <td style="background:#fff; border:1px solid #d9e2ef; padding:16px; width:200px">
        <div style="color:#64748b; font-size:11px; font-weight:700; text-transform:uppercase">Total de ubicaciones</div>
        <div style="color:#0f172a; font-size:26px; font-weight:700; padding-top:6px">${report.ubicaciones.length}</div>
      </td>
      <td width="16"></td>
      <td style="background:#fff; border:1px solid #d9e2ef; padding:16px; width:200px">
        <div style="color:#64748b; font-size:11px; font-weight:700; text-transform:uppercase">Total de activos</div>
        <div style="color:#0f172a; font-size:26px; font-weight:700; padding-top:6px">${report.totalAssets}</div>
      </td>
      <td></td>
    </tr>
  </table>

  <!-- Resumen por ubicacion -->
  <p style="color:#111827; font-size:14px; font-weight:700; padding:12px 28px 8px; margin:0">Resumen por ubicacion</p>
  <table width="calc(100% - 56px)" cellspacing="0" cellpadding="0" style="margin:0 28px 24px; border-collapse:collapse">
    <tr style="background:#1e293b">
      <th style="${TH}">Ubicacion / Espacio</th>
      <th style="${TH} text-align:right">Total activos</th>
      <th style="${TH} text-align:right">Participacion</th>
    </tr>
    ${summaryRows}
  </table>

  <!-- Detalle por ubicacion -->
  <p style="color:#111827; font-size:14px; font-weight:700; padding:12px 28px 8px; margin:0">Detalle de activos por ubicacion</p>
  <table width="calc(100% - 56px)" cellspacing="0" cellpadding="0" style="margin:0 28px 28px; border-collapse:collapse">
    ${detailSections}
  </table>

  <!-- Footer -->
  <p style="color:#64748b; font-size:11px; padding:12px 28px 22px; margin:0">
    Reporte generado automaticamente desde el microservicio de Reportes y Exportacion.
  </p>

</body></html>`;
  }

  private formatStatus(status: string) {    const labels: Record<string, string> = {
      OPERATIVO: 'Operativo',
      MANTENIMIENTO: 'Mantenimiento',
      FUERA_DE_SERVICIO: 'Fuera de servicio',
      DADO_DE_BAJA: 'Dado de baja',
    };
    return labels[status] || status;
  }

  private formatMovementType(type: string) {
    const labels: Record<string, string> = {
      REGISTRO: 'Registro',
      ASIGNACION: 'Asignación',
      TRANSFERENCIA: 'Transferencia',
      DEVOLUCION: 'Devolución',
      BAJA: 'Baja',
      ACTUALIZACION: 'Actualización',
      INCIDENTE: 'Incidente',
    };

    return labels[type] || type;
  }

  private normalizeDateParam(value?: string) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${value}`);
    }

    return parsed;
  }

  private startOfMonth(reference: Date) {
    return new Date(reference.getFullYear(), reference.getMonth(), 1);
  }

  private endOfToday() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  }

  private formatDateOnly(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
