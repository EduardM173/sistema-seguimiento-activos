import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import '../models/auth_models.dart';

// ── State ──────────────────────────────────────────────────────────────────

sealed class AuthState {
  const AuthState();
}

final class AuthInitial extends AuthState {
  const AuthInitial();
}

final class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user);
  final AuthUser user;
}

final class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

final class AuthLoading extends AuthState {
  const AuthLoading();
}

final class AuthError extends AuthState {
  const AuthError(this.message);
  final String message;
}

// ── Notifier ───────────────────────────────────────────────────────────────

final authNotifierProvider =
    AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

class AuthNotifier extends AsyncNotifier<AuthState> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  Future<AuthState> build() async {
    final user = await _repo.getCachedUser();
    if (user != null && await _repo.hasSession()) {
      return AuthAuthenticated(user);
    }
    return const AuthUnauthenticated();
  }

  Future<bool> isLoggedIn() async {
    final s = await future;
    return s is AuthAuthenticated;
  }

  AuthUser? get currentUser {
    final s = state.valueOrNull;
    return s is AuthAuthenticated ? s.user : null;
  }

  bool hasPermission(String codigo) => currentUser?.hasPermission(codigo) ?? false;

  Future<void> login(String identifier, String password) async {
    state = const AsyncValue.data(AuthLoading());
    state = await AsyncValue.guard(() async {
      final result = await _repo.login(identifier, password);
      return AuthAuthenticated(result.usuario);
    });
    if (state.hasError) {
      state = AsyncValue.data(AuthError(state.error.toString()));
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AsyncValue.data(AuthUnauthenticated());
  }
}
