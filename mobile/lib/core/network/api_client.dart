import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../network/service_registry.dart';

const _tokenKey = 'access_token';

/// Riverpod provider for the shared [ApiClient].
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient._create());

class ApiClient {
  ApiClient._(this._dio, this._storage);

  factory ApiClient._create() {
    final dio = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      validateStatus: (status) => status != null && status < 500,
    ));

    const storage = FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
    );

    final client = ApiClient._(dio, storage);

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.read(key: _tokenKey);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onResponse: (response, handler) {
        if (response.statusCode == 401) {
          client.clearToken();
        }
        return handler.next(response);
      },
    ));

    return client;
  }

  final Dio _dio;
  final FlutterSecureStorage _storage;

  // ── Token management ────────────────────────────────────────────────────

  Future<void> saveToken(String token) => _storage.write(key: _tokenKey, value: token);
  Future<void> clearToken() => _storage.delete(key: _tokenKey);
  Future<String?> getToken() => _storage.read(key: _tokenKey);
  Future<bool> hasToken() async => (await _storage.read(key: _tokenKey)) != null;

  // ── HTTP verbs ──────────────────────────────────────────────────────────

  Future<T> get<T>(
    ActivosService service,
    String path, {
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
  }) async {
    final url = ServiceRegistry.urlFor(service, path);
    final response = await _dio.get<dynamic>(url, queryParameters: queryParameters);
    return _handle<T>(response, fromJson);
  }

  Future<T> post<T>(
    ActivosService service,
    String path,
    dynamic data, {
    T Function(dynamic)? fromJson,
    Options? options,
  }) async {
    final url = ServiceRegistry.urlFor(service, path);
    final response = await _dio.post<dynamic>(url, data: data, options: options);
    return _handle<T>(response, fromJson);
  }

  Future<T> patch<T>(
    ActivosService service,
    String path,
    dynamic data, {
    T Function(dynamic)? fromJson,
  }) async {
    final url = ServiceRegistry.urlFor(service, path);
    final response = await _dio.patch<dynamic>(url, data: data);
    return _handle<T>(response, fromJson);
  }

  Future<T> delete<T>(
    ActivosService service,
    String path, {
    T Function(dynamic)? fromJson,
  }) async {
    final url = ServiceRegistry.urlFor(service, path);
    final response = await _dio.delete<dynamic>(url);
    return _handle<T>(response, fromJson);
  }

  // ── Internal ────────────────────────────────────────────────────────────

  T _handle<T>(Response<dynamic> response, T Function(dynamic)? fromJson) {
    final status = response.statusCode ?? 0;
    if (status >= 400) {
      final message = _extractMessage(response.data) ?? 'Error $status';
      throw ApiException(message, status);
    }
    if (fromJson != null) return fromJson(response.data);
    return response.data as T;
  }

  String? _extractMessage(dynamic data) {
    if (data is Map) return data['message']?.toString();
    return null;
  }
}

class ApiException implements Exception {
  const ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;

  @override
  String toString() => 'ApiException($statusCode): $message';
}
