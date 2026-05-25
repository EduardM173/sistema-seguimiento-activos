import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/service_registry.dart';
import '../models/auth_models.dart';

const _userKey = 'auth_user';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.read(apiClientProvider));
});

class AuthRepository {
  AuthRepository(this._client)
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
        );

  final ApiClient _client;
  final FlutterSecureStorage _storage;

  Future<LoginResponse> login(String identifier, String password) async {
    final result = await _client.post<LoginResponse>(
      ActivosService.backend,
      '/api/auth/login',
      {'identifier': identifier, 'password': password},
      fromJson: (data) =>
          LoginResponse.fromJson(data as Map<String, dynamic>),
    );

    await _client.saveToken(result.accessToken);
    await _storage.write(key: _userKey, value: jsonEncode(_userToJson(result.usuario)));
    return result;
  }

  Future<AuthUser?> getCachedUser() async {
    final raw = await _storage.read(key: _userKey);
    if (raw == null) return null;
    try {
      return AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<AuthUser> fetchCurrentSession() async {
    final result = await _client.get<AuthUser>(
      ActivosService.backend,
      '/api/auth/me',
      fromJson: (data) {
        final map = data as Map<String, dynamic>;
        final usuario = map['usuario'] ?? map;
        return AuthUser.fromJson(usuario as Map<String, dynamic>);
      },
    );
    await _storage.write(key: _userKey, value: jsonEncode(_userToJson(result)));
    return result;
  }

  Future<void> logout() async {
    await _client.clearToken();
    await _storage.delete(key: _userKey);
  }

  Future<bool> hasSession() => _client.hasToken();

  // ── Serialisation helper (enough fields to reconstruct) ──────────────────
  Map<String, dynamic> _userToJson(AuthUser u) => {
    'id': u.id,
    'nombres': u.nombres,
    'apellidos': u.apellidos,
    'correo': u.correo,
    'nombreUsuario': u.nombreUsuario,
    'estado': u.estado,
    'rol': {'id': u.rol.id, 'nombre': u.rol.nombre},
    'area': u.area == null ? null : {'id': u.area!.id, 'nombre': u.area!.nombre},
    'permisos': u.permisos
        .map((p) => {'id': p.id, 'codigo': p.codigo, 'nombre': p.nombre})
        .toList(),
  };
}
