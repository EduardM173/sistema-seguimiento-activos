import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/assets_repository.dart';
import '../models/asset_models.dart';

// ── Assets list state ──────────────────────────────────────────────────────

class AssetsListState {
  const AssetsListState({
    this.items = const [],
    this.meta,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.params,
  });

  final List<AssetListItem> items;
  final PaginationMeta? meta;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final SearchAssetsParams? params;

  bool get hasMore =>
      meta != null && meta!.page < meta!.totalPages;

  AssetsListState copyWith({
    List<AssetListItem>? items,
    PaginationMeta? meta,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    SearchAssetsParams? params,
  }) =>
      AssetsListState(
        items: items ?? this.items,
        meta: meta ?? this.meta,
        isLoading: isLoading ?? this.isLoading,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        error: error,
        params: params ?? this.params,
      );
}

final assetsListProvider =
    AsyncNotifierProvider<AssetsListNotifier, AssetsListState>(
        AssetsListNotifier.new);

class AssetsListNotifier extends AsyncNotifier<AssetsListState> {
  AssetsRepository get _repo => ref.read(assetsRepositoryProvider);

  @override
  Future<AssetsListState> build() async {
    await _load(SearchAssetsParams());
    return state.valueOrNull ?? const AssetsListState();
  }

  Future<void> search(SearchAssetsParams params) => _load(params);

  Future<void> refresh() async {
    final current = state.valueOrNull?.params ?? SearchAssetsParams();
    await _load(current..page = 1);
  }

  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    final nextParams = current.params!..page = current.meta!.page + 1;
    state = AsyncValue.data(current.copyWith(isLoadingMore: true));

    try {
      final result = await _repo.search(nextParams);
      state = AsyncValue.data(current.copyWith(
        items: [...current.items, ...result.data],
        meta: result.meta,
        isLoadingMore: false,
        params: nextParams,
      ));
    } catch (e) {
      state = AsyncValue.data(current.copyWith(isLoadingMore: false));
    }
  }

  Future<void> _load(SearchAssetsParams params) async {
    state = AsyncValue.data(AssetsListState(isLoading: true, params: params));
    state = await AsyncValue.guard(() async {
      final result = await _repo.search(params);
      return AssetsListState(items: result.data, meta: result.meta, params: params);
    });
  }
}

// ── Asset detail provider ──────────────────────────────────────────────────

final assetDetailProvider =
    AsyncNotifierProviderFamily<AssetDetailNotifier, AssetDetail, String>(
        AssetDetailNotifier.new);

class AssetDetailNotifier
    extends FamilyAsyncNotifier<AssetDetail, String> {
  @override
  Future<AssetDetail> build(String assetId) async {
    return ref.read(assetsRepositoryProvider).getById(assetId);
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(
        () => ref.read(assetsRepositoryProvider).getById(arg));
  }
}
