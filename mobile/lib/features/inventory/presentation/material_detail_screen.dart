import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/glass_card.dart';
import '../../../shared/widgets/saved_images_gallery.dart';
import '../data/inventory_repository.dart';
import '../models/inventory_models.dart';
import '../providers/inventory_provider.dart';

class MaterialDetailScreen extends ConsumerWidget {
  const MaterialDetailScreen({super.key, required this.materialId});
  final String materialId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(materialDetailProvider(materialId));

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/inventario')),
        title: state.when(
          data: (m) => Text(m.codigo),
          loading: () => const Text('Cargando…'),
          error: (_, __) => const Text('Error'),
        ),
        actions: [
          state.when(
            data: (_) => IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () =>
                  ref.read(materialDetailProvider(materialId).notifier).refresh(),
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
              const Icon(Icons.error_outline,
                  color: AppColors.danger, size: 48),
              const SizedBox(height: 12),
              Text(e.toString(),
                  style:
                      const TextStyle(color: AppColors.textMuted)),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () =>
                    ref
                        .read(materialDetailProvider(materialId).notifier)
                        .refresh(),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
        data: (material) => _Body(material: material),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.material});
  final Material material;

  @override
  Widget build(BuildContext context) {
    final bajo = material.stockBajo;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Header ───────────────────────────────────────────────────────
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
                          material.nombre,
                          style: const TextStyle(
                            color: AppColors.textBright,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      _StockBadge(bajo: bajo),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(material.codigo,
                      style: const TextStyle(
                          color: AppColors.accent, fontSize: 13)),
                  if (material.categoria != null) ...[
                    const SizedBox(height: 4),
                    Text(material.categoria!.nombre,
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 12)),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Stock ─────────────────────────────────────────────────────────
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SectionTitle('Stock'),
                  const SizedBox(height: 12),
                  _DetailRow(
                    label: 'Stock actual',
                    value:
                        '${material.stockActual.toStringAsFixed(2)} ${material.unidad}',
                    valueColor: bajo ? AppColors.danger : AppColors.success,
                  ),
                  _DetailRow(
                    label: 'Stock mínimo',
                    value:
                        '${material.stockMinimo.toStringAsFixed(2)} ${material.unidad}',
                  ),
                  if (material.areaNombre != null)
                    _DetailRow(label: 'Área', value: material.areaNombre!),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Description ───────────────────────────────────────────────────
          if (material.descripcion != null) ...[
            GlassCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _SectionTitle('Descripción'),
                    const SizedBox(height: 8),
                    Text(material.descripcion!,
                        style: const TextStyle(
                            color: AppColors.text, fontSize: 14)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // ── Images ────────────────────────────────────────────────────────
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
                          ProviderScope.containerOf(context, listen: false)
                              .read(inventoryRepositoryProvider);
                      final imgs = await repo.listImages(material.id);
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
                              .read(inventoryRepositoryProvider);
                      await repo.deleteImage(material.id, imgId);
                    },
                    onUpload: (files) async {
                      final repo =
                          ProviderScope.containerOf(context, listen: false)
                              .read(inventoryRepositoryProvider);
                      final uploaded = await repo.uploadImages(
                          material.id,
                          files.map((x) => File(x.path)).toList());
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
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ── Helper widgets ──────────────────────────────────────────────────────────

class _StockBadge extends StatelessWidget {
  const _StockBadge({required this.bajo});
  final bool bajo;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bajo ? AppColors.dangerLight : AppColors.successLight,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        bajo ? 'Stock bajo' : 'Normal',
        style: TextStyle(
          color: bajo ? AppColors.danger : AppColors.success,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

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
  const _DetailRow({required this.label, required this.value, this.valueColor});
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 13)),
          ),
          Expanded(
            child: Text(value,
                style: TextStyle(
                  color: valueColor ?? AppColors.text,
                  fontSize: 13,
                  fontWeight: valueColor != null ? FontWeight.w600 : null,
                )),
          ),
        ],
      ),
    );
  }
}
