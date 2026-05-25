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
import '../data/assets_repository.dart';
import '../data/catalogs_repository.dart';
import '../models/asset_models.dart';
import '../providers/assets_provider.dart';

class CreateAssetScreen extends ConsumerStatefulWidget {
  /// Optional prefill data from an external source (e.g. QR deep-link).
  final Map<String, dynamic>? prefill;

  const CreateAssetScreen({super.key, this.prefill});

  @override
  ConsumerState<CreateAssetScreen> createState() => _CreateAssetScreenState();
}

class _CreateAssetScreenState extends ConsumerState<CreateAssetScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codigoCtrl = TextEditingController();
  final _nombreCtrl = TextEditingController();
  final _marcaCtrl = TextEditingController();
  final _modeloCtrl = TextEditingController();
  final _serieCtrl = TextEditingController();
  final _descripcionCtrl = TextEditingController();
  final _costoCtrl = TextEditingController();

  EstadoActivo _estado = EstadoActivo.operativo;
  String? _categoriaId;
  String? _ubicacionId;
  String? _areaId;
  String? _responsableId;
  bool _loading = false;
  bool _aiLoading = false;

  List<XFile> _photos = [];
  String? _agentNote;
  bool _prefillApplied = false;

  @override
  void initState() {
    super.initState();
    _loadGeneratedCode();
    if (widget.prefill != null) {
      _applyPrefill(widget.prefill!);
    }
  }

  @override
  void dispose() {
    for (final c in [
      _codigoCtrl, _nombreCtrl, _marcaCtrl, _modeloCtrl,
      _serieCtrl, _descripcionCtrl, _costoCtrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadGeneratedCode() async {
    try {
      final code = await ref.read(assetsRepositoryProvider).generateCode();
      if (mounted && _codigoCtrl.text.isEmpty) _codigoCtrl.text = code;
    } catch (_) {}
  }

  void _applyPrefill(Map<String, dynamic> data) {
    final partial = data['partial'] as Map<String, dynamic>? ?? data;

    void set(TextEditingController ctrl, String key) {
      final v = partial[key]?.toString();
      if (v != null && v.isNotEmpty) ctrl.text = v;
    }

    set(_nombreCtrl, 'nombre');
    set(_marcaCtrl, 'marca');
    set(_modeloCtrl, 'modelo');
    set(_serieCtrl, 'numeroSerie');
    set(_descripcionCtrl, 'descripcion');

    final nota = data['notes']?.toString();
    if (nota != null && nota.isNotEmpty) _agentNote = nota;

    final existingId = data['existingAssetId']?.toString();
    if (existingId != null && existingId.isNotEmpty && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showExistingAssetDialog(
            existingId, data['existingAssetCode']?.toString());
      });
    }

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

  Future<void> _showExistingAssetDialog(String id, String? code) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Posible duplicado',
            style: TextStyle(color: AppColors.textBright)),
        content: Text(
          'El agente encontró un activo similar en el sistema'
          '${code != null ? ': $code' : ''}. '
          '¿Deseas verlo en lugar de crear uno nuevo?',
          style: const TextStyle(color: AppColors.text),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Continuar creando'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Ver activo'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) context.go('/activos/$id');
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    try {
      final payload = CreateAssetPayload(
        codigo: _codigoCtrl.text.trim(),
        nombre: _nombreCtrl.text.trim(),
        marca: _marcaCtrl.text.trim().isNotEmpty ? _marcaCtrl.text.trim() : null,
        modelo: _modeloCtrl.text.trim().isNotEmpty ? _modeloCtrl.text.trim() : null,
        numeroSerie:
            _serieCtrl.text.trim().isNotEmpty ? _serieCtrl.text.trim() : null,
        descripcion: _descripcionCtrl.text.trim().isNotEmpty
            ? _descripcionCtrl.text.trim()
            : null,
        costoAdquisicion: double.tryParse(_costoCtrl.text),
        categoriaId: _categoriaId,
        ubicacionId: _ubicacionId,
        estado: _estado,
        areaActualId: _areaId,
        responsableActualId: _responsableId,
      );

      final repo = ref.read(assetsRepositoryProvider);
      final created = await repo.create(payload);

      if (_photos.isNotEmpty) {
        try {
          await repo.uploadImages(
              created.id, _photos.map((x) => File(x.path)).toList());
        } catch (_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                  content:
                      Text('Activo creado. Error al subir algunas imágenes.')),
            );
          }
        }
      }

      if (!mounted) return;
      ref.invalidate(assetsListProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Activo creado correctamente')),
      );
      context.go('/activos/${created.id}');
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categorias = ref.watch(categoriasProvider);
    final ubicaciones = ref.watch(ubicacionesProvider);
    final areas = ref.watch(areasProvider);
    final usuarios = ref.watch(usuariosProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nuevo activo'),
        leading: BackButton(onPressed: () => context.go('/activos')),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
                      _sectionTitle('Fotos del activo'),
                      const SizedBox(height: 12),
                      ImagePickerSection(
                        images: _photos,
                        onChanged: (imgs) => setState(() => _photos = imgs),
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
                          label: Text(_aiLoading
                              ? 'Analizando…'
                              : 'Auto llenado IA'),
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
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ── Details ──────────────────────────────────────────────
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle('Características'),
                      const SizedBox(height: 12),
                      ActivosTextField(
                          controller: _marcaCtrl,
                          label: 'Marca',
                          prefixIcon: Icons.business_outlined),
                      const SizedBox(height: 12),
                      ActivosTextField(
                          controller: _modeloCtrl,
                          label: 'Modelo',
                          prefixIcon: Icons.devices_outlined),
                      const SizedBox(height: 12),
                      ActivosTextField(
                          controller: _serieCtrl,
                          label: 'Número de serie',
                          prefixIcon: Icons.numbers),
                      const SizedBox(height: 12),
                      ActivosTextField(
                          controller: _descripcionCtrl,
                          label: 'Descripción',
                          prefixIcon: Icons.notes_outlined,
                          maxLines: 3),
                      const SizedBox(height: 12),
                      ActivosTextField(
                          controller: _costoCtrl,
                          label: 'Costo de adquisición',
                          prefixIcon: Icons.attach_money,
                          keyboardType: TextInputType.number),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ── Classification ───────────────────────────────────────
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle('Clasificación'),
                      const SizedBox(height: 12),
                      _DropdownField<EstadoActivo>(
                        label: 'Estado',
                        value: _estado,
                        items: EstadoActivo.values,
                        labelOf: (e) => e.label,
                        onChanged: (v) => setState(() => _estado = v!),
                      ),
                      const SizedBox(height: 12),
                      categorias.when(
                        data: (cats) => _DropdownField<String?>(
                          label: 'Categoría',
                          value: _categoriaId,
                          items: [null, ...cats.map((c) => c.id)],
                          labelOf: (id) => id == null
                              ? 'Sin categoría'
                              : cats.firstWhere((c) => c.id == id).nombre,
                          onChanged: (v) => setState(() => _categoriaId = v),
                        ),
                        loading: () => const LinearProgressIndicator(),
                        error: (_, __) =>
                            const Text('Error cargando categorías'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ── Location ─────────────────────────────────────────────
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle('Ubicación y responsable'),
                      const SizedBox(height: 12),
                      ubicaciones.when(
                        data: (locs) => _DropdownField<String?>(
                          label: 'Ubicación',
                          value: _ubicacionId,
                          items: [null, ...locs.map((l) => l.id)],
                          labelOf: (id) => id == null
                              ? 'Sin ubicación'
                              : locs.firstWhere((l) => l.id == id).nombre,
                          onChanged: (v) => setState(() => _ubicacionId = v),
                        ),
                        loading: () => const LinearProgressIndicator(),
                        error: (_, __) => const SizedBox.shrink(),
                      ),
                      const SizedBox(height: 12),
                      areas.when(
                        data: (ars) => _DropdownField<String?>(
                          label: 'Área',
                          value: _areaId,
                          items: [null, ...ars.map((a) => a.id)],
                          labelOf: (id) => id == null
                              ? 'Sin área'
                              : ars.firstWhere((a) => a.id == id).nombre,
                          onChanged: (v) => setState(() => _areaId = v),
                        ),
                        loading: () => const LinearProgressIndicator(),
                        error: (_, __) => const SizedBox.shrink(),
                      ),
                      const SizedBox(height: 12),
                      usuarios.when(
                        data: (usrs) => _DropdownField<String?>(
                          label: 'Responsable',
                          value: _responsableId,
                          items: [null, ...usrs.map((u) => u.id)],
                          labelOf: (id) => id == null
                              ? 'Sin responsable'
                              : usrs.firstWhere((u) => u.id == id).nombreCompleto,
                          onChanged: (v) => setState(() => _responsableId = v),
                        ),
                        loading: () => const LinearProgressIndicator(),
                        error: (_, __) => const SizedBox.shrink(),
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
                    : const Text('Crear activo'),
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

// ── Shared form widgets ─────────────────────────────────────────────────────

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
                    style:
                        const TextStyle(color: AppColors.text, fontSize: 14)),
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
            child:
                Text(message, style: TextStyle(color: color, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
