// ─── DEV entry point ───────────────────────────────────────────────────────
// Run with:
//   flutter run -t lib/main_dev.dart \
//     --dart-define=DEV_HOST=192.168.1.100:3000
//
// DEV_HOST  = <wifi_ip>:<port> where the Vite dev server (or nginx dev) is
//             reachable from the mobile device on the same network.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_config.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  AppConfig.init(
    flavor: Flavor.dev,
    baseUrl: 'http://${const String.fromEnvironment('DEV_HOST', defaultValue: '192.168.1.100:3000')}',
  );

  runApp(const ProviderScope(child: ActivosApp()));
}
