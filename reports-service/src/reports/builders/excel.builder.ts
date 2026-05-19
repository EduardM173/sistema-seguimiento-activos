/**
 * ExcelBuilder — Constructor de Excel (HTML-based) genérico para todos los reportes.
 *
 * Genera archivos .xls como HTML con estilo inline, que Excel puede abrir nativamente.
 *
 * Encapsula:
 *  - Identidad de marca (paleta de colores, tipografía, nombre del sistema)
 *  - Esquema gráfico general: hero header, subtítulo, métricas, tabla, footer
 *  - Elementos visuales comunes: hero, metric card, table, section-title, footer
 *  - Creación de tablas con cabeceras, filas, celdas numéricas y de texto
 *  - Márgenes, paddings y colores estandarizados
 *  - Escape seguro de HTML para evitar inyección en celdas
 */

// ─── Tipados ──────────────────────────────────────────────────────────────────

export interface ExcelColumn {
  label: string;
  /** Si true, la celda se alinea a la derecha y se muestra en negrita */
  numeric?: boolean;
}

export interface ExcelRow {
  /** Valores en el mismo orden que las columnas definidas */
  cells: (string | number)[];
}

export interface ExcelMetric {
  label: string;
  value: string | number;
}

export interface ExcelReportOptions {
  title: string;
  generatedAt: Date;
  /** Métricas resaltadas debajo del header */
  metrics?: ExcelMetric[];
  /** Etiqueta de la sección antes de la tabla */
  tableTitle?: string;
  columns: ExcelColumn[];
  rows: ExcelRow[];
}

// ─── Constantes de marca ──────────────────────────────────────────────────────

const BRAND_CSS = `
  body { margin: 0; background: #f5f7fb; color: #111827; font-family: Arial, Helvetica, sans-serif; }

  /* ── Header ── */
  .hero    { background: #111827; color: #ffffff; font-size: 24px; font-weight: 700; padding: 24px 28px 8px; }
  .subtitle{ background: #111827; color: #cbd5e1; padding: 0 28px 24px; font-size: 12px; }

  /* ── Métricas ── */
  .metric       { background: #ffffff; border: 1px solid #d9e2ef; padding: 16px; }
  .metric-label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .metric-value { color: #0f172a; font-size: 26px; font-weight: 700; padding-top: 6px; }

  /* ── Secciones ── */
  .section-title { color: #111827; font-size: 15px; font-weight: 700; padding: 20px 28px 10px; }

  /* ── Tabla ── */
  .table    { width: calc(100% - 56px); border-collapse: collapse; margin: 0 28px 22px; }
  .table th { background: #1e293b; color: #ffffff; border: 1px solid #1e293b; padding: 10px 12px; text-align: left; font-size: 12px; }
  .table td { background: #ffffff; border: 1px solid #d9e2ef; padding: 10px 12px; font-size: 12px; }
  .number   { text-align: right; font-weight: 700; }

  /* ── Footer ── */
  .footer { color: #64748b; font-size: 11px; padding: 14px 28px 22px; }

  /* ── Layout wrapper ── */
  .sheet { width: 100%; border-collapse: collapse; }
`.trim();

const SYSTEM_NAME = 'Sistema de Seguimiento de Activos';
const FOOTER_TEXT =
  'Reporte generado automaticamente desde el microservicio de Reportes y Exportacion.';

// ─── Builder ──────────────────────────────────────────────────────────────────

export class ExcelBuilder {
  // ── Escape seguro ───────────────────────────────────────────────────────────

  escapeHtml(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── Secciones privadas ──────────────────────────────────────────────────────

  /**
   * Hero header: fondo oscuro con título y nombre del sistema + fecha.
   */
  private buildHeader(title: string, label: string, colspan: number): string {
    return [
      `<tr><td colspan="${colspan}" class="hero">${this.escapeHtml(title)}</td></tr>`,
      `<tr><td colspan="${colspan}" class="subtitle">${SYSTEM_NAME} | Generado: ${this.escapeHtml(label)}</td></tr>`,
    ].join('\n');
  }

  /**
   * Fila de métricas resaltadas. Cada métrica ocupa colspan automático.
   */
  private buildMetrics(metrics: ExcelMetric[], totalCols: number): string {
    const colsPerMetric = Math.floor(totalCols / metrics.length) || 1;
    const cells = metrics
      .map(
        (m) =>
          `<td class="metric" colspan="${colsPerMetric}">` +
          `<div class="metric-label">${this.escapeHtml(m.label)}</div>` +
          `<div class="metric-value">${this.escapeHtml(String(m.value))}</div>` +
          `</td>`,
      )
      .join('');
    return `<tr>${cells}</tr>`;
  }

  /**
   * Título de sección antes de la tabla.
   */
  private buildSectionTitle(label: string, colspan: number): string {
    return `<tr><td colspan="${colspan}" class="section-title">${this.escapeHtml(label)}</td></tr>`;
  }

  /**
   * Cabecera de tabla con fondo oscuro.
   */
  private buildTableHeader(columns: ExcelColumn[]): string {
    const ths = columns
      .map((col) => `<th${col.numeric ? ' class="number"' : ''}>${this.escapeHtml(col.label)}</th>`)
      .join('');
    return `<thead><tr>${ths}</tr></thead>`;
  }

  /**
   * Filas de la tabla. Las celdas marcadas como numeric se alinean a la derecha.
   */
  private buildTableRows(rows: ExcelRow[], columns: ExcelColumn[]): string {
    return rows
      .map((row) => {
        const tds = columns
          .map((col, i) => {
            const val = row.cells[i] ?? '';
            const cls = col.numeric ? ' class="number"' : '';
            return `<td${cls}>${this.escapeHtml(String(val))}</td>`;
          })
          .join('');
        return `<tr>${tds}</tr>`;
      })
      .join('\n');
  }

  /**
   * Pie de página estándar.
   */
  private buildFooter(colspan: number): string {
    return `<tr><td colspan="${colspan}" class="footer">${FOOTER_TEXT}</td></tr>`;
  }

  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * Construye el HTML completo del reporte Excel.
   *
   * Uso:
   * ```ts
   * const builder = new ExcelBuilder();
   * const html = builder.build({ title: '...', columns: [...], rows: [...] });
   * const buffer = Buffer.from(html, 'utf8');
   * ```
   */
  build(options: ExcelReportOptions): string {
    const { title, generatedAt, metrics, tableTitle, columns, rows } = options;
    const dateLabel = this.formatDate(generatedAt);
    const colspan = columns.length;

    const sections: string[] = [];

    // 1. Header
    sections.push(
      `<table class="sheet">`,
      this.buildHeader(title, dateLabel, colspan),
    );

    // 2. Métricas (opcionales)
    if (metrics && metrics.length > 0) {
      sections.push(this.buildMetrics(metrics, colspan));
    }

    // 3. Título de sección (opcional)
    if (tableTitle) {
      sections.push(this.buildSectionTitle(tableTitle, colspan));
    }

    sections.push(`</table>`);

    // 4. Tabla de datos
    sections.push(
      `<table class="table">`,
      this.buildTableHeader(columns),
      `<tbody>`,
      this.buildTableRows(rows, columns),
      `</tbody>`,
      `</table>`,
    );

    // 5. Footer
    sections.push(
      `<table class="sheet">`,
      this.buildFooter(colspan),
      `</table>`,
    );

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${BRAND_CSS}</style>
  </head>
  <body>
    ${sections.join('\n    ')}
  </body>
</html>`;
  }

  // ── Utilidades ──────────────────────────────────────────────────────────────

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/La_Paz',
    }).format(date);
  }
}
