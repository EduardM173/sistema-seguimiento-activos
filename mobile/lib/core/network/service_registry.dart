/// Dart equivalent of the TypeScript `ActivosService` enum.
///
/// Each value is the Consul service name — also the URL prefix used by
/// nginx / Vite proxy to route requests to the correct microservice.
///
/// Usage:
///   final url = ServiceRegistry.urlFor(ActivosService.backend, '/api/auth/login');
///   // → "https://app.dontrisk.org/activos-backend/api/auth/login"
library;

import '../config/app_config.dart';

enum ActivosService {
  backend('activos-backend'),
  reports('activos-reports'),
  auditoria('activos-auditoria'),
  agent('activos-agent');

  const ActivosService(this.consulName);

  /// The Consul service name / URL path segment.
  final String consulName;
}

abstract final class ServiceRegistry {
  /// Builds a full URL for [service] + [path].
  ///
  /// [path] must start with '/'.
  /// Example: `ServiceRegistry.urlFor(ActivosService.backend, '/api/assets')`
  static String urlFor(ActivosService service, String path) {
    final base = AppConfig.instance.baseUrl;
    final sanitisedPath = path.startsWith('/') ? path : '/$path';
    return '$base/${service.consulName}$sanitisedPath';
  }
}
