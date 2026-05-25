import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/glass_card.dart';
import '../models/inventory_models.dart';
import '../providers/inventory_provider.dart';

class InventoryListScreen extends ConsumerWidget {
  const InventoryListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(materialsListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventario'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.read(materialsListProvider.notifier).refresh(),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.go('/inventario/crear'),
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
                    ref.read(materialsListProvider.notifier).refresh(),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
        data: (materials) => _MaterialsList(materials: materials),
      ),
    );
  }
}

class _MaterialsList extends StatefulWidget {
  const _MaterialsList({required this.materials});
  final List<Material> materials;

  @override
  State<_MaterialsList> createState() => _MaterialsListState();
}

class _MaterialsListState extends State<_MaterialsList> {
  String _query = '';

  List<Material> get _filtered {
    if (_query.isEmpty) return widget.materials;
    final q = _query.toLowerCase();
    return widget.materials
        .where((m) =>
            m.nombre.toLowerCase().contains(q) ||
            m.codigo.toLowerCase().contains(q) ||
            (m.categoria?.nombre.toLowerCase().contains(q) ?? false))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final items = _filtered;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            decoration: const InputDecoration(
              hintText: 'Buscar materiales…',
              prefixIcon: Icon(Icons.search, size: 20),
              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        Expanded(
          child: items.isEmpty
              ? const Center(
                  child: Text(
                    'Sin resultados',
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (ctx, i) => _MaterialCard(material: items[i]),
                ),
        ),
      ],
    );
  }
}

class _MaterialCard extends StatelessWidget {
  const _MaterialCard({required this.material});
  final Material material;

  @override
  Widget build(BuildContext context) {
    final bajo = material.stockBajo;
    return GlassCard(
      onTap: () => context.go('/inventario/${material.id}'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            // Stock indicator circle
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: bajo ? AppColors.dangerLight : AppColors.successLight,
                shape: BoxShape.circle,
              ),
              child: Icon(
                bajo
                    ? Icons.warning_amber_rounded
                    : Icons.inventory_2_outlined,
                color: bajo ? AppColors.danger : AppColors.success,
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    material.nombre,
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
                    material.codigo,
                    style: const TextStyle(
                        color: AppColors.accent, fontSize: 12),
                  ),
                  if (material.categoria != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      material.categoria!.nombre,
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  material.stockActual.toStringAsFixed(2),
                  style: TextStyle(
                    color: bajo ? AppColors.danger : AppColors.success,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                Text(
                  material.unidad,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 11),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
