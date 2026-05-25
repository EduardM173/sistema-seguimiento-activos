// ─── PROD entry point ──────────────────────────────────────────────────────
// Build with:
//   flutter build apk -t lib/main_prod.dart --release
//   flutter build ios -t lib/main_prod.dart --release
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_config.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  AppConfig.init(
    flavor: Flavor.prod,
    baseUrl: 'https://app.dontrisk.org',
  );

  runApp(const ProviderScope(child: ActivosApp()));
}
