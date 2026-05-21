import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  CalendarRange,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  History,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';
import { Alert, Badge, Button, Card, LoadingSpinner, Select } from '../../components/common';
import type { SelectOption } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { reportesService } from '../../services/reportes.service';
import { tipoMovimientoActivo } from '../../types/reportes.types';
import type {
  ReporteInventarioGeneral,
  ReporteCategoria,
  ReporteCategoriaDetalle,
  ActivoDetalleCategoria,
  ReporteMovimientosActivos,
  MovimientoActivoReporte,
  TipoMovimientoActivo,
  ReporteResponsable,
  ReporteResponsableDetalle,
  ActivoDetalleResponsable,
  ReporteArea,
  ReporteAreaDetalle,
  ActivoDetalleArea,
  ReporteUbicacion,
  ReporteUbicacionDetalle,
  ActivoDetalleUbicacion,
} from '../../types/reportes.types';
import '../../styles/modules.css';

// ─── Estado vacío inicial ────────────────────────────────────────────────────

const emptyReport: ReporteInventarioGeneral = {
  generatedAt: '',
  assets: { total: 0, byStatus: [] },
  materials: { total: 0, lowStock: 0 },
  downloadReady: false,
};

const noDownloadDataMessage = 'No hay informacion disponible para descargar';

const emptyCategoryReport: ReporteCategoria = {
  generatedAt: '',
  totalAssets: 0,
  categories: [],
  downloadReady: false,
};

const emptyMovementsReport: ReporteMovimientosActivos = {
  generatedAt: '',
  filters: {
    fechaDesde: '',
    fechaHasta: '',
    tipo: null,
  },
  totalMovimientos: 0,
  movements: [],
  downloadReady: false,
};

const movementTypeOptions: SelectOption[] = [
  { value: '', label: 'Todos los tipos' },
  ...Object.values(tipoMovimientoActivo).map((tipo) => ({
    value: tipo,
    label: tipo.replace(/_/g, ' ').toUpperCase(),
  })),
];

function formatDateInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function getDefaultMovementDateRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    fechaDesde: formatDateInput(start),
    fechaHasta: formatDateInput(today),
  };
}

function isValidDateInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const emptyResponsableReport: ReporteResponsable = {
  generatedAt: '',
  totalAssets: 0,
  responsables: [],
  downloadReady: false,
};

const emptyAreaReport: ReporteArea = {
  generatedAt: '',
  totalAssets: 0,
  areas: [],
  downloadReady: false,
};

const emptyUbicacionReport: ReporteUbicacion = {
  generatedAt: '',
  totalAssets: 0,
  ubicaciones: [],
  downloadReady: false,
};

// ─── Badge de estado de activo ───────────────────────────────────────────────

function estadoVariant(
  estado: string,
): 'success' | 'warning' | 'danger' | 'secondary' {
  if (estado === 'OPERATIVO') return 'success';
  if (estado === 'MANTENIMIENTO') return 'warning';
  if (estado === 'FUERA_DE_SERVICIO') return 'danger';
  return 'secondary';
}

function downloadMessageFor(isReady: boolean) {
  return isReady
    ? null
    : {
        type: 'error' as const,
        text: noDownloadDataMessage,
      };
}

// ─── Componente principal ────────────────────────────────────────────────────
export const ReportesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminGeneral = user?.rol?.nombre === 'ADMIN_GENERAL';

  // ── Reporte general (HU27) ────────────────────────────────────────────────
  const [report, setReport] = useState<ReporteInventarioGeneral>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'excel' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Reporte por categoría (HU28) ──────────────────────────────────────────
  const [categoryReport, setCategoryReport] = useState<ReporteCategoria>(emptyCategoryReport);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categoryDetail, setCategoryDetail] = useState<ReporteCategoriaDetalle | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [downloadingCategoryFormat, setDownloadingCategoryFormat] = useState<'pdf' | 'excel' | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Reporte de movimientos (HU45) ───────────────────────────────────────
  const [movementsReport, setMovementsReport] = useState<ReporteMovimientosActivos>(emptyMovementsReport);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [movementMessage, setMovementMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fechaDesde, setFechaDesde] = useState(getDefaultMovementDateRange().fechaDesde);
  const [fechaHasta, setFechaHasta] = useState(getDefaultMovementDateRange().fechaHasta);
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoActivo | ''>('');
  const todayInput = formatDateInput(new Date());
  const invalidMovementDateValue =
    !fechaDesde ||
    !fechaHasta ||
    !isValidDateInput(fechaDesde) ||
    !isValidDateInput(fechaHasta) ||
    fechaDesde > todayInput ||
    fechaHasta > todayInput;
  const invalidMovementDateRange = Boolean(
    fechaDesde && fechaHasta && fechaDesde > fechaHasta,
  );
  const invalidMovementDates = invalidMovementDateValue || invalidMovementDateRange;

  // ── Reporte por responsable (HU47) ────────────────────────────────────────
  const [responsableReport, setResponsableReport] = useState<ReporteResponsable>(emptyResponsableReport);
  const [loadingResponsables, setLoadingResponsables] = useState(true);

  const [selectedResponsableId, setSelectedResponsableId] = useState('');
  const [responsableDetail, setResponsableDetail] = useState<ReporteResponsableDetalle | null>(null);
  const [loadingResponsableDetail, setLoadingResponsableDetail] = useState(false);

  const [downloadingResponsableFormat, setDownloadingResponsableFormat] = useState<'pdf' | 'excel' | null>(null);
  const [responsableMessage, setResponsableMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Reporte por área (HU-AREA) ────────────────────────────────────────────
  const [areaReport, setAreaReport] = useState<ReporteArea>(emptyAreaReport);
  const [loadingAreas, setLoadingAreas] = useState(true);

  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [areaDetail, setAreaDetail] = useState<ReporteAreaDetalle | null>(null);
  const [loadingAreaDetail, setLoadingAreaDetail] = useState(false);

  const [downloadingAreaFormat, setDownloadingAreaFormat] = useState<'pdf' | 'excel' | null>(null);
  const [areaMessage, setAreaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Reporte por ubicación (HU-UBICACION) ────────────────────────────────────
  const [ubicacionReport, setUbicacionReport] = useState<ReporteUbicacion>(emptyUbicacionReport);
  const [loadingUbicaciones, setLoadingUbicaciones] = useState(true);

  const [selectedUbicacionId, setSelectedUbicacionId] = useState('');
  const [ubicacionDetail, setUbicacionDetail] = useState<ReporteUbicacionDetalle | null>(null);
  const [loadingUbicacionDetail, setLoadingUbicacionDetail] = useState(false);

  const [downloadingUbicacionFormat, setDownloadingUbicacionFormat] = useState<'pdf' | 'excel' | null>(null);
  const [ubicacionMessage, setUbicacionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Fechas formateadas ────────────────────────────────────────────────────

  const generatedAt = useMemo(() => {
    if (!report.generatedAt) return 'Sin consulta';
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(report.generatedAt));
  }, [report.generatedAt]);

  const generatedAtCategory = useMemo(() => {
    if (!categoryReport.generatedAt) return 'Sin consulta';
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(categoryReport.generatedAt));
  }, [categoryReport.generatedAt]);

  const generatedAtMovements = useMemo(() => {
    if (!movementsReport.generatedAt) return 'Sin consulta';
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(movementsReport.generatedAt));
  }, [movementsReport.generatedAt]);

  const movementPeriodLabel = useMemo(() => {
    if (!movementsReport.filters.fechaDesde || !movementsReport.filters.fechaHasta) {
      return 'Sin periodo';
    }

    const since = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(
      new Date(`${movementsReport.filters.fechaDesde}T00:00:00`),
    );
    const until = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(
      new Date(`${movementsReport.filters.fechaHasta}T00:00:00`),
    );

    return `${since} al ${until}`;
  }, [movementsReport.filters.fechaDesde, movementsReport.filters.fechaHasta]);

  const movementTypeLabel = useMemo(() => {
    if (!movementsReport.filters.tipo) {
      return 'Todos los tipos';
    }

    return movementsReport.filters.tipo.replace(/_/g, ' ').toUpperCase();
  }, [movementsReport.filters.tipo]);

  const generatedAtResponsable = useMemo(() => {
    if (!responsableReport.generatedAt) return 'Sin consulta';
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(responsableReport.generatedAt));
  }, [responsableReport.generatedAt]);

  const generatedAtArea = useMemo(() => {
    if (!areaReport.generatedAt) return 'Sin consulta';
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(areaReport.generatedAt));
  }, [areaReport.generatedAt]);

  const generatedAtUbicacion = useMemo(() => {
    if (!ubicacionReport.generatedAt) return 'Sin consulta';
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ubicacionReport.generatedAt));
  }, [ubicacionReport.generatedAt]);

  // ── Opciones del selector de categoría ───────────────────────────────────

  const categoryOptions: SelectOption[] = useMemo(
    () =>
      categoryReport.categories.map((c) => ({
        value: c.id,
        label: `${c.name} (${c.total})`,
      })),
    [categoryReport.categories],
  );

  // ── Opciones del selector de responsable (PROSIN-487) ────────────────────

  const responsableOptions: SelectOption[] = useMemo(
    () =>
      responsableReport.responsables.map((r) => ({
        value: r.id,
        label: `${r.name} (${r.total})`,
      })),
    [responsableReport.responsables],
  );

  // ── Opciones del selector de área ────────────────────────────────────────

  const areaOptions: SelectOption[] = useMemo(
    () =>
      areaReport.areas.map((a) => ({
        value: a.id,
        label: `${a.name} (${a.total})`,
      })),
    [areaReport.areas],
  );

  // ── Opciones del selector de ubicación ──────────────────────────────────

  const ubicacionOptions: SelectOption[] = useMemo(
    () =>
      ubicacionReport.ubicaciones.map((u) => ({
        value: u.id,
        label: `${u.name} (${u.total})`,
      })),
    [ubicacionReport.ubicaciones],
  );

  const selectedCategorySummary = useMemo(
    () => categoryReport.categories.find((category) => category.id === selectedCategoryId),
    [categoryReport.categories, selectedCategoryId],
  );

  const selectedResponsableSummary = useMemo(
    () =>
      responsableReport.responsables.find(
        (responsable) => responsable.id === selectedResponsableId,
      ),
    [responsableReport.responsables, selectedResponsableId],
  );

  const selectedAreaSummary = useMemo(
    () => areaReport.areas.find((area) => area.id === selectedAreaId),
    [areaReport.areas, selectedAreaId],
  );

  const selectedUbicacionSummary = useMemo(
    () => ubicacionReport.ubicaciones.find((ubicacion) => ubicacion.id === selectedUbicacionId),
    [ubicacionReport.ubicaciones, selectedUbicacionId],
  );

  const canDownloadCategoryReport = selectedCategoryId
    ? (selectedCategorySummary?.total ?? 0) > 0
    : categoryReport.downloadReady;

  const canDownloadResponsableReport = selectedResponsableId
    ? (selectedResponsableSummary?.total ?? 0) > 0
    : responsableReport.downloadReady;

  const canDownloadAreaReport = selectedAreaId
    ? (selectedAreaSummary?.total ?? 0) > 0
    : areaReport.downloadReady;

  const canDownloadUbicacionReport = selectedUbicacionId
    ? (selectedUbicacionSummary?.total ?? 0) > 0
    : ubicacionReport.downloadReady;

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => {
    cargarReporte();
    cargarReporteCategoria();
    cargarReporteMovimientos();

    if (isAdminGeneral) {
      cargarReporteResponsable();
      cargarReporteArea();
      cargarReporteUbicacion();
    } else {
      setLoadingResponsables(false);
      setLoadingAreas(false);
      setLoadingUbicaciones(false);
    }
  }, [isAdminGeneral]);

  // ── Al cambiar la categoría seleccionada, carga el detalle ────────────────

  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryDetail(null);
      return;
    }
    cargarDetalleCategoria(selectedCategoryId);
  }, [selectedCategoryId]);

  // ── Al cambiar el responsable seleccionado, carga el detalle (PA2) ────────

  useEffect(() => {
    if (!isAdminGeneral || !selectedResponsableId) {
      setResponsableDetail(null);
      return;
    }
    cargarDetalleResponsable(selectedResponsableId);
  }, [isAdminGeneral, selectedResponsableId]);

  // ── Al cambiar el área seleccionada, carga el detalle ────────────────────

  useEffect(() => {
    if (!isAdminGeneral || !selectedAreaId) {
      setAreaDetail(null);
      return;
    }
    cargarDetalleArea(selectedAreaId);
  }, [isAdminGeneral, selectedAreaId]);

  // ── Al cambiar la ubicación seleccionada, carga el detalle ───────────────

  useEffect(() => {
    if (!isAdminGeneral || !selectedUbicacionId) {
      setUbicacionDetail(null);
      return;
    }
    cargarDetalleUbicacion(selectedUbicacionId);
  }, [isAdminGeneral, selectedUbicacionId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Acciones — Reporte general (HU27)
  // ═══════════════════════════════════════════════════════════════════════════

  const cargarReporte = async () => {
    try {
      setLoading(true);
      const data = await reportesService.obtenerInventarioGeneral();
      setReport(data);
      setMessage(downloadMessageFor(data.downloadReady));
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el reporte general del inventario',
      });
    } finally {
      setLoading(false);
    }
  };

  const descargarReporte = async (formato: 'pdf' | 'excel') => {
    if (!report.downloadReady) {
      setMessage({
        type: 'error',
        text: noDownloadDataMessage,
      });
      return;
    }

    try {
      setDownloadingFormat(formato);
      await reportesService.descargarInventarioGeneral(formato, user?.id);
      setMessage({ type: 'success', text: 'El archivo quedo disponible para descarga' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo descargar el reporte consultado',
      });
    } finally {
      setDownloadingFormat(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Acciones — Reporte por categoría (HU28)
  // ═══════════════════════════════════════════════════════════════════════════

  const cargarReporteCategoria = async () => {
    try {
      setLoadingCategories(true);
      const data = await reportesService.obtenerReporteCategoria();
      setCategoryReport(data);
      setCategoryMessage(downloadMessageFor(data.downloadReady));
    } catch (err) {
      setCategoryMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el reporte por categoria',
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  // PA2 / PA3 / PA4 / PA5 — Carga activos de la categoría seleccionada
  const cargarDetalleCategoria = async (categoryId: string) => {
    try {
      setLoadingDetail(true);
      setCategoryDetail(null);
      const data = await reportesService.obtenerActivosPorCategoria(categoryId);
      setCategoryDetail(data);
    } catch (err) {
      setCategoryMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el detalle de la categoria',
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const descargarReporteCategoria = async (formato: 'pdf' | 'excel') => {
    if (!canDownloadCategoryReport) {
      setCategoryMessage({
        type: 'error',
        text: noDownloadDataMessage,
      });
      return;
    }

    try {
      setDownloadingCategoryFormat(formato);
      await reportesService.descargarReporteCategoria(
        formato,
        user?.id,
        selectedCategoryId || undefined,
      );
      setCategoryMessage({ type: 'success', text: 'El archivo quedo disponible para descarga' });
    } catch (err) {
      setCategoryMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo descargar el reporte por categoria',
      });
    } finally {
      setDownloadingCategoryFormat(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Acciones — Reporte de movimientos (HU45)
  // ═══════════════════════════════════════════════════════════════════════════

  const cargarReporteMovimientos = async () => {
    if (invalidMovementDateValue) {
      setMovementMessage({
        type: 'error',
        text: 'Ingrese fechas válidas y no posteriores a la fecha actual.',
      });
      return;
    }

    if (invalidMovementDateRange) {
      setMovementMessage({
        type: 'error',
        text: 'La fecha desde no puede ser posterior a la fecha hasta.',
      });
      return;
    }

    try {
      setLoadingMovements(true);
      const data = await reportesService.obtenerMovimientosActivos({
        fechaDesde,
        fechaHasta,
        tipo: tipoMovimiento,
      });
      setMovementsReport(data);
      setMovementMessage(null);
    } catch (err) {
      setMovementMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el reporte de movimientos',
      });
    } finally {
      setLoadingMovements(false);
    }
  };

  const handleConsultarMovimientos = () => {
    void cargarReporteMovimientos();
  };

  const formatMovementDate = (value: string) => {
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Acciones — Reporte por responsable (HU47)
  // ═══════════════════════════════════════════════════════════════════════════

  // PROSIN-490 / PA1 — Carga resumen agrupado por responsable
  const cargarReporteResponsable = async () => {
    try {
      setLoadingResponsables(true);
      const data = await reportesService.obtenerReporteResponsable();
      setResponsableReport(data);
      setResponsableMessage(downloadMessageFor(data.downloadReady));
    } catch (err) {
      setResponsableMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el reporte por responsable',
      });
    } finally {
      setLoadingResponsables(false);
    }
  };

  // PA2 / PA3 / PA4 / PA5 — Carga activos del responsable seleccionado
  const cargarDetalleResponsable = async (responsableId: string) => {
    try {
      setLoadingResponsableDetail(true);
      setResponsableDetail(null);
      const data = await reportesService.obtenerActivosPorResponsable(responsableId);
      setResponsableDetail(data);
    } catch (err) {
      setResponsableMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el detalle del responsable',
      });
    } finally {
      setLoadingResponsableDetail(false);
    }
  };

  const descargarReporteResponsable = async (formato: 'pdf' | 'excel') => {
    if (!canDownloadResponsableReport) {
      setResponsableMessage({
        type: 'error',
        text: noDownloadDataMessage,
      });
      return;
    }

    try {
      setDownloadingResponsableFormat(formato);
      await reportesService.descargarReporteResponsable(
        formato,
        user?.id,
        selectedResponsableId || undefined,
      );
      setResponsableMessage({ type: 'success', text: 'El archivo quedo disponible para descarga' });
    } catch (err) {
      setResponsableMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo descargar el reporte por responsable',
      });
    } finally {
      setDownloadingResponsableFormat(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Acciones — Reporte por área (HU-AREA)
  // ═══════════════════════════════════════════════════════════════════════════

  const cargarReporteArea = async () => {
    try {
      setLoadingAreas(true);
      const data = await reportesService.obtenerReporteArea();
      setAreaReport(data);
      setAreaMessage(downloadMessageFor(data.downloadReady));
    } catch (err) {
      setAreaMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el reporte por area',
      });
    } finally {
      setLoadingAreas(false);
    }
  };

  const cargarDetalleArea = async (areaId: string) => {
    try {
      setLoadingAreaDetail(true);
      setAreaDetail(null);
      const data = await reportesService.obtenerActivosPorArea(areaId);
      setAreaDetail(data);
    } catch (err) {
      setAreaMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el detalle del area',
      });
    } finally {
      setLoadingAreaDetail(false);
    }
  };

  const descargarReporteArea = async (formato: 'pdf' | 'excel') => {
    if (!canDownloadAreaReport) {
      setAreaMessage({
        type: 'error',
        text: noDownloadDataMessage,
      });
      return;
    }

    try {
      setDownloadingAreaFormat(formato);
      await reportesService.descargarReporteArea(formato, user?.id, selectedAreaId || undefined);
      setAreaMessage({ type: 'success', text: 'El archivo quedo disponible para descarga' });
    } catch (err) {
      setAreaMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo descargar el reporte por area',
      });
    } finally {
      setDownloadingAreaFormat(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Acciones — Reporte por ubicación (HU-UBICACION)
  // ═══════════════════════════════════════════════════════════════════════════

  const cargarReporteUbicacion = async () => {
    try {
      setLoadingUbicaciones(true);
      const data = await reportesService.obtenerReporteUbicacion();
      setUbicacionReport(data);
      setUbicacionMessage(downloadMessageFor(data.downloadReady));
    } catch (err) {
      setUbicacionMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el reporte por ubicacion',
      });
    } finally {
      setLoadingUbicaciones(false);
    }
  };

  const cargarDetalleUbicacion = async (ubicacionId: string) => {
    try {
      setLoadingUbicacionDetail(true);
      setUbicacionDetail(null);
      const data = await reportesService.obtenerActivosPorUbicacion(ubicacionId);
      setUbicacionDetail(data);
    } catch (err) {
      setUbicacionMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el detalle de la ubicacion',
      });
    } finally {
      setLoadingUbicacionDetail(false);
    }
  };

  const descargarReporteUbicacion = async (formato: 'pdf' | 'excel') => {
    if (!canDownloadUbicacionReport) {
      setUbicacionMessage({
        type: 'error',
        text: noDownloadDataMessage,
      });
      return;
    }

    try {
      setDownloadingUbicacionFormat(formato);
      await reportesService.descargarReporteUbicacion(
        formato,
        user?.id,
        selectedUbicacionId || undefined,
      );
      setUbicacionMessage({ type: 'success', text: 'El archivo quedo disponible para descarga' });
    } catch (err) {
      setUbicacionMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo descargar el reporte por ubicacion',
      });
    } finally {
      setDownloadingUbicacionFormat(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="module-page">

      {/* ════════════════════════════════════════════════════════════════════
          HU27 — Reporte general del inventario
      ════════════════════════════════════════════════════════════════════ */}

      <div className="module-header">
        <div>
          <h1>Reporte general del inventario</h1>
          <p>Consulta actualizada: {generatedAt}</p>
        </div>
        <div className="report-header-actions">
          <Button
            label="Actualizar"
            variant="primary"
            onClick={cargarReporte}
            isLoading={loading}
            icon={<RefreshCw size={16} />}
          />
          <Button
            label="PDF"
            variant="secondary"
            onClick={() => descargarReporte('pdf')}
            disabled={loading || !user?.id || !report.downloadReady}
            isLoading={downloadingFormat === 'pdf'}
            icon={<Download size={16} />}
          />
          <Button
            label="Excel"
            variant="secondary"
            onClick={() => descargarReporte('excel')}
            disabled={loading || !user?.id || !report.downloadReady}
            isLoading={downloadingFormat === 'excel'}
            icon={<FileSpreadsheet size={16} />}
          />
        </div>
      </div>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <section className="report-summary-grid">
            <Card padding="lg" className="report-summary-card">
              <div className="report-card-icon report-card-icon-assets">
                <Boxes size={22} />
              </div>
              <span className="report-card-label">Activos registrados</span>
              <strong>{report.assets.total}</strong>
            </Card>

            <Card padding="lg" className="report-summary-card">
              <div className="report-card-icon report-card-icon-materials">
                <Archive size={22} />
              </div>
              <span className="report-card-label">Materiales registrados</span>
              <strong>{report.materials.total}</strong>
            </Card>

            <Card padding="lg" className="report-summary-card">
              <div className="report-card-icon report-card-icon-alert">
                <AlertTriangle size={22} />
              </div>
              <span className="report-card-label">Materiales con stock bajo</span>
              <strong>{report.materials.lowStock}</strong>
            </Card>

            <Card padding="lg" className="report-summary-card">
              <div className="report-card-icon report-card-icon-ready">
                <CheckCircle2 size={22} />
              </div>
              <span className="report-card-label">Respuesta para descarga</span>
              <strong>{report.downloadReady ? 'Lista' : 'Pendiente'}</strong>
            </Card>
          </section>

          <Card title="Activos por estado" padding="lg">
            <div className="report-status-grid">
              {report.assets.byStatus.map((item) => (
                <div key={item.status} className="report-status-row">
                  <span>{item.label}</span>
                  <strong>{item.quantity}</strong>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          HU28 — Reporte por categoría de activos
      ════════════════════════════════════════════════════════════════════ */}

      <div className="module-header rp__section-header">
        <div>
          <h1>Reporte por categoria de activos</h1>
          <p>Consulta actualizada: {generatedAtCategory}</p>
        </div>
        <div className="report-header-actions">
          <Button
            label="Actualizar"
            variant="primary"
            onClick={cargarReporteCategoria}
            isLoading={loadingCategories}
            icon={<RefreshCw size={16} />}
          />
          <Button
            label="PDF"
            variant="secondary"
            onClick={() => descargarReporteCategoria('pdf')}
            disabled={loadingCategories || !user?.id || !canDownloadCategoryReport}
            isLoading={downloadingCategoryFormat === 'pdf'}
            icon={<Download size={16} />}
          />
          <Button
            label="Excel"
            variant="secondary"
            onClick={() => descargarReporteCategoria('excel')}
            disabled={loadingCategories || !user?.id || !canDownloadCategoryReport}
            isLoading={downloadingCategoryFormat === 'excel'}
            icon={<FileSpreadsheet size={16} />}
          />
        </div>
      </div>

      {categoryMessage && (
        <Alert
          type={categoryMessage.type}
          message={categoryMessage.text}
          dismissible
          onClose={() => setCategoryMessage(null)}
        />
      )}

      {loadingCategories ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* PA1 — Cantidad de activos por cada categoría registrada */}
          <Card title="Activos por categoria" padding="lg">
            {categoryReport.categories.length === 0 ? (
              <p className="rp__empty-state">No existen categorias registradas en el sistema</p>
            ) : (
              <div className="rp__category-grid">
                {categoryReport.categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`rp__category-card ${selectedCategoryId === cat.id ? 'rp__category-card--active' : ''}`}
                    onClick={() =>
                      setSelectedCategoryId(selectedCategoryId === cat.id ? '' : cat.id)
                    }
                  >
                    <div className="rp__category-card-icon">
                      <Layers size={18} />
                    </div>
                    <div className="rp__category-card-body">
                      <span className="rp__category-card-name">{cat.name}</span>
                      <strong className="rp__category-card-count">{cat.total}</strong>
                      <span className="rp__category-card-pct">{cat.percentage}%</span>
                    </div>
                    <ChevronRight
                      size={14}
                      className={`rp__category-card-arrow ${selectedCategoryId === cat.id ? 'rp__category-card-arrow--active' : ''}`}
                    />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Selector de categoría + detalle (PA2 / PA3 / PA4 / PA5) */}
          <Card
            title={
              selectedCategoryId
                ? `Activos de: ${categoryReport.categories.find((c) => c.id === selectedCategoryId)?.name ?? ''}`
                : 'Detalle de activos por categoria'
            }
            padding="lg"
          >
            <div className="rp__selector-row">
              <span className="rp__selector-label">Seleccionar categoria:</span>
              {/* PROSIN-439 — Selector de categoría */}
              <Select
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                options={categoryOptions}
                placeholder="Todas las categorias"
                className="rp__category-select"
              />
            </div>

            {/* Sin selección */}
            {!selectedCategoryId && (
              <p className="rp__empty-state">
                Selecciona una categoria para ver el detalle de sus activos
              </p>
            )}

            {/* Cargando detalle */}
            {selectedCategoryId && loadingDetail && <LoadingSpinner />}

            {/* PA5 — Categoría sin activos */}
            {selectedCategoryId && !loadingDetail && categoryDetail && categoryDetail.total === 0 && (
              <p className="rp__empty-state rp__empty-state--category">
                No existen activos registrados en esta categoria
              </p>
            )}

            {/* PA2 / PA3 / PA4 — Tabla de activos de la categoría seleccionada */}
            {selectedCategoryId && !loadingDetail && categoryDetail && categoryDetail.total > 0 && (
              <div className="rp__detail-table-wrap">
                <table className="rp__detail-table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Nombre</th>
                      <th>Estado</th>
                      <th>Ubicacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryDetail.assets.map((activo: ActivoDetalleCategoria) => (
                      <tr key={activo.id}>
                        <td className="rp__td-code">{activo.codigo}</td>
                        <td>{activo.nombre}</td>
                        <td>
                          <Badge
                            label={activo.estadoLabel}
                            variant={estadoVariant(activo.estado)}
                            size="sm"
                          />
                        </td>
                        <td className="rp__td-location">{activo.ubicacion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="rp__detail-total">
                  Total: <strong>{categoryDetail.total}</strong>{' '}
                  {categoryDetail.total === 1 ? 'activo' : 'activos'}
                </p>
              </div>
            )}
          </Card>

          {/* ════════════════════════════════════════════════════════════════
              HU45 — Reporte de movimientos de activos
          ════════════════════════════════════════════════════════════════ */}

          <div className="module-header rp__section-header">
            <div>
              <h1>Reporte de movimientos de activos</h1>
              <p>Consulta actualizada: {generatedAtMovements}</p>
            </div>
            <div className="report-header-actions">
              <Button
                label="Consultar"
                variant="primary"
                onClick={handleConsultarMovimientos}
                disabled={invalidMovementDates}
                isLoading={loadingMovements}
                icon={<Search size={16} />}
              />
            </div>
          </div>

          {movementMessage && (
            <Alert
              type={movementMessage.type}
              message={movementMessage.text}
              dismissible
              onClose={() => setMovementMessage(null)}
            />
          )}

          <Card title="Filtros del reporte" padding="lg">
            <div className="rp__movement-filters">
              <label className="rp__field">
                <span className="rp__field-label">
                  <CalendarRange size={14} />
                  Fecha desde
                </span>
                <input
                  type="date"
                  value={fechaDesde}
                  max={fechaHasta && fechaHasta < todayInput ? fechaHasta : todayInput}
                  required
                  aria-invalid={invalidMovementDates}
                  onChange={(event) => setFechaDesde(event.target.value)}
                  className="rp__input"
                />
              </label>

              <label className="rp__field">
                <span className="rp__field-label">
                  <CalendarRange size={14} />
                  Fecha hasta
                </span>
                <input
                  type="date"
                  value={fechaHasta}
                  min={fechaDesde || undefined}
                  max={todayInput}
                  required
                  aria-invalid={invalidMovementDates}
                  onChange={(event) => setFechaHasta(event.target.value)}
                  className="rp__input"
                />
              </label>

              <label className="rp__field rp__field--wide">
                <span className="rp__field-label">
                  <Filter size={14} />
                  Tipo de movimiento
                </span>
                <Select
                  value={tipoMovimiento}
                  onChange={(value) => setTipoMovimiento(value as TipoMovimientoActivo | '')}
                  options={movementTypeOptions}
                  placeholder="Todos los tipos"
                  className="rp__movement-select"
                />
              </label>
            </div>

            {invalidMovementDateRange ? (
              <p className="rp__empty-state rp__empty-state--category">
                La fecha desde no puede ser posterior a la fecha hasta.
              </p>
            ) : invalidMovementDateValue ? (
              <p className="rp__empty-state rp__empty-state--category">
                Ingrese fechas válidas y no posteriores a la fecha actual.
              </p>
            ) : null}
          </Card>

          {loadingMovements ? (
            <LoadingSpinner />
          ) : (
            <>
              <section className="report-summary-grid rp__movement-summary-grid">
                <Card padding="lg" className="report-summary-card">
                  <div className="report-card-icon rp__movement-icon--total">
                    <History size={22} />
                  </div>
                  <span className="report-card-label">Movimientos encontrados</span>
                  <strong>{movementsReport.totalMovimientos}</strong>
                </Card>

                <Card padding="lg" className="report-summary-card">
                  <div className="report-card-icon rp__movement-icon--period">
                    <CalendarRange size={22} />
                  </div>
                  <span className="report-card-label">Periodo consultado</span>
                  <strong>{movementPeriodLabel}</strong>
                </Card>

                <Card padding="lg" className="report-summary-card">
                  <div className="report-card-icon rp__movement-icon--type">
                    <Filter size={22} />
                  </div>
                  <span className="report-card-label">Tipo aplicado</span>
                  <strong>{movementTypeLabel}</strong>
                </Card>
              </section>

              <Card title="Resultados del reporte" padding="lg">
                {movementsReport.movements.length === 0 ? (
                  <p className="rp__empty-state">No existen movimientos de activos en el periodo seleccionado</p>
                ) : (
                  <div className="rp__detail-table-wrap">
                    <table className="rp__detail-table rp__movement-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Activo</th>
                          <th>Movimiento</th>
                          <th>Area origen</th>
                          <th>Area destino</th>
                          <th>Usuario relacionado</th>
                          <th>Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movementsReport.movements.map((movimiento: MovimientoActivoReporte) => (
                          <tr key={movimiento.id}>
                            <td className="rp__td-date">{formatMovementDate(movimiento.fecha)}</td>
                            <td>
                              <div className="rp__movement-asset">
                                <strong>{movimiento.activo.codigo}</strong>
                                <span>{movimiento.activo.nombre}</span>
                              </div>
                            </td>
                            <td>
                              <Badge
                                label={movimiento.tipoLabel}
                                variant="secondary"
                                size="sm"
                              />
                            </td>
                            <td className="rp__td-location">{movimiento.areaOrigen ?? 'Sin area'}</td>
                            <td className="rp__td-location">{movimiento.areaDestino ?? 'Sin area'}</td>
                            <td>{movimiento.realizadoPor}</td>
                            <td className="rp__td-detail">{movimiento.detalle ?? 'Sin detalle'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="rp__detail-total">
                      Total: <strong>{movementsReport.totalMovimientos}</strong>{' '}
                      {movementsReport.totalMovimientos === 1 ? 'movimiento' : 'movimientos'}
                    </p>
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}

      {isAdminGeneral ? (
        <>
          {/* ════════════════════════════════════════════════════════════════════
              HU47 — Reporte por responsable de activos
              PROSIN-486 — Vista de reporte por responsable actual
          ════════════════════════════════════════════════════════════════════ */}

          <div className="module-header rp__section-header">
            <div>
              <h1>Reporte por responsable de activos</h1>
              <p>Consulta actualizada: {generatedAtResponsable}</p>
            </div>
            <div className="report-header-actions">
              <Button
                label="Actualizar"
                variant="primary"
                onClick={cargarReporteResponsable}
                isLoading={loadingResponsables}
                icon={<RefreshCw size={16} />}
              />
              <Button
                label="PDF"
                variant="secondary"
                onClick={() => descargarReporteResponsable('pdf')}
                disabled={loadingResponsables || !user?.id || !canDownloadResponsableReport}
                isLoading={downloadingResponsableFormat === 'pdf'}
                icon={<Download size={16} />}
              />
              <Button
                label="Excel"
                variant="secondary"
                onClick={() => descargarReporteResponsable('excel')}
                disabled={loadingResponsables || !user?.id || !canDownloadResponsableReport}
                isLoading={downloadingResponsableFormat === 'excel'}
                icon={<FileSpreadsheet size={16} />}
              />
            </div>
          </div>

          {responsableMessage && (
            <Alert
              type={responsableMessage.type}
              message={responsableMessage.text}
              dismissible
              onClose={() => setResponsableMessage(null)}
            />
          )}

          {loadingResponsables ? (
            <LoadingSpinner />
          ) : (
            <>
              {/* PROSIN-488 / PA1 — Cantidad de activos por cada responsable registrado */}
              <Card title="Activos por responsable" padding="lg">
                {responsableReport.responsables.length === 0 ? (
                  <p className="rp__empty-state">
                    No existen responsables con activos asignados en el sistema
                  </p>
                ) : (
                  <div className="rp__category-grid">
                    {responsableReport.responsables.map((resp) => (
                      <button
                        key={resp.id}
                        className={`rp__category-card ${selectedResponsableId === resp.id ? 'rp__category-card--active' : ''}`}
                        onClick={() =>
                          setSelectedResponsableId(
                            selectedResponsableId === resp.id ? '' : resp.id,
                          )
                        }
                      >
                        <div className="rp__category-card-icon">
                          <User size={18} />
                        </div>
                        <div className="rp__category-card-body">
                          <span className="rp__category-card-name">{resp.name}</span>
                          <strong className="rp__category-card-count">{resp.total}</strong>
                          <span className="rp__category-card-pct">{resp.percentage}%</span>
                        </div>
                        <ChevronRight
                          size={14}
                          className={`rp__category-card-arrow ${selectedResponsableId === resp.id ? 'rp__category-card-arrow--active' : ''}`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {/* PROSIN-487 / PROSIN-489 / PA2 / PA3 / PA4 / PA5 — Selector + detalle */}
              <Card
                title={
                  selectedResponsableId
                    ? `Activos de: ${responsableReport.responsables.find((r) => r.id === selectedResponsableId)?.name ?? ''}`
                    : 'Detalle de activos por responsable'
                }
                padding="lg"
              >
                <div className="rp__selector-row">
                  <span className="rp__selector-label">Seleccionar responsable:</span>
                  {/* PROSIN-487 — Selector de responsable */}
                  <Select
                    value={selectedResponsableId}
                    onChange={setSelectedResponsableId}
                    options={responsableOptions}
                    placeholder="Selecciona un responsable"
                    className="rp__category-select"
                  />
                </div>

                {/* Sin selección */}
                {!selectedResponsableId && (
                  <p className="rp__empty-state">
                    Selecciona un responsable para ver los activos que tiene asignados
                  </p>
                )}

                {/* Cargando detalle */}
                {selectedResponsableId && loadingResponsableDetail && <LoadingSpinner />}

                {/* PA5 — Responsable sin activos asignados */}
                {selectedResponsableId && !loadingResponsableDetail && responsableDetail && responsableDetail.total === 0 && (
                  <p className="rp__empty-state rp__empty-state--category">
                    No existen activos asignados a este responsable
                  </p>
                )}

                {/* PA2 / PA3 / PA4 — Tabla de activos del responsable seleccionado */}
                {selectedResponsableId && !loadingResponsableDetail && responsableDetail && responsableDetail.total > 0 && (
                  <div className="rp__detail-table-wrap">
                    <table className="rp__detail-table">
                      <thead>
                        <tr>
                          <th>Codigo</th>
                          <th>Nombre</th>
                          <th>Categoria</th>
                          <th>Estado</th>
                          <th>Ubicacion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {responsableDetail.assets.map((activo: ActivoDetalleResponsable) => (
                          <tr key={activo.id}>
                            <td className="rp__td-code">{activo.codigo}</td>
                            <td>{activo.nombre}</td>
                            <td className="rp__td-location">{activo.categoria}</td>
                            <td>
                              <Badge
                                label={activo.estadoLabel}
                                variant={estadoVariant(activo.estado)}
                                size="sm"
                              />
                            </td>
                            <td className="rp__td-location">{activo.ubicacion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="rp__detail-total">
                      Total: <strong>{responsableDetail.total}</strong>{' '}
                      {responsableDetail.total === 1 ? 'activo' : 'activos'}
                    </p>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              HU-AREA — Reporte por área o departamento
          ════════════════════════════════════════════════════════════════════ */}

          <div className="module-header rp__section-header">
            <div>
              <h1>Reporte por area</h1>
              <p>Consulta actualizada: {generatedAtArea}</p>
            </div>
            <div className="report-header-actions">
              <Button
                label="Actualizar"
                variant="primary"
                onClick={cargarReporteArea}
                isLoading={loadingAreas}
                icon={<RefreshCw size={16} />}
              />
              <Button
                label="PDF"
                variant="secondary"
                onClick={() => descargarReporteArea('pdf')}
                disabled={loadingAreas || !canDownloadAreaReport}
                isLoading={downloadingAreaFormat === 'pdf'}
                icon={<Download size={16} />}
              />
              <Button
                label="Excel"
                variant="secondary"
                onClick={() => descargarReporteArea('excel')}
                disabled={loadingAreas || !canDownloadAreaReport}
                isLoading={downloadingAreaFormat === 'excel'}
                icon={<FileSpreadsheet size={16} />}
              />
            </div>
          </div>

          {areaMessage && (
            <Alert
              type={areaMessage.type}
              message={areaMessage.text}
              dismissible
              onClose={() => setAreaMessage(null)}
            />
          )}

          {loadingAreas ? (
            <LoadingSpinner />
          ) : (
            <>
              {/* PA1 — Cantidad de activos por área registrada */}
              <Card title="Activos por area" padding="lg">
                {areaReport.areas.length === 0 ? (
                  <p className="rp__empty-state">
                    No existen areas registradas en el sistema
                  </p>
                ) : (
                  <div className="rp__category-grid">
                    {areaReport.areas.map((area) => (
                      <button
                        key={area.id}
                        className={`rp__category-card ${selectedAreaId === area.id ? 'rp__category-card--active' : ''}`}
                        onClick={() =>
                          setSelectedAreaId(selectedAreaId === area.id ? '' : area.id)
                        }
                      >
                        <div className="rp__category-card-icon">
                          <Layers size={18} />
                        </div>
                        <div className="rp__category-card-body">
                          <span className="rp__category-card-name">{area.name}</span>
                          <strong className="rp__category-card-count">{area.total}</strong>
                          <span className="rp__category-card-pct">{area.percentage}%</span>
                        </div>
                        <ChevronRight
                          size={14}
                          className={`rp__category-card-arrow ${selectedAreaId === area.id ? 'rp__category-card-arrow--active' : ''}`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {/* Selector de área + detalle */}
              <Card
                title={
                  selectedAreaId
                    ? `Activos de: ${areaReport.areas.find((a) => a.id === selectedAreaId)?.name ?? ''}`
                    : 'Detalle de activos por area'
                }
                padding="lg"
              >
                <div className="rp__selector-row">
                  <span className="rp__selector-label">Seleccionar area:</span>
                  <Select
                    value={selectedAreaId}
                    onChange={setSelectedAreaId}
                    options={areaOptions}
                    placeholder="Selecciona un area"
                    className="rp__category-select"
                  />
                </div>

                {/* Sin selección */}
                {!selectedAreaId && (
                  <p className="rp__empty-state">
                    Selecciona un area para ver los activos vinculados
                  </p>
                )}

                {/* Cargando detalle */}
                {selectedAreaId && loadingAreaDetail && <LoadingSpinner />}

                {/* PA5 — Área sin activos */}
                {selectedAreaId && !loadingAreaDetail && areaDetail && areaDetail.total === 0 && (
                  <p className="rp__empty-state rp__empty-state--category">
                    No existen activos vinculados a esta area
                  </p>
                )}

                {/* PA2 / PA3 / PA4 — Tabla de activos del área seleccionada */}
                {selectedAreaId && !loadingAreaDetail && areaDetail && areaDetail.total > 0 && (
                  <div className="rp__detail-table-wrap">
                    <table className="rp__detail-table">
                      <thead>
                        <tr>
                          <th>Codigo</th>
                          <th>Nombre</th>
                          <th>Estado</th>
                          <th>Ubicacion</th>
                          <th>Responsable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaDetail.assets.map((activo: ActivoDetalleArea) => (
                          <tr key={activo.id}>
                            <td className="rp__td-code">{activo.codigo}</td>
                            <td>{activo.nombre}</td>
                            <td>
                              <Badge
                                label={activo.estadoLabel}
                                variant={estadoVariant(activo.estado)}
                                size="sm"
                              />
                            </td>
                            <td className="rp__td-location">{activo.ubicacion}</td>
                            <td className="rp__td-location">{activo.responsable}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="rp__detail-total">
                      Total: <strong>{areaDetail.total}</strong>{' '}
                      {areaDetail.total === 1 ? 'activo' : 'activos'}
                    </p>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              HU-UBICACION — Reporte por ubicación
          ════════════════════════════════════════════════════════════════════ */}

          <div className="module-header rp__section-header">
            <div>
              <h1>Reporte por ubicacion</h1>
              <p>Consulta actualizada: {generatedAtUbicacion}</p>
            </div>
            <div className="report-header-actions">
              <Button
                label="Actualizar"
                variant="primary"
                onClick={cargarReporteUbicacion}
                isLoading={loadingUbicaciones}
                icon={<RefreshCw size={16} />}
              />
              <Button
                label="PDF"
                variant="secondary"
                onClick={() => descargarReporteUbicacion('pdf')}
                disabled={loadingUbicaciones || !canDownloadUbicacionReport}
                isLoading={downloadingUbicacionFormat === 'pdf'}
                icon={<Download size={16} />}
              />
              <Button
                label="Excel"
                variant="secondary"
                onClick={() => descargarReporteUbicacion('excel')}
                disabled={loadingUbicaciones || !canDownloadUbicacionReport}
                isLoading={downloadingUbicacionFormat === 'excel'}
                icon={<FileSpreadsheet size={16} />}
              />
            </div>
          </div>

          {ubicacionMessage && (
            <Alert
              type={ubicacionMessage.type}
              message={ubicacionMessage.text}
              dismissible
              onClose={() => setUbicacionMessage(null)}
            />
          )}

          {loadingUbicaciones ? (
            <LoadingSpinner />
          ) : (
            <>
              {/* PA1 — Cantidad de activos por ubicación registrada */}
              <Card title="Activos por ubicacion" padding="lg">
                {ubicacionReport.ubicaciones.length === 0 ? (
                  <p className="rp__empty-state">
                    No existen ubicaciones registradas en el sistema
                  </p>
                ) : (
                  <div className="rp__category-grid">
                    {ubicacionReport.ubicaciones.map((ubic) => (
                      <button
                        key={ubic.id}
                        className={`rp__category-card ${selectedUbicacionId === ubic.id ? 'rp__category-card--active' : ''}`}
                        onClick={() =>
                          setSelectedUbicacionId(selectedUbicacionId === ubic.id ? '' : ubic.id)
                        }
                      >
                        <div className="rp__category-card-icon">
                          <MapPin size={18} />
                        </div>
                        <div className="rp__category-card-body">
                          <span className="rp__category-card-name">{ubic.name}</span>
                          <strong className="rp__category-card-count">{ubic.total}</strong>
                          <span className="rp__category-card-pct">{ubic.percentage}%</span>
                        </div>
                        <ChevronRight
                          size={14}
                          className={`rp__category-card-arrow ${selectedUbicacionId === ubic.id ? 'rp__category-card-arrow--active' : ''}`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {/* Selector de ubicación + detalle */}
              <Card
                title={
                  selectedUbicacionId
                    ? `Activos de: ${ubicacionReport.ubicaciones.find((u) => u.id === selectedUbicacionId)?.name ?? ''}`
                    : 'Detalle de activos por ubicacion'
                }
                padding="lg"
              >
                <div className="rp__selector-row">
                  <span className="rp__selector-label">Seleccionar ubicacion:</span>
                  <Select
                    value={selectedUbicacionId}
                    onChange={setSelectedUbicacionId}
                    options={ubicacionOptions}
                    placeholder="Selecciona una ubicacion"
                    className="rp__category-select"
                  />
                </div>

                {/* Sin selección */}
                {!selectedUbicacionId && (
                  <p className="rp__empty-state">
                    Selecciona una ubicacion para ver los activos vinculados
                  </p>
                )}

                {/* Cargando detalle */}
                {selectedUbicacionId && loadingUbicacionDetail && <LoadingSpinner />}

                {/* PA5 — Ubicación sin activos */}
                {selectedUbicacionId && !loadingUbicacionDetail && ubicacionDetail && ubicacionDetail.total === 0 && (
                  <p className="rp__empty-state rp__empty-state--category">
                    No existen activos vinculados a esta ubicacion
                  </p>
                )}

                {/* PA2 / PA3 / PA4 — Tabla de activos de la ubicación seleccionada */}
                {selectedUbicacionId && !loadingUbicacionDetail && ubicacionDetail && ubicacionDetail.total > 0 && (
                  <div className="rp__detail-table-wrap">
                    <table className="rp__detail-table">
                      <thead>
                        <tr>
                          <th>Codigo</th>
                          <th>Nombre</th>
                          <th>Estado</th>
                          <th>Area</th>
                          <th>Responsable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ubicacionDetail.assets.map((activo: ActivoDetalleUbicacion) => (
                          <tr key={activo.id}>
                            <td className="rp__td-code">{activo.codigo}</td>
                            <td>{activo.nombre}</td>
                            <td>
                              <Badge
                                label={activo.estadoLabel}
                                variant={estadoVariant(activo.estado)}
                                size="sm"
                              />
                            </td>
                            <td className="rp__td-location">{activo.area}</td>
                            <td className="rp__td-location">{activo.responsable}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="rp__detail-total">
                      Total: <strong>{ubicacionDetail.total}</strong>{' '}
                      {ubicacionDetail.total === 1 ? 'activo' : 'activos'}
                    </p>
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      ) : null}

      {/* ─── Estilos inline ────────────────────────────────────────────────── */}
      <style>{`
        /* ── Acciones del header ─────────────────────────────────────────── */
        .report-header-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }

        /* ── Separación entre secciones ─────────────────────────────────── */
        .rp__section-header {
          margin-top: 48px;
        }

        /* ── Cards de métricas (HU27) ───────────────────────────────────── */
        .report-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .report-summary-card .card-content {
          display: grid;
          gap: 10px;
        }

        .report-card-icon {
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #fff;
        }

        .report-card-icon-assets    { background: #2563eb; }
        .report-card-icon-materials { background: #059669; }
        .report-card-icon-alert     { background: #d97706; }
        .report-card-icon-ready     { background: #475569; }

        .report-card-label {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
        }

        .report-summary-card strong {
          color: var(--color-text);
          font-size: var(--font-size-2xl);
          line-height: 1;
        }

        /* ── Filas de estado (HU27) ─────────────────────────────────────── */
        .report-status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .report-status-row {
          min-height: 56px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid var(--color-border-light);
          border-radius: 8px;
          background: var(--color-surface);
        }

        .report-status-row span {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
        }

        .report-status-row strong {
          color: var(--color-text);
          font-size: var(--font-size-lg);
        }

        /* ── Grid de tarjetas (HU28 / PA1 y HU47 / PA1) ────────────────── */
        .rp__category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }

        .rp__category-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 12px;
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          background: var(--glass-bg);
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s, background 0.15s;
          width: 100%;
        }

        .rp__category-card:hover {
          border-color: var(--color-primary);
          background: var(--color-primary-muted);
        }

        .rp__category-card--active {
          border-color: var(--color-primary);
          background: var(--color-primary-muted);
        }

        .rp__category-card-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: var(--color-primary-muted);
          color: var(--color-primary-light);
          flex-shrink: 0;
        }

        .rp__category-card-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .rp__category-card-name {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text);
          white-space: normal;
          word-break: break-word;
          line-height: 1.3;
        }

        .rp__category-card-count {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-extrabold);
          color: var(--color-text);
          line-height: 1;
        }

        .rp__category-card-pct {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .rp__category-card-arrow {
          color: var(--color-text-secondary);
          flex-shrink: 0;
          transition: transform 0.2s, color 0.2s;
        }

        .rp__category-card-arrow--active {
          transform: rotate(90deg);
          color: var(--color-primary-light);
        }

        /* ── Selector + detalle ─────────────────────────────────────────── */
        .rp__selector-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .rp__selector-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-secondary);
          white-space: nowrap;
        }

        .rp__category-select {
          min-width: 240px;
        }

        /* ── Estado vacío ────────────────────────────────────────────────── */
        .rp__empty-state {
          padding: 32px 0;
          text-align: center;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }

        .rp__empty-state--category {
          padding: 24px 0;
          font-weight: var(--font-weight-semibold);
          color: var(--color-text);
        }

        /* ── Tabla de detalle (PA3) ─────────────────────────────────────── */
        .rp__detail-table-wrap {
          overflow-x: auto;
        }

        .rp__detail-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
        }

        .rp__detail-table thead tr {
          background: rgba(255, 255, 255, 0.04);
          border-bottom: 1px solid var(--glass-border);
        }

        .rp__detail-table th {
          padding: 10px 14px;
          text-align: left;
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          white-space: nowrap;
        }

        .rp__detail-table tbody tr {
          border-bottom: 1px solid var(--glass-border);
          transition: background 0.12s;
        }

        .rp__detail-table tbody tr:last-child {
          border-bottom: none;
        }

        .rp__detail-table tbody tr:hover {
          background: var(--glass-bg-hover);
        }

        .rp__detail-table td {
          padding: 12px 14px;
          color: var(--color-text);
          vertical-align: middle;
        }

        .rp__td-code {
          font-family: monospace;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary) !important;
        }

        .rp__td-location {
          color: var(--color-text-secondary) !important;
        }

        .rp__detail-total {
          margin-top: 14px;
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          text-align: right;
        }

        .rp__detail-total strong {
          color: var(--color-text);
        }

        /* ── Filtros y tabla de movimientos (HU45) ─────────────────────── */
        .rp__movement-filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .rp__field {
          display: grid;
          gap: 8px;
        }

        .rp__field--wide {
          min-width: 240px;
        }

        .rp__field-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-secondary);
        }

        .rp__input,
        .rp__movement-select {
          width: 100%;
        }

        .rp__input {
          min-height: 42px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          color: var(--color-text);
          font: inherit;
        }

        .rp__input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
        }

        .rp__movement-summary-grid {
          margin: 22px 0 24px;
        }

        .rp__movement-icon--total { background: #0f766e; }
        .rp__movement-icon--period { background: #2563eb; }
        .rp__movement-icon--type { background: #7c3aed; }

        .rp__movement-summary-grid .report-summary-card strong {
          line-height: 1.2;
          word-break: break-word;
        }

        .rp__movement-table {
          min-width: 1000px;
        }

        .rp__movement-asset {
          display: grid;
          gap: 2px;
        }

        .rp__movement-asset strong {
          font-size: var(--font-size-sm);
        }

        .rp__movement-asset span,
        .rp__td-date,
        .rp__td-detail {
          color: var(--color-text-secondary);
        }

        .rp__td-detail {
          max-width: 280px;
          white-space: normal;
        }
      `}</style>
    </div>
  );
};

export default ReportesPage;
