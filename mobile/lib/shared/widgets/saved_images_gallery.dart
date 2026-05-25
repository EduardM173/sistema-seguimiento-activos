import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/config/app_config.dart';
import '../../core/network/service_registry.dart';
import '../../core/theme/app_theme.dart';

/// A serialised image coming from the backend.
class SavedImage {
  const SavedImage({
    required this.id,
    required this.url,
    required this.nombreOriginal,
  });

  final String id;

  /// Relative URL returned by the backend, e.g. `/uploads/activos/{id}/{file}`.
  final String url;
  final String nombreOriginal;

  factory SavedImage.fromJson(Map<String, dynamic> j) => SavedImage(
        id: j['id'] as String,
        url: j['url'] as String,
        nombreOriginal: j['nombreOriginal'] as String? ?? '',
      );

  /// Returns the full absolute URL for display.
  String get absoluteUrl {
    if (url.startsWith('http')) return url;
    final base = AppConfig.instance.baseUrl;
    final service = ActivosService.backend.consulName;
    return '$base/$service$url';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SavedImagesGallery
// ─────────────────────────────────────────────────────────────────────────────

/// Displays images already stored on the backend with optional delete / upload.
///
/// Usage:
/// ```dart
/// SavedImagesGallery(
///   loadImages: () => repo.listImages(id),
///   onDelete: (imgId) => repo.deleteImage(entityId, imgId),
///   onUpload: (files) => repo.uploadImages(entityId, files),
/// )
/// ```
class SavedImagesGallery extends StatefulWidget {
  const SavedImagesGallery({
    super.key,
    required this.loadImages,
    this.onDelete,
    this.onUpload,
  });

  final Future<List<SavedImage>> Function() loadImages;
  final Future<void> Function(String imageId)? onDelete;

  /// When provided, an "add more" tile appears in the grid.
  final Future<List<SavedImage>> Function(List<XFile> files)? onUpload;

  @override
  State<SavedImagesGallery> createState() => _SavedImagesGalleryState();
}

class _SavedImagesGalleryState extends State<SavedImagesGallery> {
  List<SavedImage> _images = [];
  bool _loading = true;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final imgs = await widget.loadImages();
      if (mounted) setState(() => _images = imgs);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(String imageId) async {
    if (widget.onDelete == null) return;
    final confirmed = await _confirmDelete(context);
    if (!confirmed || !mounted) return;

    await widget.onDelete!(imageId);
    setState(() => _images.removeWhere((i) => i.id == imageId));
  }

  Future<void> _addMore() async {
    if (widget.onUpload == null) return;
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage(imageQuality: 85);
    if (picked.isEmpty || !mounted) return;

    setState(() => _uploading = true);
    try {
      final newImgs = await widget.onUpload!(picked);
      if (mounted) setState(() => _images = [..._images, ...newImgs]);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al subir: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(
        height: 80,
        child: Center(
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }

    final hasAdd = widget.onUpload != null;
    final itemCount = _images.length + (hasAdd ? 1 : 0);

    if (itemCount == 0) {
      return Container(
        height: 80,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Center(
          child: Text(
            'Sin imágenes',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
        ),
      );
    }

    return SizedBox(
      height: 100,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (ctx, i) {
          if (hasAdd && i == itemCount - 1) {
            return _AddTile(onTap: _addMore, loading: _uploading);
          }
          return _ImageTile(
            image: _images[i],
            allImages: _images,
            index: i,
            onDelete: widget.onDelete != null ? _delete : null,
          );
        },
      ),
    );
  }
}

// ── Tile: single saved image ──────────────────────────────────────────────

class _ImageTile extends StatelessWidget {
  const _ImageTile({
    required this.image,
    required this.allImages,
    required this.index,
    this.onDelete,
  });

  final SavedImage image;
  final List<SavedImage> allImages;
  final int index;
  final void Function(String)? onDelete;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _openLightbox(context),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Image.network(
              image.absoluteUrl,
              width: 90,
              height: 100,
              fit: BoxFit.cover,
              loadingBuilder: (_, child, progress) => progress == null
                  ? child
                  : Container(
                      width: 90,
                      height: 100,
                      color: AppColors.surfaceHigh,
                      child: const Center(
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
              errorBuilder: (_, __, ___) => Container(
                width: 90,
                height: 100,
                color: AppColors.surfaceHigh,
                child: const Icon(Icons.broken_image_outlined,
                    color: AppColors.textMuted),
              ),
            ),
          ),
          if (onDelete != null)
            Positioned(
              top: -4,
              right: -4,
              child: GestureDetector(
                onTap: () => onDelete!(image.id),
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: const BoxDecoration(
                    color: AppColors.danger,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close, size: 13, color: Colors.white),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _openLightbox(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => _LightboxScreen(images: allImages, initialIndex: index),
      ),
    );
  }
}

// ── Tile: add more ────────────────────────────────────────────────────────

class _AddTile extends StatelessWidget {
  const _AddTile({required this.onTap, required this.loading});
  final VoidCallback onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Container(
        width: 90,
        height: 100,
        decoration: BoxDecoration(
          color: AppColors.surfaceHigh,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: AppColors.primary.withOpacity(0.4),
            style: BorderStyle.solid,
          ),
        ),
        child: loading
            ? const Center(
                child:
                    CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
              )
            : const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_photo_alternate_outlined,
                      color: AppColors.primary, size: 28),
                  SizedBox(height: 4),
                  Text(
                    'Añadir',
                    style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 11,
                        fontWeight: FontWeight.w500),
                  ),
                ],
              ),
      ),
    );
  }
}

// ── Lightbox screen ───────────────────────────────────────────────────────

class _LightboxScreen extends StatefulWidget {
  const _LightboxScreen({
    required this.images,
    required this.initialIndex,
  });
  final List<SavedImage> images;
  final int initialIndex;

  @override
  State<_LightboxScreen> createState() => _LightboxScreenState();
}

class _LightboxScreenState extends State<_LightboxScreen> {
  late final PageController _pageCtrl;
  late int _current;

  @override
  void initState() {
    super.initState();
    _current = widget.initialIndex;
    _pageCtrl = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        leading: const CloseButton(color: Colors.white),
        title: Text(
          '${_current + 1} / ${widget.images.length}',
          style: const TextStyle(color: Colors.white, fontSize: 14),
        ),
      ),
      body: PageView.builder(
        controller: _pageCtrl,
        itemCount: widget.images.length,
        onPageChanged: (i) => setState(() => _current = i),
        itemBuilder: (ctx, i) {
          final img = widget.images[i];
          return InteractiveViewer(
            child: Center(
              child: Image.network(
                img.absoluteUrl,
                fit: BoxFit.contain,
                loadingBuilder: (_, child, progress) => progress == null
                    ? child
                    : const Center(child: CircularProgressIndicator()),
                errorBuilder: (_, __, ___) => const Icon(
                    Icons.broken_image_outlined,
                    color: Colors.white54,
                    size: 60),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

Future<bool> _confirmDelete(BuildContext context) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AppColors.surface,
      title: const Text('Eliminar imagen',
          style: TextStyle(color: AppColors.textBright)),
      content: const Text(
        '¿Eliminar esta imagen? Esta acción no se puede deshacer.',
        style: TextStyle(color: AppColors.text),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
          onPressed: () => Navigator.of(ctx).pop(true),
          child: const Text('Eliminar'),
        ),
      ],
    ),
  );
  return result == true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ImagePickerSection — for CREATE forms
// ─────────────────────────────────────────────────────────────────────────────

/// Lets the user pick or take photos before saving a new entity.
/// Displays thumbnails and allows individual removal.
class ImagePickerSection extends StatelessWidget {
  const ImagePickerSection({
    super.key,
    required this.images,
    required this.onChanged,
    this.disabled = false,
  });

  final List<XFile> images;
  final ValueChanged<List<XFile>> onChanged;
  final bool disabled;

  Future<void> _pickFromGallery() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage(imageQuality: 85);
    if (picked.isNotEmpty) {
      onChanged([...images, ...picked]);
    }
  }

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final taken =
        await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (taken != null) {
      onChanged([...images, taken]);
    }
  }

  void _remove(int index) {
    final updated = List<XFile>.from(images)..removeAt(index);
    onChanged(updated);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Action buttons ──────────────────────────────────────────────
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: disabled ? null : _pickFromGallery,
                icon: const Icon(Icons.photo_library_outlined, size: 18),
                label: const Text('Galería'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 44),
                  side:
                      const BorderSide(color: AppColors.borderStrong),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: disabled ? null : _takePhoto,
                icon: const Icon(Icons.camera_alt_outlined, size: 18),
                label: const Text('Cámara'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 44),
                  side:
                      const BorderSide(color: AppColors.borderStrong),
                ),
              ),
            ),
          ],
        ),

        // ── Selected thumbnails ─────────────────────────────────────────
        if (images.isNotEmpty) ...[
          const SizedBox(height: 12),
          SizedBox(
            height: 90,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: images.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Image.file(
                        File(images[i].path),
                        width: 80,
                        height: 90,
                        fit: BoxFit.cover,
                      ),
                    ),
                    Positioned(
                      top: -4,
                      right: -4,
                      child: GestureDetector(
                        onTap: disabled ? null : () => _remove(i),
                        child: Container(
                          width: 20,
                          height: 20,
                          decoration: const BoxDecoration(
                            color: AppColors.danger,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.close,
                              size: 13, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}
