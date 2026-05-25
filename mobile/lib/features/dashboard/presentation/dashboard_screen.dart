import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/service_registry.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/glass_card.dart';
import '../../auth/providers/auth_provider.dart';

// ── Dashboard stats model ──────────────────────────────────────────────────

class DashboardStats {
  const DashboardStats({
    this.totalActivos = 0,
    this.operativos = 0,
    this.mantenimiento = 0,
    this.fueraDeServicio = 0,
    this.dadosDeBaja = 0,
  });

  final int totalActivos;
  final int operativos;
  final int mantenimiento;
  final int fueraDeServicio;
  final int dadosDeBaja;

  factory DashboardStats.fromJson(Map<String, dynamic> j) {
    // Adapt to whatever shape the backend returns.
    // If there's a dedicated /dashboard endpoint, parse it. Otherwise derive.
    final data = (j['data'] ?? j) as Map<String, dynamic>;
    return DashboardStats(
      totalActivos: (data['totalActivos'] ?? data['total'] ?? 0) as int,
      operativos: (data['operativos'] ?? 0) as int,
      mantenimiento: (data['mantenimiento'] ?? 0) as int,
      fueraDeServicio: (data['fueraDeServicio'] ?? 0) as int,
      dadosDeBaja: (data['dadosDeBaja'] ?? 0) as int,
    );
  }
}

final dashboardStatsProvider = FutureProvider<DashboardStats>((ref) async {
  final client = ref.read(apiClientProvider);
  try {
    final res = await client.get<DashboardStats>(
      ActivosService.backend,
      '/api/dashboard',
      fromJson: (d) => DashboardStats.fromJson(d as Map<String, dynamic>),
    );
    return res;
  } catch (_) {
    // Fallback: derive from asset search totals
    return const DashboardStats();
  }
});

// ── Screen ─────────────────────────────────────────────────────────────────

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final userName = user is AuthAuthenticated ? user.user.nombres : '';
    final stats = ref.watch(dashboardStatsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Panel principal'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_outlined),
            tooltip: 'Cerrar sesión',
            onPressed: () => _confirmLogout(context, ref),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(dashboardStatsProvider.future),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Welcome ──────────────────────────────────────────────
              if (userName.isNotEmpty) ...[
                Text(
                  'Bienvenido, $userName',
                  style: const TextStyle(
                    color: AppColors.textBright,
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Sistema de Seguimiento de Activos',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                ),
                const SizedBox(height: 20),
              ],

              // ── Stats grid ───────────────────────────────────────────
              stats.when(
                loading: () => const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(),
                  ),
                ),
                error: (_, __) => const SizedBox.shrink(),
                data: (s) => _StatsGrid(stats: s),
              ),
              const SizedBox(height: 20),

              // ── Quick actions ────────────────────────────────────────
              const Text(
                'ACCIONES RÁPIDAS',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 10),
              _QuickActionsGrid(),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Cerrar sesión',
            style: TextStyle(color: AppColors.textBright)),
        content: const Text('¿Confirmas que deseas cerrar sesión?',
            style: TextStyle(color: AppColors.text)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Salir'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await ref.read(authNotifierProvider.notifier).logout();
      if (context.mounted) context.go('/login');
    }
  }
}

// ── Sub-widgets ─────────────────────────────────────────────────────────────

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});
  final DashboardStats stats;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _StatCard(
          label: 'Total activos',
          value: stats.totalActivos,
          icon: Icons.inventory_2_outlined,
          color: AppColors.primary,
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: 'Operativos',
                value: stats.operativos,
                icon: Icons.check_circle_outline,
                color: AppColors.success,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StatCard(
                label: 'Mantenimiento',
                value: stats.mantenimiento,
                icon: Icons.build_outlined,
                color: AppColors.warning,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: 'Fuera servicio',
                value: stats.fueraDeServicio,
                icon: Icons.cancel_outlined,
                color: AppColors.danger,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StatCard(
                label: 'Dados de baja',
                value: stats.dadosDeBaja,
                icon: Icons.archive_outlined,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final String label;
  final int value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value.toString(),
                    style: TextStyle(
                      color: color,
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(label,
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActionsGrid extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 8,
      mainAxisSpacing: 8,
      childAspectRatio: 1.8,
      children: [
        _ActionTile(
          icon: Icons.inventory_2_outlined,
          label: 'Ver activos',
          onTap: () => context.go('/activos'),
        ),
        _ActionTile(
          icon: Icons.add_box_outlined,
          label: 'Nuevo activo',
          onTap: () => context.go('/activos/crear'),
        ),
        _ActionTile(
          icon: Icons.qr_code_scanner,
          label: 'Escanear QR',
          onTap: () => context.go('/scanner'),
          highlight: true,
        ),
        _ActionTile(
          icon: Icons.camera_alt_outlined,
          label: 'Foto a activo',
          onTap: () => context.go('/captura'),
        ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.highlight = false,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Icon(
              icon,
              color: highlight ? AppColors.accent : AppColors.primary,
              size: 24,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: highlight ? AppColors.accent : AppColors.text,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
