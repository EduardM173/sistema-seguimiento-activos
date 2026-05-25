import 'package:flutter/foundation.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Category
// ─────────────────────────────────────────────────────────────────────────────

@immutable
class CategoriaMaterial {
  const CategoriaMaterial({
    required this.id,
    required this.nombre,
    this.descripcion,
  });
  final String id;
  final String nombre;
  final String? descripcion;

  factory CategoriaMaterial.fromJson(Map<String, dynamic> j) =>
      CategoriaMaterial(
        id: j['id'] as String,
        nombre: j['nombre'] as String,
        descripcion: j['descripcion'] as String?,
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Material
// ─────────────────────────────────────────────────────────────────────────────

@immutable
class Material {
  const Material({
    required this.id,
    required this.codigo,
    required this.nombre,
    this.descripcion,
    required this.unidad,
    required this.stockActual,
    required this.stockMinimo,
    this.categoriaId,
    this.categoria,
    this.areaId,
    this.areaNombre,
    this.creadoEn,
  });

  final String id;
  final String codigo;
  final String nombre;
  final String? descripcion;
  final String unidad;
  final double stockActual;
  final double stockMinimo;
  final String? categoriaId;
  final CategoriaMaterial? categoria;
  final String? areaId;
  final String? areaNombre;
  final String? creadoEn;

  bool get stockBajo => stockActual <= stockMinimo;

  factory Material.fromJson(Map<String, dynamic> j) => Material(
        id: j['id'] as String,
        codigo: j['codigo'] as String,
        nombre: j['nombre'] as String,
        descripcion: j['descripcion'] as String?,
        unidad: j['unidad'] as String? ?? '',
        stockActual: ((j['stockActual'] as num?) ?? 0).toDouble(),
        stockMinimo: ((j['stockMinimo'] as num?) ?? 0).toDouble(),
        categoriaId: j['categoriaId'] as String?,
        categoria: j['categoria'] != null
            ? CategoriaMaterial.fromJson(
                j['categoria'] as Map<String, dynamic>)
            : null,
        areaId: j['areaId'] as String?,
        areaNombre:
            (j['area'] as Map<String, dynamic>?)?['nombre'] as String?,
        creadoEn: j['creadoEn']?.toString(),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Material image
// ─────────────────────────────────────────────────────────────────────────────

@immutable
class MaterialImage {
  const MaterialImage({
    required this.id,
    required this.materialId,
    required this.url,
    required this.nombreOriginal,
    required this.tipoMime,
    required this.tamano,
  });

  final String id;
  final String materialId;
  final String url;
  final String nombreOriginal;
  final String tipoMime;
  final int tamano;

  factory MaterialImage.fromJson(Map<String, dynamic> j) => MaterialImage(
        id: j['id'] as String,
        materialId: j['materialId'] as String? ?? '',
        url: j['url'] as String,
        nombreOriginal: j['nombreOriginal'] as String? ?? '',
        tipoMime: j['tipoMime'] as String? ?? '',
        tamano: (j['tamano'] as num?)?.toInt() ?? 0,
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Payloads
// ─────────────────────────────────────────────────────────────────────────────

class CreateMaterialPayload {
  CreateMaterialPayload({
    required this.codigo,
    required this.nombre,
    required this.unidad,
    required this.stockActual,
    required this.stockMinimo,
    this.descripcion,
    this.categoriaId,
    this.areaId,
  });

  String codigo;
  String nombre;
  String unidad;
  double stockActual;
  double stockMinimo;
  String? descripcion;
  String? categoriaId;
  String? areaId;

  Map<String, dynamic> toJson() => {
        'codigo': codigo,
        'nombre': nombre,
        'unidad': unidad,
        'stockActual': stockActual,
        'stockMinimo': stockMinimo,
        if (descripcion != null) 'descripcion': descripcion,
        if (categoriaId != null) 'categoriaId': categoriaId,
        if (areaId != null) 'areaId': areaId,
      };
}

class UpdateMaterialPayload {
  UpdateMaterialPayload({
    this.nombre,
    this.descripcion,
    this.unidad,
    this.stockActual,
    this.stockMinimo,
    this.categoriaId,
    this.areaId,
  });

  String? nombre;
  String? descripcion;
  String? unidad;
  double? stockActual;
  double? stockMinimo;
  String? categoriaId;
  String? areaId;

  Map<String, dynamic> toJson() => {
        if (nombre != null) 'nombre': nombre,
        if (descripcion != null) 'descripcion': descripcion,
        if (unidad != null) 'unidad': unidad,
        if (stockActual != null) 'stockActual': stockActual,
        if (stockMinimo != null) 'stockMinimo': stockMinimo,
        if (categoriaId != null) 'categoriaId': categoriaId,
        if (areaId != null) 'areaId': areaId,
      };
}
