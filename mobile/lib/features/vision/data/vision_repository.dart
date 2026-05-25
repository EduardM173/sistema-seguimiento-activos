import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/service_registry.dart';

final visionRepositoryProvider = Provider<VisionRepository>((ref) {
  return VisionRepository(ref.read(apiClientProvider));
});

/// Response from POST /vision/analyze
class VisionAnalysisResult {
  const VisionAnalysisResult({
    required this.partial,
    this.existingAssetId,
    this.existingAssetCode,
    required this.confidence,
    required this.notes,
  });

  /// Partial CreateAssetPayload fields detected from the image.
  final Map<String, dynamic> partial;

  /// ID of an existing asset that matches, if found (null otherwise).
  final String? existingAssetId;
  final String? existingAssetCode;

  /// Confidence score 0–1.
  final double confidence;

  /// Human-readable notes from the agent.
  final String notes;

  factory VisionAnalysisResult.fromJson(Map<String, dynamic> j) =>
      VisionAnalysisResult(
        partial: (j['partial'] as Map<String, dynamic>?) ?? {},
        existingAssetId: j['existingAssetId'] as String?,
        existingAssetCode: j['existingAssetCode'] as String?,
        confidence: ((j['confidence'] as num?) ?? 0).toDouble(),
        notes: j['notes'] as String? ?? '',
      );

  /// Returns a map suitable for passing as `extra` to go_router.
  Map<String, dynamic> toRouterExtra() => {
        'partial': partial,
        'existingAssetId': existingAssetId,
        'existingAssetCode': existingAssetCode,
        'confidence': confidence,
        'notes': notes,
      };
}

class VisionRepository {
  const VisionRepository(this._client);
  final ApiClient _client;

  Future<VisionAnalysisResult> analyzePhoto(File imageFile) async {
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(
        imageFile.path,
        filename: 'asset_photo.jpg',
      ),
    });

    final result = await _client.post<VisionAnalysisResult>(
      ActivosService.agent,
      '/vision/analyze',
      formData,
      fromJson: (d) =>
          VisionAnalysisResult.fromJson(d as Map<String, dynamic>),
      options: Options(contentType: 'multipart/form-data'),
    );

    return result;
  }
}
