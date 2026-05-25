import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/providers/auth_provider.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/assets/presentation/assets_list_screen.dart';
import '../../features/assets/presentation/asset_detail_screen.dart';
import '../../features/assets/presentation/create_asset_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/inventory/presentation/inventory_list_screen.dart';
import '../../features/inventory/presentation/material_detail_screen.dart';
import '../../features/inventory/presentation/create_material_screen.dart';
import '../../features/scanner/presentation/qr_scanner_screen.dart';
import '../../shared/widgets/nav_shell.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.read(authNotifierProvider.notifier);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) async {
      final isLoggedIn = await authNotifier.isLoggedIn();
      final goingToLogin = state.matchedLocation == '/login';

      if (!isLoggedIn && !goingToLogin) return '/login';
      if (isLoggedIn && goingToLogin) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => NavShell(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/activos',
            builder: (context, state) => const AssetsListScreen(),
            routes: [
              GoRoute(
                path: 'crear',
                builder: (context, state) {
                  final prefill = state.extra as Map<String, dynamic>?;
                  return CreateAssetScreen(prefill: prefill);
                },
              ),
              GoRoute(
                path: ':id',
                builder: (context, state) => AssetDetailScreen(
                  assetId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/inventario',
            builder: (context, state) => const InventoryListScreen(),
            routes: [
              GoRoute(
                path: 'crear',
                builder: (context, state) => const CreateMaterialScreen(),
              ),
              GoRoute(
                path: ':id',
                builder: (context, state) => MaterialDetailScreen(
                  materialId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/scanner',
            builder: (context, state) => const QrScannerScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Página no encontrada: ${state.error}',
            style: const TextStyle(color: Colors.white)),
      ),
    ),
  );
});
