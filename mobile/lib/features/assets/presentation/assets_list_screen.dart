import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/glass_card.dart';
import '../../../shared/widgets/status_badge.dart';
import '../models/asset_models.dart';
import '../providers/assets_provider.dart';
import '../data/catalogs_repository.dart';

class AssetsListScreen extends ConsumerStatefulWidget {
  const AssetsListScreen({super.key});

  @override
  ConsumerState<AssetsListScreen> createState() => _AssetsListScreenState();
}

class _AssetsListScreenState extends ConsumerState<AssetsListScreen> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  EstadoActivo? _filterEstado;
  String? _filterCategoriaId;

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
      ref.read(assetsListProvider.notifier).loadMore();
    }
  }

  void _applyFilters() {
    ref.read(assetsListProvider.notifier).search(
          SearchAssetsParams(
            q: _searchCtrl.text.trim().isEmpty ? null : _searchCtrl.text.trim(),
            estado: _filterEstado,
            categoriaId: _filterCategoriaId,
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(assetsListProvider);
    final categorias = ref.watch(categoriasProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Activos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.go('/activos/crear'),
            tooltip: 'Nuevo activo',
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Search & Filters ─────────────────────────────────────────────
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Column(
              children: [
                TextField(
                  controller: _searchCtrl,
                  onSubmitted: (_) => _applyFilters(),
                  decoration: InputDecoration(
                    hintText: 'Buscar activo…',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              _applyFilters();
                            },
                          )
                        : null,
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _FilterChip(
                        label: _filterEstado?.label ?? 'Estado',
                        selected: _filterEstado != null,
                        onTap: () => _showEstadoPicker(context),
                      ),
                      const SizedBox(width: 8),
                      _FilterChip(
                        label: categorias.when(
                          data: (cats) => cats
                              .where((c) => c.id == _filterCategoriaId)
                              .map((c) => c.nombre)
                              .firstOrNull ??
                              'Categoría',
                          loading: () => 'Categoría',
                          error: (_, __) => 'Categoría',
                        ),
                        selected: _filterCategoriaId != null,
                        onTap: () => _showCategoriaPicker(context),
                      ),
                      if (_filterEstado != null || _filterCategoriaId != null) ...[
                        const SizedBox(width: 8),
                        ActionChip(
                          label: const Text('Limpiar'),
                          avatar: const Icon(Icons.close, size: 14),
                          onPressed: () {
                            setState(() {
                              _filterEstado = null;
                              _filterCategoriaId = null;
                            });
                            _applyFilters();
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // ── List ─────────────────────────────────────────────────────────
          Expanded(
            child: state.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        color: AppColors.danger, size: 40),
                    const SizedBox(height: 12),
                    Text(e.toString(),
                        style: const TextStyle(color: AppColors.textMuted)),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () =>
                          ref.read(assetsListProvider.notifier).refresh(),
                      child: const Text('Reintentar'),
                    ),
                  ],
                ),
              ),
              data: (s) {
                if (s.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (s.items.isEmpty) {
                  return const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.inventory_2_outlined,
                            size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text('Sin resultados',
                            style: TextStyle(color: AppColors.textMuted)),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () =>
                      ref.read(assetsListProvider.notifier).refresh(),
                  child: ListView.separated(
                    controller: _scrollCtrl,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    itemCount: s.items.length + (s.isLoadingMore ? 1 : 0),
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (context, i) {
                      if (i >= s.items.length) {
                        return const Center(
                          child: Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        );
                      }
                      return _AssetListTile(
                        asset: s.items[i],
                        onTap: () => context.go('/activos/${s.items[i].id}'),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showEstadoPicker(BuildContext context) async {
    final selected = await showModalBottomSheet<EstadoActivo>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => _PickerSheet<EstadoActivo>(
        title: 'Filtrar por estado',
        items: EstadoActivo.values,
        labelOf: (e) => e.label,
        selected: _filterEstado,
      ),
    );
    if (!mounted) return;
    setState(() => _filterEstado = selected);
    _applyFilters();
  }

  Future<void> _showCategoriaPicker(BuildContext context) async {
    final cats = ref.read(categoriasProvider).valueOrNull ?? [];
    final selected = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => _PickerSheet<String>(
        title: 'Filtrar por categoría',
        items: cats.map((c) => c.id).toList(),
        labelOf: (id) => cats.firstWhere((c) => c.id == id).nombre,
        selected: _filterCategoriaId,
      ),
    );
    if (!mounted) return;
    setState(() => _filterCategoriaId = selected);
    _applyFilters();
  }
}

// ── Sub-widgets ─────────────────────────────────────────────────────────────

class _AssetListTile extends StatelessWidget {
  const _AssetListTile({required this.asset, required this.onTap});
  final AssetListItem asset;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primaryMuted,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.inventory_2_outlined,
                  color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    asset.nombre,
                    style: const TextStyle(
                      color: AppColors.textBright,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    asset.codigo,
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12),
                  ),
                  if (asset.categoria != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      asset.categoria!.nombre,
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            StatusBadge(estado: asset.estado),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: AppColors.primaryMuted,
      checkmarkColor: AppColors.primary,
    );
  }
}

class _PickerSheet<T> extends StatelessWidget {
  const _PickerSheet({
    required this.title,
    required this.items,
    required this.labelOf,
    required this.selected,
  });
  final String title;
  final List<T> items;
  final String Function(T) labelOf;
  final T? selected;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 8),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(title,
                style: const TextStyle(
                    color: AppColors.textBright,
                    fontWeight: FontWeight.w600,
                    fontSize: 16)),
          ),
          ...items.map(
            (item) => ListTile(
              title: Text(labelOf(item),
                  style: const TextStyle(color: AppColors.text)),
              trailing: item == selected
                  ? const Icon(Icons.check, color: AppColors.primary)
                  : null,
              onTap: () => Navigator.of(context).pop(item),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
