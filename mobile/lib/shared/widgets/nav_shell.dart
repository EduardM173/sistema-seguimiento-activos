import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';

/// Bottom navigation shell with 4 tabs: Dashboard, Assets, Scanner, Capture.
class NavShell extends StatelessWidget {
  const NavShell({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    _TabDef('/dashboard', Icons.dashboard_outlined, Icons.dashboard, 'Panel'),
    _TabDef('/activos', Icons.inventory_2_outlined, Icons.inventory_2, 'Activos'),
    _TabDef('/scanner', Icons.qr_code_scanner, Icons.qr_code_scanner, 'Escanear'),
    _TabDef('/inventario', Icons.warehouse_outlined, Icons.warehouse, 'Inventario'),
  ];

  int _selectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    for (var i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selectedIndex(context);
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: _tabs.asMap().entries.map((entry) {
          final i = entry.key;
          final tab = entry.value;
          return NavigationDestination(
            icon: Icon(tab.icon),
            selectedIcon: tab.path == '/scanner'
                ? Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppColors.accent,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(tab.selectedIcon,
                        color: const Color(0xFF060C18), size: 20),
                  )
                : Icon(tab.selectedIcon),
            label: tab.label,
          );
        }).toList(),
      ),
    );
  }
}

class _TabDef {
  const _TabDef(this.path, this.icon, this.selectedIcon, this.label);
  final String path;
  final IconData icon;
  final IconData selectedIcon;
  final String label;
}
