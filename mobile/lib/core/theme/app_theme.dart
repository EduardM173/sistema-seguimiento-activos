import 'package:flutter/material.dart';

/// Design tokens mirroring the web frontend's `variables.css`.
/// Monochromatic navy · gold accent · minimal typography.
abstract final class AppColors {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  static const bg         = Color(0xFF0D121F);
  static const bgElevated = Color(0xFF2B3446);
  static const surface    = Color(0xFF14202F);
  static const surfaceHigh= Color(0xFF1E2D40);

  // ── Primary — navy blue ──────────────────────────────────────────────────
  static const primary       = Color(0xFF1A5FAD);
  static const primaryHover  = Color(0xFF2272D0);
  static const primaryDark   = Color(0xFF0D3D75);
  static const primaryLight  = Color(0xFF5090D8);
  static const primaryMuted  = Color(0x231A5FAD);

  // ── Accent — gold ────────────────────────────────────────────────────────
  static const accent        = Color(0xFFC9A55C);
  static const accentDim     = Color(0x1FC9A55C);

  // ── Semantic ─────────────────────────────────────────────────────────────
  static const success       = Color(0xFF4E9B6F);
  static const successLight  = Color(0x1F4E9B6F);
  static const danger        = Color(0xFFC85A58);
  static const dangerLight   = Color(0x1FC85A58);
  static const warning       = Color(0xFFC9A55C);
  static const warningLight  = Color(0x1FC9A55C);

  // ── Text ─────────────────────────────────────────────────────────────────
  static const text          = Color(0xFFB8C4D4);
  static const textSecondary = Color(0xFFA0AABB);
  static const textMuted     = Color(0xFF6B7A8D);
  static const textBright    = Color(0xFFD8E2F0);
  static const textOnPrimary = Color(0xFFFFFFFF);

  // ── Borders ───────────────────────────────────────────────────────────────
  static const border        = Color(0x12FFFFFF);
  static const borderStrong  = Color(0x24FFFFFF);
}

abstract final class AppTheme {
  static ThemeData dark() {
    const colorScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: AppColors.primary,
      onPrimary: AppColors.textOnPrimary,
      secondary: AppColors.accent,
      onSecondary: Color(0xFF060C18),
      error: AppColors.danger,
      onError: AppColors.textOnPrimary,
      surface: AppColors.surface,
      onSurface: AppColors.text,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.bg,
      fontFamily: 'Roboto',

      // ── AppBar ────────────────────────────────────────────────────────────
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textBright,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.textBright,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
        iconTheme: IconThemeData(color: AppColors.text),
      ),

      // ── Bottom Nav ───────────────────────────────────────────────────────
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.primaryMuted,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.primary);
          }
          return const IconThemeData(color: AppColors.textMuted);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final color = states.contains(WidgetState.selected)
              ? AppColors.primary
              : AppColors.textMuted;
          return TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w500);
        }),
        elevation: 0,
        height: 64,
      ),

      // ── Cards ─────────────────────────────────────────────────────────────
      cardTheme: CardTheme(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border),
        ),
      ),

      // ── Input ─────────────────────────────────────────────────────────────
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceHigh,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        labelStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
        prefixIconColor: AppColors.textMuted,
      ),

      // ── ElevatedButton ────────────────────────────────────────────────────
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.textOnPrimary,
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          elevation: 0,
        ),
      ),

      // ── OutlinedButton ────────────────────────────────────────────────────
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.text,
          side: const BorderSide(color: AppColors.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          minimumSize: const Size(0, 44),
        ),
      ),

      // ── TextButton ────────────────────────────────────────────────────────
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),

      // ── Chip ──────────────────────────────────────────────────────────────
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceHigh,
        labelStyle: const TextStyle(color: AppColors.text, fontSize: 12),
        side: const BorderSide(color: AppColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      ),

      // ── Divider ───────────────────────────────────────────────────────────
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        space: 1,
        thickness: 1,
      ),

      // ── SnackBar ──────────────────────────────────────────────────────────
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.bgElevated,
        contentTextStyle: const TextStyle(color: AppColors.text),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
