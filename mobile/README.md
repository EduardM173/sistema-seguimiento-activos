# Activos Mobile

Flutter app for the **Sistema de Seguimiento de Activos** platform.

## Architecture

```
lib/
├── main_dev.dart          # DEV entry point
├── main_prod.dart         # PROD entry point
├── app.dart               # Root widget (MaterialApp.router)
├── core/
│   ├── config/            # Flavor config (AppConfig, Flavor enum)
│   ├── network/           # ApiClient (Dio), ServiceRegistry (Consul service enum)
│   ├── theme/             # AppTheme — dark navy + gold design tokens
│   └── router/            # go_router routes
├── features/
│   ├── auth/              # Login, AuthUser, JWT storage
│   ├── assets/            # Asset list, detail, create
│   ├── dashboard/         # Dashboard with stats
│   ├── scanner/           # QR code scanner → asset redirect
│   └── vision/            # Photo capture → agent analysis → form prefill
└── shared/
    └── widgets/           # GlassCard, StatusBadge, ActivosTextField, NavShell
```

## Flavors

| Flavor | Entry point | Base URL |
|--------|-------------|----------|
| **DEV** | `lib/main_dev.dart` | `http://<DEV_HOST>` |
| **PROD** | `lib/main_prod.dart` | `https://app.dontrisk.org` |

`DEV_HOST` = WiFi-accessible IP + port of the Vite dev server or nginx  
(e.g. `192.168.1.100:3000`).

## Setup

1. Make sure Flutter SDK ≥ 3.3 is installed.
2. Update `android/local.properties` with your Flutter SDK and Android SDK paths:

```properties
flutter.sdk=/path/to/flutter
sdk.dir=/path/to/Android/Sdk
```

3. Get dependencies:

```bash
flutter pub get
```

### Android permissions

Add to `android/app/src/main/AndroidManifest.xml` inside `<manifest>`:

```xml
<!-- Camera -->
<uses-permission android:name="android.permission.CAMERA" />
<!-- Internet -->
<uses-permission android:name="android.permission.INTERNET" />
```

### iOS permissions

Add to `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Se necesita la cámara para escanear códigos QR y tomar fotos de activos.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Se necesita acceso a la galería para seleccionar fotos de activos.</string>
```

## Running

### DEV (WiFi, same network as services)

```bash
flutter run -t lib/main_dev.dart \
  --dart-define=DEV_HOST=192.168.1.100:3000
```

### PROD

```bash
flutter run -t lib/main_prod.dart
```

### Build release APK (PROD)

```bash
flutter build apk -t lib/main_prod.dart --release
```

## Key features

- **Login** — JWT token stored in `flutter_secure_storage`
- **Asset list** — paginated, search + filters (estado, categoría)
- **Asset detail** — full info + QR display
- **QR Scanner** — `mobile_scanner`; parses `/activos/<id>` URLs and navigates
- **Photo → Agent** — upload a photo to `POST /vision/analyze` on the agent  
  service; Gemini Vision extracts fields; form is prefilled automatically
- **Create asset** — all catalog selectors; duplicate detection from agent

## Service URL pattern

URLs follow the same Consul-prefix pattern as the web frontend:

```
{baseUrl}/{consulServiceName}/...
```

e.g. `https://app.dontrisk.org/activos-backend/api/auth/login`

The `ActivosService` enum in `lib/core/network/service_registry.dart` is the  
Dart equivalent of the TypeScript `@activos/config` package.
