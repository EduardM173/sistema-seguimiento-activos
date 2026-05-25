import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/service_registry.dart';
import '../models/asset_models.dart';

final catalogsRepositoryProvider = Provider<CatalogsRepository>((ref) {
  return CatalogsRepository(ref.read(apiClientProvider));
});

/// Provides catalog data: categories, locations, areas, users.
/// Results are fetched once and cached for the session.
class CatalogsRepository {
  const CatalogsRepository(this._client);
  final ApiClient _client;

  Future<List<Categoria>> getCategorias() => _getList(
        '/api/catalogs/categorias',
        Categoria.fromJson,
      );

  Future<List<Ubicacion>> getUbicaciones() => _getList(
        '/api/catalogs/ubicaciones',
        Ubicacion.fromJson,
      );

  Future<List<Area>> getAreas() => _getList(
        '/api/catalogs/areas',
        Area.fromJson,
      );

  Future<List<UsuarioResumen>> getUsuarios() => _getList(
        '/api/catalogs/usuarios',
        UsuarioResumen.fromJson,
      );

  Future<List<T>> _getList<T>(
    String path,
    T Function(Map<String, dynamic>) fromJson,
  ) async {
    final res = await _client.get<Map<String, dynamic>>(
      ActivosService.backend,
      path,
      fromJson: (d) => d as Map<String, dynamic>,
    );
    return (res['data'] as List<dynamic>)
        .map((e) => fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

// ── Cached providers ───────────────────────────────────────────────────────

final categoriasProvider = FutureProvider<List<Categoria>>((ref) {
  return ref.read(catalogsRepositoryProvider).getCategorias();
});

final ubicacionesProvider = FutureProvider<List<Ubicacion>>((ref) {
  return ref.read(catalogsRepositoryProvider).getUbicaciones();
});

final areasProvider = FutureProvider<List<Area>>((ref) {
  return ref.read(catalogsRepositoryProvider).getAreas();
});

final usuariosProvider = FutureProvider<List<UsuarioResumen>>((ref) {
  return ref.read(catalogsRepositoryProvider).getUsuarios();
});
