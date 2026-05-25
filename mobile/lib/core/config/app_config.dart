/// Application configuration — set once at startup from the entry point.
/// All runtime code reads [AppConfig.instance].
library;

enum Flavor { dev, prod }

class AppConfig {
  AppConfig._({required this.flavor, required this.baseUrl});

  final Flavor flavor;

  /// Root URL without trailing slash (e.g. "https://app.dontrisk.org").
  final String baseUrl;

  static late AppConfig _instance;
  static AppConfig get instance => _instance;

  static void init({required Flavor flavor, required String baseUrl}) {
    _instance = AppConfig._(
      flavor: flavor,
      baseUrl: baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl,
    );
  }

  bool get isDev => flavor == Flavor.dev;
  bool get isProd => flavor == Flavor.prod;
}
