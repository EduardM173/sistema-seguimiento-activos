import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/app_theme.dart';

class QrScannerScreen extends ConsumerStatefulWidget {
  const QrScannerScreen({super.key});

  @override
  ConsumerState<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends ConsumerState<QrScannerScreen> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back,
    torchEnabled: false,
  );
  bool _processing = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_processing) return;
    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null) return;

    final raw = barcode.rawValue;
    if (raw == null || raw.isEmpty) return;

    setState(() => _processing = true);
    final assetId = _extractAssetId(raw);

    if (assetId != null) {
      context.go('/activos/$assetId');
    } else {
      _showUnknownQrDialog(raw);
    }
  }

  /// Extracts the asset UUID from a QR URL.
  ///
  /// Matches patterns:
  ///   - https://app.dontrisk.org/activos/<id>
  ///   - http://192.168.x.x:3000/activos/<id>
  ///   - /activos/<id>  (bare path)
  String? _extractAssetId(String raw) {
    // Parse as URL first
    Uri? uri;
    try {
      uri = Uri.parse(raw);
    } catch (_) {}

    if (uri != null) {
      final segments = uri.pathSegments;
      final idx = segments.indexOf('activos');
      if (idx != -1 && idx + 1 < segments.length) {
        final id = segments[idx + 1];
        if (id.isNotEmpty) return id;
      }
    }

    // Fallback: regex match on /activos/<id>
    final match = RegExp(r'/activos/([^/?#\s]+)').firstMatch(raw);
    return match?.group(1);
  }

  Future<void> _showUnknownQrDialog(String raw) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('QR no reconocido',
            style: TextStyle(color: AppColors.textBright)),
        content: Text(
          'El código QR escaneado no corresponde a un activo del sistema:\n\n$raw',
          style: const TextStyle(color: AppColors.text, fontSize: 13),
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              setState(() => _processing = false);
            },
            child: const Text('Escanear de nuevo'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: BackButton(
          color: Colors.white,
          onPressed: () => context.go('/activos'),
        ),
        title: const Text('Escanear QR',
            style: TextStyle(color: Colors.white, shadows: [
              Shadow(color: Colors.black54, blurRadius: 4),
            ])),
        actions: [
          ValueListenableBuilder(
            valueListenable: _controller,
            builder: (ctx, value, child) {
              final torchOn =
                  value.torchState == TorchState.on;
              return IconButton(
                icon: Icon(
                  torchOn ? Icons.flashlight_off : Icons.flashlight_on,
                  color: Colors.white,
                ),
                onPressed: () => _controller.toggleTorch(),
              );
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          // ── Camera feed ───────────────────────────────────────────────
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),

          // ── Scan overlay ──────────────────────────────────────────────
          _ScanOverlay(),

          // ── Bottom label ──────────────────────────────────────────────
          Positioned(
            bottom: 60,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const Text(
                    'Apunta la cámara al código QR del activo',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w500),
                    textAlign: TextAlign.center,
                  ),
                ),
                if (_processing) ...[
                  const SizedBox(height: 12),
                  const CircularProgressIndicator(color: Colors.white),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Rectangular scan-area overlay with corner markers.
class _ScanOverlay extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _OverlayPainter(),
      child: const SizedBox.expand(),
    );
  }
}

class _OverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final dimPaint = Paint()..color = Colors.black.withOpacity(0.55);
    const boxSize = 260.0;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final rect = Rect.fromCenter(
        center: Offset(cx, cy), width: boxSize, height: boxSize);

    // Dim everything outside the scan area
    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height)),
        Path()..addRRect(RRect.fromRectAndRadius(rect, const Radius.circular(12))),
      ),
      dimPaint,
    );

    // Corner markers
    const markerLen = 28.0;
    const markerWidth = 3.0;
    const markerColor = AppColors.accent;
    final markerPaint = Paint()
      ..color = markerColor
      ..strokeWidth = markerWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final corners = [
      (rect.topLeft, 1.0, 1.0),
      (rect.topRight, -1.0, 1.0),
      (rect.bottomLeft, 1.0, -1.0),
      (rect.bottomRight, -1.0, -1.0),
    ];

    for (final (corner, dx, dy) in corners) {
      canvas.drawLine(corner, corner.translate(dx * markerLen, 0), markerPaint);
      canvas.drawLine(corner, corner.translate(0, dy * markerLen), markerPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
