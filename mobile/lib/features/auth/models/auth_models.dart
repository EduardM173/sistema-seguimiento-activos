import 'package:flutter/foundation.dart';

@immutable
class AuthUser {
  const AuthUser({
    required this.id,
    required this.nombres,
    required this.apellidos,
    required this.correo,
    required this.nombreUsuario,
    required this.estado,
    required this.rol,
    this.area,
    this.permisos = const [],
  });

  final String id;
  final String nombres;
  final String apellidos;
  final String correo;
  final String nombreUsuario;
  final String estado;
  final AuthRol rol;
  final AuthArea? area;
  final List<AuthPermiso> permisos;

  String get nombreCompleto => '$nombres $apellidos';

  bool hasPermission(String codigo) =>
      permisos.any((p) => p.codigo == codigo);

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: json['id'] as String,
    nombres: json['nombres'] as String,
    apellidos: json['apellidos'] as String,
    correo: json['correo'] as String,
    nombreUsuario: json['nombreUsuario'] as String,
    estado: json['estado'] as String,
    rol: AuthRol.fromJson(json['rol'] as Map<String, dynamic>),
    area: json['area'] != null
        ? AuthArea.fromJson(json['area'] as Map<String, dynamic>)
        : null,
    permisos: (json['permisos'] as List<dynamic>?)
            ?.map((e) => AuthPermiso.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [],
  );
}

@immutable
class AuthRol {
  const AuthRol({required this.id, required this.nombre});
  final String id;
  final String nombre;
  factory AuthRol.fromJson(Map<String, dynamic> json) =>
      AuthRol(id: json['id'] as String, nombre: json['nombre'] as String);
}

@immutable
class AuthArea {
  const AuthArea({required this.id, required this.nombre});
  final String id;
  final String nombre;
  factory AuthArea.fromJson(Map<String, dynamic> json) =>
      AuthArea(id: json['id'] as String, nombre: json['nombre'] as String);
}

@immutable
class AuthPermiso {
  const AuthPermiso({required this.id, required this.codigo, required this.nombre});
  final String id;
  final String codigo;
  final String nombre;
  factory AuthPermiso.fromJson(Map<String, dynamic> json) => AuthPermiso(
    id: json['id'] as String,
    codigo: json['codigo'] as String,
    nombre: json['nombre'] as String,
  );
}

@immutable
class LoginResponse {
  const LoginResponse({required this.accessToken, required this.usuario});
  final String accessToken;
  final AuthUser usuario;

  factory LoginResponse.fromJson(Map<String, dynamic> json) => LoginResponse(
    accessToken: json['accessToken'] as String,
    usuario: AuthUser.fromJson(json['usuario'] as Map<String, dynamic>),
  );
}
