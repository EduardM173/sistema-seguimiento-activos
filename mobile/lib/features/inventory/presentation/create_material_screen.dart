import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/activos_text_field.dart';
import '../../../shared/widgets/glass_card.dart';
import '../../../shared/widgets/saved_images_gallery.dart';
import '../../vision/data/vision_repository.dart';
import '../data/inventory_repository.dart';
import '../models/inventory_models.dart';
import '../providers/inventory_provider.dart';

class CreateMaterialScreen extends ConsumerStatefulWidget {
  const CreateMaterialScreen({super.key});

  @override
  ConsumerState<CreateMaterialScreen> createState() =>
      _CreateMaterialScreenState();
}

class _CreateMaterialScreenState
    extends ConsumerState<CreateMaterialScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codigoCtrl = TextEditingController();
  final _nombreCtrl = TextEditingController();
  final _unidadCtrl = TextEditingController();
  final _descripcionCtrl = TextEditingController();
  final _stockActualCtrl =
      TextEditingController(text: '0');
  final _stockMinimoCtrl =
      TextEditingController(text: '0');

  String? _categoriaId;
  bool _loading = false;
  bool _aiLoading = false;

  // ── Selected photos ──────────────────────────────────────────────────────
  List<XFile> _photos = [];

  // ── AI banner ────────────────────────────────────────────────────────────
  String? _agentNote;
  bool _prefillApplied = false;

  @override
  void dispose() {
    for (final c in [
      _codigoCtrl, _nombreCtrl, _unidadCtrl, _descripcionCtrl,
      _stockActualCtrl, _stockMinimoCtrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _applyPrefill(Map<String, dynamic> data) {
    final partial = data['partial'] as Map<String, dynamic>? ?? data;

    void set(TextEditingController ctrl, String key) {
      final v = partial[key]?.toString();
      if (v != null && v.isNotEmpty) ctrl.text = v;
    }

    set(_nombreCtrl, 'nombre');
    set(_unidadCtrl, 'unidad');
    set(_descripcionCtrl, 'descripcion');

    final nota = data['notes']?.toString();
    if (nota != null && nota.isNotEmpty) _agentNote = nota;

    setState(() => _prefillApplied = true);
  }

  Future<void> _runAiAutofill() async {
    if (_photos.isEmpty) return;
    setState(() => _aiLoading = true);
    try {
      final result = await ref
          .read(visionRepositoryProvider)
          .analyzePhoto(File(_photos.first.path));
      _applyPrefill(result.toRouterExtra());
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error de análisis: $e')),
      );
    } finally {
      if (mounted) setState(() => _aiLoading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    try {
      final payload = CreateMaterialPayload(
        codigo: _codigoCtrl.text.trim(),
        nombre: _nombreCtrl.text.trim(),
        unidad: _unidadCtrl.text.trim(),
        stockActual: double.tryParse(_stockActualCtrl.text) ?? 0,
        stockMinimo: double.tryParse(_stockMinimoCtrl.text) ?? 0,
        descripcion: _descripcionCtrl.text.trim().isNotEmpty
            ? _descripcionCtrl.text.trim()
            : null,
        categoriaId: _categoriaId,
      );

      final repo = ref.read(inventoryRepositoryProvider);
      final created = await repo.create(payload);

      if (_photos.isNotEmpty) {
        try {
          await repo.uploadImages(
              created.id, _photos.map((x) => File(x.path)).toList());
        } catch (_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                  content: Text(
                      'Material creado. Error al subir algunas imágenes.')),
            );
          }
        }
      }

      if (!mounted) return;
      ref.invalidate(materialsListProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Material registrado correctamente')),
      );
      context.go('/inventario/${created.id}');
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categorias = ref.watch(materialCategoriasProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nuevo material'),
        leading: BackButton(onPressed: () => context.go('/inventario')),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── AI banner ────────────────────────────────────────────
              if (_prefillApplied) ...[
                _InfoBanner(
                  message: _agentNote ??
                      'Formulario prellenado por el agente de IA. '
                          'Revisa y ajusta los campos.',
                  icon: Icons.auto_awesome,
                  color: AppColors.accent,
                ),
                const SizedBox(height: 12),
              ],

              // ── Fotos + AI ───────────────────────────────────────────
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle('Fotos del material'),
                      const SizedBox(height: 12),
                      ImagePickerSection(
                        images: _photos,
                        onChanged: (imgs) =>
                            setState(() => _photos = imgs),
                        disabled: _loading || _aiLoading,
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 44,
                        child: ElevatedButton.icon(
                          onPressed:
                              (_photos.isEmpty || _aiLoading || _loading)
                                  ? null
                                  : _runAiAutofill,
                          icon: _aiLoading
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Color(0xFF060C18)),
                                )
                              : const Icon(Icons.auto_awesome, size: 18),
                          label: Text(
                              _aiLoading ? 'Analizando…' : 'Auto llenado IA'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.accent,
                            foregroundColor: const Color(0xFF060C18),
                            minimumSize: const Size(double.infinity, 44),
                            textStyle: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ── Identification ───────────────────────────────────────
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle('Identificación'),
                      const SizedBox(height: 12),
                      ActivosTextField(
                        controller: _codigoCtrl,
                        label: 'Código',
                        prefixIcon: Icons.tag,
                        validator: _required,
                      ),
                      const SizedBox(height: 12),
                      ActivosTextField(
                        controller: _nombreCtrl,
                        label: 'Nombre',
                        prefixIcon: Icons.label_outline,
                        validator: _required,
                      ),
                      const SizedBox(height: 12),
                      ActivosTextField(
                        controller: _unidadCtrl,
                        label: 'Unidad de medida',
                        prefixIcon: Icons.straighten,
                        validator: _required,
                      ),
                      const SizedBox(height: 12),
                      ActivosTextField(
                        controller: _descripcionCtrl,
                        label: 'Descripción',
                        prefixIcon: Icons.notes_outlined,
                        maxLines: 3,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ── Stock ────────────────────────────────────────────────
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle('Stock'),
                      const SizedBox(height: 12),
                      ActivosTextField(
                        controller: _stockActualCtrl,
                        label: 'Stock actual',
                        prefixIcon: Icons.inventory_outlined,
                        keyboardType: TextInputType.number,
                        validator: (v) =>
                            (double.tryParse(v ?? '') == null)
                                ? 'Valor numérico requerido'
                                : null,
                      ),
                      const SizedBox(height: 12),
                      ActivosTextField(
                        controller: _stockMinimoCtrl,
                        label: 'Stock mínimo',
                        prefixIcon: Icons.warning_amber_outlined,
                        keyboardType: TextInputType.number,
                        validator: (v) =>
                            (double.tryParse(v ?? '') == null)
                                ? 'Valor numérico requerido'
                                : null,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ── Category ─────────────────────────────────────────────
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle('Categoría'),
                      const SizedBox(height: 12),
                      categorias.when(
                        data: (cats) => _DropdownField<String?>(
                          label: 'Categoría',
                          value: _categoriaId,
                          items: [null, ...cats.map((c) => c.id)],
                          labelOf: (id) => id == null
                              ? 'Sin categoría'
                              : cats.firstWhere((c) => c.id == id).nombre,
                          onChanged: (v) =>
                              setState(() => _categoriaId = v),
                        ),
                        loading: () => const LinearProgressIndicator(),
                        error: (_, __) => const Text(
                            'Error cargando categorías',
                            style:
                                TextStyle(color: AppColors.textMuted)),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Registrar material'),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  String? _required(String? v) =>
      (v == null || v.trim().isEmpty) ? 'Campo requerido' : null;

  Widget _sectionTitle(String text) => Text(
        text.toUpperCase(),
        style: const TextStyle(
          color: AppColors.textMuted,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1,
        ),
      );
}

// ── Reusable form widgets ───────────────────────────────────────────────────

class _DropdownField<T> extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.labelOf,
    required this.onChanged,
  });
  final String label;
  final T value;
  final List<T> items;
  final String Function(T) labelOf;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      value: value,
      items: items
          .map((item) => DropdownMenuItem<T>(
                value: item,
                child: Text(labelOf(item),
                    style: const TextStyle(
                        color: AppColors.text, fontSize: 14)),
              ))
          .toList(),
      onChanged: onChanged,
      decoration: InputDecoration(labelText: label),
      dropdownColor: AppColors.surface,
      style: const TextStyle(color: AppColors.text),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({
    required this.message,
    required this.icon,
    required this.color,
  });
  final String message;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message,
                style: TextStyle(color: color, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
