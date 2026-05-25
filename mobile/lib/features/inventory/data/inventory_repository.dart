import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/service_registry.dart';
import '../models/inventory_models.dart';

final inventoryRepositoryProvider = Provider<InventoryRepository>((ref) {
  return InventoryRepository(ref.read(apiClientProvider));
});

class InventoryRepository {
  const InventoryRepository(this._client);
  final ApiClient _client;

  // ── CRUD ────────────────────────────────────────────────────────────────

  Future<List<Material>> listAll() async {
    final res = await _client.get<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/materials',
      fromJson: (d) => d as Map<String, dynamic>,
    );
    final data = res['data'];
    final list = data is List ? data : (data as Map?)?['items'] as List? ?? [];
    return list
        .map((e) => Material.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Material> getById(String id) async {
    final res = await _client.get<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/materials/${Uri.encodeComponent(id)}',
      fromJson: (d) => d as Map<String, dynamic>,
    );
    return Material.fromJson(res['data'] as Map<String, dynamic>);
  }

  Future<Material> create(CreateMaterialPayload payload) async {
    final res = await _client.post<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/materials',
      payload.toJson(),
      fromJson: (d) => d as Map<String, dynamic>,
    );
    // Some endpoints wrap in { data: ... }, others return the object directly
    final body = res['data'] ?? res;
    return Material.fromJson(body as Map<String, dynamic>);
  }

  Future<Material> update(String id, UpdateMaterialPayload payload) async {
    final res = await _client.patch<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/materials/${Uri.encodeComponent(id)}',
      payload.toJson(),
      fromJson: (d) => d as Map<String, dynamic>,
    );
    final body = res['data'] ?? res;
    return Material.fromJson(body as Map<String, dynamic>);
  }

  Future<void> delete(String id) async {
    await _client.delete<void>(
      ActivosService.backend,
      '/api/materials/${Uri.encodeComponent(id)}',
    );
  }

  // ── Categories ──────────────────────────────────────────────────────────

  Future<List<CategoriaMaterial>> listCategorias() async {
    final res = await _client.get<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/categories/material',
      fromJson: (d) => d as Map<String, dynamic>,
    );
    final list = (res['data'] as List<dynamic>?) ?? [];
    return list
        .map((e) => CategoriaMaterial.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Images ──────────────────────────────────────────────────────────────

  Future<List<MaterialImage>> listImages(String materialId) async {
    final res = await _client.get<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/materials/${Uri.encodeComponent(materialId)}/images',
      fromJson: (d) => d as Map<String, dynamic>,
    );
    final list = res['data'] as List<dynamic>? ?? [];
    return list
        .map((e) => MaterialImage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<MaterialImage>> uploadImages(
      String materialId, List<File> files) async {
    final formData = FormData.fromMap({
      'files': await Future.wait(
        files.map((f) => MultipartFile.fromFile(f.path)),
      ),
    });
    final res = await _client.post<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/materials/${Uri.encodeComponent(materialId)}/images',
      formData,
      fromJson: (d) => d as Map<String, dynamic>,
      options: Options(contentType: 'multipart/form-data'),
    );
    final list = res['data'] as List<dynamic>? ?? [];
    return list
        .map((e) => MaterialImage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> deleteImage(String materialId, String imageId) async {
    await _client.delete<void>(
      ActivosService.backend,
      '/api/materials/${Uri.encodeComponent(materialId)}/images/${Uri.encodeComponent(imageId)}',
    );
  }
}
