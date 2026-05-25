import 'package:flutter/material.dart';
import '../../features/assets/models/asset_models.dart';
import '../../core/theme/app_theme.dart';

/// Colored status pill matching the web frontend's `.statusBadge--*` classes.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.estado});
  final EstadoActivo estado;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _colors(estado);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: fg.withOpacity(0.3)),
      ),
      child: Text(
        estado.label,
        style: TextStyle(
          color: fg,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  static (Color bg, Color fg) _colors(EstadoActivo e) => switch (e) {
        EstadoActivo.operativo     => (AppColors.successLight, AppColors.success),
        EstadoActivo.mantenimiento => (AppColors.warningLight, AppColors.warning),
        EstadoActivo.fueraDeServicio => (AppColors.dangerLight, AppColors.danger),
        EstadoActivo.dadoDeBaja    => (AppColors.border, AppColors.textMuted),
      };
}
