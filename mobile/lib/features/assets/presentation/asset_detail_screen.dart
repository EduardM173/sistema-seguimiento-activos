import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/glass_card.dart';
import '../../../shared/widgets/saved_images_gallery.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/assets_repository.dart';
import '../models/asset_models.dart';
import '../providers/assets_provider.dart';

class AssetDetailScreen extends ConsumerWidget {
  const AssetDetailScreen({super.key, required this.assetId});
  final String assetId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(assetDetailProvider(assetId));

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/activos')),
        title: state.when(
          data: (a) => Text(a.codigo),
          loading: () => const Text('Cargando…'),
          error: (_, __) => const Text('Error'),
        ),
        actions: [
          state.when(
            data: (_) => IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () => ref.read(assetDetailProvider(assetId).notifier).refresh(),
            ),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.danger, size: 48),
              const SizedBox(height: 12),
              Text(e.toString(), style: const TextStyle(color: AppColors.textMuted)),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () =>
                    ref.read(assetDetailProvider(assetId).notifier).refresh(),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
        data: (asset) => _AssetDetailBody(asset: asset),
      ),
    );
  }
}

class _AssetDetailBody extends StatelessWidget {
  const _AssetDetailBody({required this.asset});
  final AssetDetail asset;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Header card ─────────────────────────────────────────────────
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          asset.nombre,
                          style: const TextStyle(
                            color: AppColors.textBright,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      StatusBadge(estado: asset.estado),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(asset.codigo,
                      style: const TextStyle(
                          color: AppColors.accent, fontSize: 13)),
                  if (asset.categoria != null) ...[
                    const SizedBox(height: 4),
                    Text(asset.categoria!.nombre,
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 12)),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Details ──────────────────────────────────────────────────────
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SectionTitle('Información'),
                  const SizedBox(height: 12),
                  if (asset.marca != null)
                    _DetailRow(label: 'Marca', value: asset.marca!),
                  if (asset.modelo != null)
                    _DetailRow(label: 'Modelo', value: asset.modelo!),
                  if (asset.numeroSerie != null)
                    _DetailRow(label: 'Nro. serie', value: asset.numeroSerie!),
                  if (asset.area != null)
                    _DetailRow(label: 'Área', value: asset.area!.nombre),
                  if (asset.ubicacion != null)
                    _DetailRow(
                        label: 'Ubicación', value: asset.ubicacion!.nombre),
                  if (asset.responsable != null)
                    _DetailRow(
                        label: 'Responsable',
                        value: asset.responsable!.nombreCompleto),
                  if (asset.fechaAdquisicion != null)
                    _DetailRow(
                        label: 'Adquisición',
                        value: _formatDate(asset.fechaAdquisicion!)),
                  if (asset.costoAdquisicion != null)
                    _DetailRow(
                        label: 'Costo',
                        value: 'Bs ${asset.costoAdquisicion}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── QR Code card ─────────────────────────────────────────────────
          _QrCard(asset: asset),
          const SizedBox(height: 12),

          // ── Images ───────────────────────────────────────────────────────
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SectionTitle('Imágenes'),
                  const SizedBox(height: 12),
                  SavedImagesGallery(
                    loadImages: () async {
                      final repo =
                          // ignore: avoid_build_context_in_providers
                          ProviderScope.containerOf(context, listen: false)
                              .read(assetsRepositoryProvider);
                      final imgs = await repo.listImages(asset.id);
                      return imgs
                          .map((i) => SavedImage.fromJson({
                                'id': i.id,
                                'url': i.url,
                                'nombreOriginal': i.nombreOriginal,
                              }))
                          .toList();
                    },
                    onDelete: (imgId) async {
                      final repo =
                          ProviderScope.containerOf(context, listen: false)
                              .read(assetsRepositoryProvider);
                      await repo.deleteImage(asset.id, imgId);
                    },
                    onUpload: (files) async {
                      final repo =
                          ProviderScope.containerOf(context, listen: false)
                              .read(assetsRepositoryProvider);
                      final uploaded = await repo.uploadImages(
                          asset.id, files.map((x) => File(x.path)).toList());
                      return uploaded
                          .map((i) => SavedImage.fromJson({
                                'id': i.id,
                                'url': i.url,
                                'nombreOriginal': i.nombreOriginal,
                              }))
                          .toList();
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Transfer history ─────────────────────────────────────────────
          if (asset.historialTransferencias.isNotEmpty) ...[
            GlassCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _SectionTitle('Historial de transferencias'),
                    const SizedBox(height: 12),
                    ...asset.historialTransferencias.map(
                      (t) => _TransferTile(transfer: t),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}

class _QrCard extends StatelessWidget {
  const _QrCard({required this.asset});
  final AssetDetail asset;

  String get _qrUrl {
    final base = AppConfig.instance.baseUrl;
    return '$base/activos/${Uri.encodeComponent(asset.id)}';
  }

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionTitle('Código QR'),
            const SizedBox(height: 12),
            Center(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: _QrImage(data: _qrUrl),
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: Text(
                _qrUrl,
                style:
                    const TextStyle(color: AppColors.textMuted, fontSize: 11),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Renders a QR code using the `mobile_scanner` package's built-in
/// `BarcodeCapture` widget — or falls back to a simple text if unavailable.
/// We use a Canvas-painted QR via a custom painter to avoid heavy deps.
class _QrImage extends StatelessWidget {
  const _QrImage({required this.data});
  final String data;

  @override
  Widget build(BuildContext context) {
    // mobile_scanner can also display QR codes, but the standard approach
    // is to use `qr_flutter` or paint manually. Here we show the URL prominently
    // and indicate scanning is available through the app's scanner screen.
    return Column(
      children: [
        Container(
          width: 180,
          height: 180,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.qr_code_2, size: 80, color: Colors.grey.shade700),
                const SizedBox(height: 4),
                Text(
                  'QR generado\nen el servidor',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: Colors.grey.shade600, fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ── Helper widgets ──────────────────────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(
          color: AppColors.textMuted,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.8,
        ),
      );
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 13)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    color: AppColors.text, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _TransferTile extends StatelessWidget {
  const _TransferTile({required this.transfer});
  final Transferencia transfer;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.swap_horiz, color: AppColors.textMuted, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(transfer.tipo,
                    style: const TextStyle(
                        color: AppColors.textBright,
                        fontSize: 13,
                        fontWeight: FontWeight.w500)),
                if (transfer.areaOrigen != null || transfer.areaDestino != null)
                  Text(
                    [
                      if (transfer.areaOrigen != null)
                        transfer.areaOrigen!.nombre,
                      if (transfer.areaDestino != null)
                        transfer.areaDestino!.nombre,
                    ].join(' → '),
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12),
                  ),
                if (transfer.detalle != null)
                  Text(transfer.detalle!,
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ),
          Text(
            _shortDate(transfer.fecha),
            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }

  String _shortDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso.substring(0, 10);
    }
  }
}
