import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/service_registry.dart';
import '../models/asset_models.dart';

final assetsRepositoryProvider = Provider<AssetsRepository>((ref) {
  return AssetsRepository(ref.read(apiClientProvider));
});

typedef ApiList<T> = ({List<T> data, PaginationMeta? meta});

class AssetsRepository {
  const AssetsRepository(this._client);
  final ApiClient _client;

  Future<ApiList<AssetListItem>> search(SearchAssetsParams params) async {
    final res = await _client.get<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/assets',
      queryParameters: params.toQueryParams(),
      fromJson: (d) => d as Map<String, dynamic>,
    );
    final items = (res['data'] as List<dynamic>)
        .map((e) => AssetListItem.fromJson(e as Map<String, dynamic>))
        .toList();
    final metaJson = res['meta'];
    final meta =
        metaJson != null ? PaginationMeta.fromJson(metaJson as Map<String, dynamic>) : null;
    return (data: items, meta: meta);
  }

  Future<AssetDetail> getById(String id) async {
    final res = await _client.get<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/assets/${Uri.encodeComponent(id)}',
      fromJson: (d) => d as Map<String, dynamic>,
    );
    return AssetDetail.fromJson(res['data'] as Map<String, dynamic>);
  }

  Future<AssetDetail> create(CreateAssetPayload payload) async {
    final res = await _client.post<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/assets',
      payload.toJson(),
      fromJson: (d) => d as Map<String, dynamic>,
    );
    return AssetDetail.fromJson(res['data'] as Map<String, dynamic>);
  }

  Future<AssetDetail> update(String id, Map<String, dynamic> payload) async {
    final res = await _client.patch<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/assets/${Uri.encodeComponent(id)}',
      payload,
      fromJson: (d) => d as Map<String, dynamic>,
    );
    return AssetDetail.fromJson(res['data'] as Map<String, dynamic>);
  }

  Future<void> delete(String id) async {
    await _client.delete<void>(
      ActivosService.backend,
      '/api/assets/${Uri.encodeComponent(id)}',
    );
  }

  Future<String> generateCode() async {
    final res = await _client.get<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/locations/generate-code',
      fromJson: (d) => d as Map<String, dynamic>,
    );
    return res['data'] as String? ?? '';
  }

  // ── Images ──────────────────────────────────────────────────────────────

  Future<List<AssetImage>> listImages(String assetId) async {
    final res = await _client.get<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/assets/${Uri.encodeComponent(assetId)}/images',
      fromJson: (d) => d as Map<String, dynamic>,
    );
    final list = res['data'] as List<dynamic>? ?? [];
    return list
        .map((e) => AssetImage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<AssetImage>> uploadImages(
      String assetId, List<File> files) async {
    final formData = FormData.fromMap({
      'files': await Future.wait(
        files.map((f) => MultipartFile.fromFile(f.path)),
      ),
    });
    final res = await _client.post<Map<String, dynamic>>(
      ActivosService.backend,
      '/api/assets/${Uri.encodeComponent(assetId)}/images',
      formData,
      fromJson: (d) => d as Map<String, dynamic>,
      options: Options(contentType: 'multipart/form-data'),
    );
    final list = res['data'] as List<dynamic>? ?? [];
    return list
        .map((e) => AssetImage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> deleteImage(String assetId, String imageId) async {
    await _client.delete<void>(
      ActivosService.backend,
      '/api/assets/${Uri.encodeComponent(assetId)}/images/${Uri.encodeComponent(imageId)}',
    );
  }
}
