import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/inventory_repository.dart';
import '../models/inventory_models.dart';

// ── Materials list ──────────────────────────────────────────────────────────

final materialsListProvider =
    AsyncNotifierProvider<MaterialsListNotifier, List<Material>>(
  MaterialsListNotifier.new,
);

class MaterialsListNotifier extends AsyncNotifier<List<Material>> {
  @override
  Future<List<Material>> build() =>
      ref.read(inventoryRepositoryProvider).listAll();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
        () => ref.read(inventoryRepositoryProvider).listAll());
  }
}

// ── Single material ─────────────────────────────────────────────────────────

final materialDetailProvider = AsyncNotifierProviderFamily<
    MaterialDetailNotifier, Material, String>(
  MaterialDetailNotifier.new,
);

class MaterialDetailNotifier
    extends FamilyAsyncNotifier<Material, String> {
  @override
  Future<Material> build(String arg) =>
      ref.read(inventoryRepositoryProvider).getById(arg);

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
        () => ref.read(inventoryRepositoryProvider).getById(arg));
  }
}

// ── Categories ──────────────────────────────────────────────────────────────

final materialCategoriasProvider =
    FutureProvider<List<CategoriaMaterial>>((ref) {
  return ref.read(inventoryRepositoryProvider).listCategorias();
});
