/**
 * PdfBuilder — Constructor de PDF genérico para todos los reportes del sistema.
 *
 * Encapsula:
 *  - Identidad de marca (colores corporativos, tipografía, logo textual)
 *  - Esquema gráfico general de la plantilla (header, body, footer)
 *  - Elementos visuales comunes: rectángulos, textos, tarjetas de métricas
 *  - Creación de tablas (cabecera, filas alternas, bordes)
 *  - Creación de headers y pies de página
 *  - Márgenes y coordenadas estandarizadas
 */

// ─── Tipados ──────────────────────────────────────────────────────────────────

export interface PdfColumn {
  label: string;
  /** Posición X en puntos (coordenadas PDF) */
  x: number;
}

export interface PdfRow {
  /** Valores en el mismo orden que las columnas definidas */
  cells: string[];
}

export interface PdfMetric {
  label: string;
  value: string | number;
  /** Color de acento RGB normalizado, ej. '0.15 0.39 0.92' */
  accentColor?: string;
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  generatedAt: Date;
  description?: string;
  /** Métricas que aparecen debajo del header como tarjetas */
  metrics?: PdfMetric[];
  /** Etiqueta de la sección de tabla */
  tableTitle?: string;
  columns: PdfColumn[];
  rows: PdfRow[];
}

// ─── Constantes de marca ──────────────────────────────────────────────────────

const BRAND = {
  /** Fondo del header principal */
  headerBg: '0.06 0.10 0.18',
  /** Línea de acento azul corporativa */
  accentLine: '0.15 0.39 0.92',
  /** Texto blanco */
  textLight: '1 1 1',
  /** Texto de subtítulo en header */
  textMuted: '0.82 0.88 0.96',
  /** Fondo de cabecera de tabla */
  tableHeaderBg: '0.09 0.14 0.23',
  /** Fondo alterno de filas (par) */
  rowBgEven: '0.97 0.98 1',
  /** Fondo alterno de filas (impar) */
  rowBgOdd: '1 1 1',
  /** Borde de filas */
  rowBorder: '0.82 0.86 0.91',
  /** Texto principal del cuerpo */
  textBody: '0.15 0.19 0.27',
  /** Texto de sección */
  textSection: '0.06 0.10 0.18',
  /** Texto de descripción / footer */
  textDescr: '0.39 0.45 0.55',
  /** Texto de pie de página */
  textFooter: '0.45 0.50 0.58',
  /** Nombre del sistema */
  systemName: 'Sistema de Seguimiento de Activos',
  /** Texto de pie de página estándar */
  footerText:
    'Reporte generado automaticamente desde el microservicio de Reportes y Exportacion.',
} as const;

// ─── Márgenes y dimensiones ───────────────────────────────────────────────────

const LAYOUT = {
  marginX: 48,
  pageWidth: 612,
  pageHeight: 792,
  contentWidth: 516,   // pageWidth - 2 * marginX
  headerHeight: 88,
  headerTop: 704,      // pageHeight - headerHeight
  accentLineHeight: 5,
  rowHeight: 24,
  tableHeaderHeight: 24,
  footerY: 72,
  metricCardWidth: 150,
  metricCardHeight: 78,
} as const;

// ─── Builder ──────────────────────────────────────────────────────────────────

export class PdfBuilder {
  // ── Primitivos ──────────────────────────────────────────────────────────────

  private rect(x: number, y: number, w: number, h: number, color: string): string {
    return `q\n${color} rg\n${x} ${y} ${w} ${h} re\nf\nQ`;
  }

  private strokeRect(x: number, y: number, w: number, h: number, color: string): string {
    return `q\n${color} RG\n0.75 w\n${x} ${y} ${w} ${h} re\nS\nQ`;
  }

  private text(
    content: string,
    x: number,
    y: number,
    size: number,
    color: string,
  ): string {
    const escaped = content
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
    return ['BT', `${color} rg`, `/F1 ${size} Tf`, `${x} ${y} Td`, `(${escaped}) Tj`, 'ET'].join(
      '\n',
    );
  }

  // ── Elementos compuestos ────────────────────────────────────────────────────

  /**
   * Bloque de header de marca: fondo oscuro + línea de acento azul +
   * título, nombre del sistema y fecha de generación.
   */
  private buildHeader(title: string, generatedLabel: string): string[] {
    const { marginX, pageWidth, headerTop, headerHeight, accentLineHeight } = LAYOUT;
    return [
      this.rect(0, headerTop, pageWidth, headerHeight, BRAND.headerBg),
      this.rect(0, headerTop, pageWidth, accentLineHeight, BRAND.accentLine),
      this.text(title, marginX, 754, 20, BRAND.textLight),
      this.text(BRAND.systemName, marginX, 728, 10, BRAND.textMuted),
      this.text(`Generado: ${generatedLabel}`, 392, 728, 10, BRAND.textMuted),
    ];
  }

  /**
   * Tarjeta de métrica: fondo blanco con borde, barra de color en la parte
   * superior y valor numérico grande.
   */
  private buildMetricCard(
    x: number,
    y: number,
    width: number,
    metric: PdfMetric,
  ): string[] {
    const { metricCardHeight } = LAYOUT;
    const accent = metric.accentColor ?? BRAND.accentLine;
    return [
      this.rect(x, y, width, metricCardHeight, '1 1 1'),
      this.strokeRect(x, y, width, metricCardHeight, BRAND.rowBorder),
      this.rect(x, y + metricCardHeight - 4, width, 4, accent),
      this.text(metric.label, x + 14, y + 48, 9, BRAND.textDescr),
      this.text(String(metric.value), x + 14, y + 18, 24, BRAND.textSection),
    ];
  }

  /**
   * Cabecera de tabla: fondo oscuro con etiquetas blancas.
   */
  private buildTableHeader(y: number, columns: PdfColumn[]): string[] {
    const { marginX, contentWidth, tableHeaderHeight } = LAYOUT;
    const parts: string[] = [
      this.rect(marginX, y, contentWidth, tableHeaderHeight, BRAND.tableHeaderBg),
    ];
    for (const col of columns) {
      parts.push(this.text(col.label, col.x, y + 7, 9, BRAND.textLight));
    }
    return parts;
  }

  /**
   * Fila de tabla con fondo alterno y borde.
   */
  private buildTableRow(y: number, index: number, cells: string[], columns: PdfColumn[]): string[] {
    const { marginX, contentWidth, rowHeight } = LAYOUT;
    const bg = index % 2 === 0 ? BRAND.rowBgEven : BRAND.rowBgOdd;
    const parts: string[] = [
      this.rect(marginX, y, contentWidth, rowHeight, bg),
      this.strokeRect(marginX, y, contentWidth, rowHeight, BRAND.rowBorder),
    ];
    for (let i = 0; i < columns.length; i++) {
      const cell = cells[i] ?? '';
      parts.push(this.text(cell, columns[i].x, y + 7, 9, BRAND.textBody));
    }
    return parts;
  }

  /**
   * Pie de página: línea divisora + texto estándar del sistema.
   */
  private buildFooter(): string[] {
    const { marginX, contentWidth, footerY } = LAYOUT;
    return [
      this.rect(marginX, footerY, contentWidth, 1, BRAND.rowBorder),
      this.text(BRAND.footerText, marginX, footerY - 22, 8, BRAND.textFooter),
    ];
  }

  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * Construye un PDF completo de una sola página a partir de las opciones del reporte.
   *
   * Uso:
   * ```ts
   * const builder = new PdfBuilder();
   * const buffer = builder.build({ title: '...', columns: [...], rows: [...], ... });
   * ```
   */
  build(options: PdfReportOptions): Buffer {
    const { title, generatedAt, description, metrics, tableTitle, columns, rows } = options;
    const dateLabel = this.formatDate(generatedAt);
    const { marginX, contentWidth, rowHeight, tableHeaderHeight } = LAYOUT;

    const parts: string[] = [];

    // 1. Header de marca
    parts.push(...this.buildHeader(title, dateLabel));

    // 2. Descripción (opcional)
    if (description) {
      parts.push(this.text(description, marginX, 640, 10, BRAND.textDescr));
    }

    // 3. Tarjetas de métricas (opcionales, distribuidas horizontalmente)
    if (metrics && metrics.length > 0) {
      const spacing = 18;
      const totalWidth = contentWidth;
      const cardWidth = Math.floor((totalWidth - spacing * (metrics.length - 1)) / metrics.length);
      for (let i = 0; i < metrics.length; i++) {
        const x = marginX + i * (cardWidth + spacing);
        parts.push(...this.buildMetricCard(x, 548, cardWidth, metrics[i]));
      }
    }

    // 4. Título de sección de tabla
    const tableSectionY = metrics && metrics.length > 0 ? 500 : 650;
    if (tableTitle) {
      parts.push(this.text(tableTitle, marginX, tableSectionY, 14, BRAND.textSection));
    }

    // 5. Cabecera de tabla
    const tableHeaderY = tableSectionY - (tableTitle ? 36 : 10);
    parts.push(...this.buildTableHeader(tableHeaderY, columns));

    // 6. Filas
    let currentY = tableHeaderY - tableHeaderHeight;
    for (let i = 0; i < rows.length; i++) {
      const rowY = currentY - i * rowHeight;
      if (rowY < 80) break; // No sobrepasar el footer
      parts.push(...this.buildTableRow(rowY, i, rows[i].cells, columns));
    }

    // 7. Footer
    parts.push(...this.buildFooter());

    // 8. Ensamblar PDF raw
    return this.assemble(parts.join('\n'));
  }

  // ── Ensamblado PDF ──────────────────────────────────────────────────────────

  private assemble(content: string): Buffer {
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LAYOUT.pageWidth} ${LAYOUT.pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream\nendobj\n`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += obj;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'latin1');
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
