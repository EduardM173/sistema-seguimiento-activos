import 'package:flutter/foundation.dart';

// ── Enums ─────────────────────────────────────────────────────────────────

enum EstadoActivo {
  operativo('OPERATIVO', 'Operativo'),
  mantenimiento('MANTENIMIENTO', 'Mantenimiento'),
  fueraDeServicio('FUERA_DE_SERVICIO', 'Fuera de servicio'),
  dadoDeBaja('DADO_DE_BAJA', 'Dado de baja');

  const EstadoActivo(this.value, this.label);
  final String value;
  final String label;

  static EstadoActivo fromValue(String v) =>
      EstadoActivo.values.firstWhere((e) => e.value == v,
          orElse: () => EstadoActivo.operativo);
}

// ── Catalog types ─────────────────────────────────────────────────────────

@immutable
class Categoria {
  const Categoria({required this.id, required this.nombre});
  final String id;
  final String nombre;
  factory Categoria.fromJson(Map<String, dynamic> j) =>
      Categoria(id: j['id'] as String, nombre: j['nombre'] as String);
}

@immutable
class Ubicacion {
  const Ubicacion({required this.id, required this.nombre});
  final String id;
  final String nombre;
  factory Ubicacion.fromJson(Map<String, dynamic> j) =>
      Ubicacion(id: j['id'] as String, nombre: j['nombre'] as String);
}

@immutable
class Area {
  const Area({required this.id, required this.nombre});
  final String id;
  final String nombre;
  factory Area.fromJson(Map<String, dynamic> j) =>
      Area(id: j['id'] as String, nombre: j['nombre'] as String);
}

@immutable
class UsuarioResumen {
  const UsuarioResumen(
      {required this.id, required this.nombreCompleto, required this.correo});
  final String id;
  final String nombreCompleto;
  final String correo;
  factory UsuarioResumen.fromJson(Map<String, dynamic> j) => UsuarioResumen(
        id: j['id'] as String,
        nombreCompleto: j['nombreCompleto'] as String? ??
            '${j['nombres']} ${j['apellidos']}',
        correo: j['correo'] as String,
      );
}

// ── Asset list item ───────────────────────────────────────────────────────

@immutable
class AssetListItem {
  const AssetListItem({
    required this.id,
    required this.codigo,
    required this.nombre,
    required this.estado,
    this.descripcion,
    this.marca,
    this.modelo,
    this.categoria,
    this.ubicacion,
    this.area,
    this.responsable,
    this.creadoEn,
  });

  final String id;
  final String codigo;
  final String nombre;
  final EstadoActivo estado;
  final String? descripcion;
  final String? marca;
  final String? modelo;
  final Categoria? categoria;
  final Ubicacion? ubicacion;
  final Area? area;
  final UsuarioResumen? responsable;
  final String? creadoEn;

  factory AssetListItem.fromJson(Map<String, dynamic> j) => AssetListItem(
        id: j['id'] as String,
        codigo: j['codigo'] as String,
        nombre: j['nombre'] as String,
        estado: EstadoActivo.fromValue(j['estado'] as String? ?? 'OPERATIVO'),
        descripcion: j['descripcion'] as String?,
        marca: j['marca'] as String?,
        modelo: j['modelo'] as String?,
        categoria: j['categoria'] != null
            ? Categoria.fromJson(j['categoria'] as Map<String, dynamic>)
            : null,
        ubicacion: j['ubicacion'] != null
            ? Ubicacion.fromJson(j['ubicacion'] as Map<String, dynamic>)
            : null,
        area: j['area'] != null
            ? Area.fromJson(j['area'] as Map<String, dynamic>)
            : null,
        responsable: j['responsable'] != null
            ? UsuarioResumen.fromJson(j['responsable'] as Map<String, dynamic>)
            : null,
        creadoEn: j['creadoEn'] as String?,
      );
}

// ── Asset detail ──────────────────────────────────────────────────────────

@immutable
class AssetDetail extends AssetListItem {
  const AssetDetail({
    required super.id,
    required super.codigo,
    required super.nombre,
    required super.estado,
    super.descripcion,
    super.marca,
    super.modelo,
    super.categoria,
    super.ubicacion,
    super.area,
    super.responsable,
    super.creadoEn,
    this.numeroSerie,
    this.fechaAdquisicion,
    this.costoAdquisicion,
    this.vencimientoGarantia,
    this.historialTransferencias = const [],
  });

  final String? numeroSerie;
  final String? fechaAdquisicion;
  final num? costoAdquisicion;
  final String? vencimientoGarantia;
  final List<Transferencia> historialTransferencias;

  factory AssetDetail.fromJson(Map<String, dynamic> j) => AssetDetail(
        id: j['id'] as String,
        codigo: j['codigo'] as String,
        nombre: j['nombre'] as String,
        estado: EstadoActivo.fromValue(j['estado'] as String? ?? 'OPERATIVO'),
        descripcion: j['descripcion'] as String?,
        marca: j['marca'] as String?,
        modelo: j['modelo'] as String?,
        categoria: j['categoria'] != null
            ? Categoria.fromJson(j['categoria'] as Map<String, dynamic>)
            : null,
        ubicacion: j['ubicacion'] != null
            ? Ubicacion.fromJson(j['ubicacion'] as Map<String, dynamic>)
            : null,
        area: j['areaActual'] != null
            ? Area.fromJson(j['areaActual'] as Map<String, dynamic>)
            : null,
        responsable: j['responsableActual'] != null
            ? UsuarioResumen.fromJson(
                j['responsableActual'] as Map<String, dynamic>)
            : null,
        creadoEn: j['creadoEn'] as String?,
        numeroSerie: j['numeroSerie'] as String?,
        fechaAdquisicion: j['fechaAdquisicion'] as String?,
        costoAdquisicion: j['costoAdquisicion'] as num?,
        vencimientoGarantia: j['vencimientoGarantia'] as String?,
        historialTransferencias:
            (j['historialTransferencias'] as List<dynamic>?)
                    ?.map((e) =>
                        Transferencia.fromJson(e as Map<String, dynamic>))
                    .toList() ??
                [],
      );
}

@immutable
class Transferencia {
  const Transferencia({
    required this.id,
    required this.tipo,
    required this.fecha,
    this.detalle,
    this.areaOrigen,
    this.areaDestino,
    this.realizadoPor,
  });

  final String id;
  final String tipo;
  final String fecha;
  final String? detalle;
  final Area? areaOrigen;
  final Area? areaDestino;
  final UsuarioResumen? realizadoPor;

  factory Transferencia.fromJson(Map<String, dynamic> j) => Transferencia(
        id: j['id'] as String,
        tipo: j['tipo'] as String,
        fecha: j['fecha'] as String,
        detalle: j['detalle'] as String?,
        areaOrigen: j['areaOrigen'] != null
            ? Area.fromJson(j['areaOrigen'] as Map<String, dynamic>)
            : null,
        areaDestino: j['areaDestino'] != null
            ? Area.fromJson(j['areaDestino'] as Map<String, dynamic>)
            : null,
        realizadoPor: j['realizadoPor'] != null
            ? UsuarioResumen.fromJson(
                j['realizadoPor'] as Map<String, dynamic>)
            : null,
      );
}

// ── Pagination ────────────────────────────────────────────────────────────

@immutable
class PaginationMeta {
  const PaginationMeta({
    required this.total,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;

  factory PaginationMeta.fromJson(Map<String, dynamic> j) => PaginationMeta(
        total: j['total'] as int,
        page: j['page'] as int,
        pageSize: j['pageSize'] as int,
        totalPages: j['totalPages'] as int,
      );
}

// ── Create / Update payloads ───────────────────────────────────────────────

class CreateAssetPayload {
  CreateAssetPayload({
    required this.codigo,
    required this.nombre,
    this.descripcion,
    this.marca,
    this.modelo,
    this.numeroSerie,
    this.fechaAdquisicion,
    this.costoAdquisicion,
    this.vencimientoGarantia,
    this.categoriaId,
    this.ubicacionId,
    this.estado = EstadoActivo.operativo,
    this.areaActualId,
    this.responsableActualId,
  });

  String codigo;
  String nombre;
  String? descripcion;
  String? marca;
  String? modelo;
  String? numeroSerie;
  String? fechaAdquisicion;
  double? costoAdquisicion;
  String? vencimientoGarantia;
  String? categoriaId;
  String? ubicacionId;
  EstadoActivo estado;
  String? areaActualId;
  String? responsableActualId;

  Map<String, dynamic> toJson() => {
        'codigo': codigo,
        'nombre': nombre,
        if (descripcion != null) 'descripcion': descripcion,
        if (marca != null) 'marca': marca,
        if (modelo != null) 'modelo': modelo,
        if (numeroSerie != null) 'numeroSerie': numeroSerie,
        if (fechaAdquisicion != null) 'fechaAdquisicion': fechaAdquisicion,
        if (costoAdquisicion != null) 'costoAdquisicion': costoAdquisicion,
        if (vencimientoGarantia != null)
          'vencimientoGarantia': vencimientoGarantia,
        if (categoriaId != null) 'categoriaId': categoriaId,
        if (ubicacionId != null) 'ubicacionId': ubicacionId,
        'estado': estado.value,
        if (areaActualId != null) 'areaActualId': areaActualId,
        if (responsableActualId != null)
          'responsableActualId': responsableActualId,
      };
}

// ── Asset image ────────────────────────────────────────────────────────────

@immutable
class AssetImage {
  const AssetImage({
    required this.id,
    required this.activoId,
    required this.url,
    required this.nombreOriginal,
    required this.tipoMime,
    required this.tamano,
    required this.creadoEn,
  });

  final String id;
  final String activoId;

  /// Relative URL returned by backend, e.g. /uploads/activos/{id}/{file}.
  final String url;
  final String nombreOriginal;
  final String tipoMime;
  final int tamano;
  final String creadoEn;

  factory AssetImage.fromJson(Map<String, dynamic> j) => AssetImage(
        id: j['id'] as String,
        activoId: j['activoId'] as String? ?? '',
        url: j['url'] as String,
        nombreOriginal: j['nombreOriginal'] as String? ?? '',
        tipoMime: j['tipoMime'] as String? ?? '',
        tamano: (j['tamano'] as num?)?.toInt() ?? 0,
        creadoEn: j['creadoEn']?.toString() ?? '',
      );
}

// ── Search params ─────────────────────────────────────────────────────────

class SearchAssetsParams {
  SearchAssetsParams({
    this.q,
    this.estado,
    this.categoriaId,
    this.ubicacionId,
    this.page = 1,
    this.pageSize = 20,
    this.sortBy = 'creadoEn',
    this.sortType = 'DESC',
  });

  String? q;
  EstadoActivo? estado;
  String? categoriaId;
  String? ubicacionId;
  int page;
  int pageSize;
  String sortBy;
  String sortType;

  Map<String, dynamic> toQueryParams() => {
        if (q != null && q!.isNotEmpty) 'q': q,
        if (estado != null) 'estado': estado!.value,
        if (categoriaId != null) 'categoriaId': categoriaId,
        if (ubicacionId != null) 'ubicacionId': ubicacionId,
        'page': page.toString(),
        'pageSize': pageSize.toString(),
        'sortBy': sortBy,
        'sortType': sortType,
      };
}
