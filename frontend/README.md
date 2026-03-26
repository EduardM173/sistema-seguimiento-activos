# Frontend - ActivoGestión | Sistema de Gestión de Activos Universitarios

Frontend completo del Sistema de Gestión de Activos Universitarios desarrollado con **React 18**, **TypeScript** y **Vite**.

## 🎯 Características Principales Implementadas

### ✅ Módulos Completamente Funcionales
- **Dashboard**: Panel de control con widgets, estadísticas y acciones rápidas
- **Gestión de Activos**: CRUD, búsqueda, filtros, historial de movimientos
- **Inventario**: Gestión de materiales y consumibles
- **Transferencias**: Asignaciones y transferencias entre áreas
- **Usuarios**: Administración de usuarios y roles
- **Auditoría**: Registro de cambios del sistema
- **Reportes**: Generador multi-formato

### ✅ Características Técnicas
- 8 Componentes reutilizables completamente tipados
- 7 Servicios API con manejo robusto de errores
- Sistema de autenticación basado en JWT tokens
- Enrutamiento protegido (públicas/privadas)
- 6+ Tipos TypeScript exhaustivos
- Estilos CSS responsivos (mobile-first)
- Hooks personalizados (useAuth, useApi)

## 📁 Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/                    # Componentes reutilizables
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── Alert.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── index.ts
│   │   ├── layout/                    # Dashboard components
│   │   │   ├── StatWidget.tsx
│   │   │   ├── RecentActivity.tsx
│   │   │   ├── QuickAction.tsx
│   │   │   ├── DashboardContent.tsx
│   │   │   └── index.ts
│   │   ├── activos/                   # Activos module
│   │   │   ├── ActivosList.tsx
│   │   │   ├── ActivoForm.tsx
│   │   │   └── ActivoDetail.tsx
│   │   ├── login/
│   │   ├── navbar/
│   │   ├── inventario/
│   │   ├── transferencias/
│   │   ├── usuarios/
│   │   ├── modals/
│   │   └── ...
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── activos/ActivosPage.tsx
│   │   ├── inventario/InventarioPage.tsx
│   │   ├── transferencias/TransferenciasPage.tsx
│   │   ├── usuarios/UsuariosPage.tsx
│   │   ├── auditoria/AuditoriaPage.tsx
│   │   └── reportes/ReportesPage.tsx
│   ├── services/
│   │   ├── api.config.ts              # Configuración HTTP centralizada
│   │   ├── auth.service.ts
│   │   ├── activos.service.ts
│   │   ├── inventario.service.ts
│   │   ├── transferencias.service.ts
│   │   ├── usuarios.service.ts
│   │   ├── auditoria.service.ts
│   │   └── reportes.service.ts
│   ├── types/                         # Tipos TypeScript
│   │   ├── auth.types.ts
│   │   ├── activos.types.ts
│   │   ├── inventario.types.ts
│   │   ├── transferencias.types.ts
│   │   ├── usuarios.types.ts
│   │   ├── auditoria.types.ts
│   │   ├── reportes.types.ts
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   └── index.ts
│   ├── styles/
│   │   ├── navbar.css
│   │   ├── login.css
│   │   ├── dashboard.css
│   │   ├── components.css
│   │   ├── modules.css
│   │   └── index.css
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   └── index.css
├── .env.example
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## 🚀 Instalación Rápida

### Requisitos
- Node.js 16+
- npm/yarn
- Backend en `http://localhost:3000`

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env si es necesario

# 3. Ejecutar servidor de desarrollo
npm run dev

# 4. Abre en navegador
# http://localhost:5173
```

## 📦 Dependencias Principales

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.x",
  "axios": "^1.6.0",
  "typescript": "^5.x",
  "vite": "^4.x"
}
```

## 🛠️ Scripts Disponibles

```bash
npm run dev         # Servidor de desarrollo
npm run build       # Build para producción
npm run preview     # Vista previa de producción
npm run lint        # Análisis de código
```

## 🔐 Autenticación

- **Almacenamiento**: localStorage (preferido) o sessionStorage
- **Header**: `Authorization: Bearer {token}`
- **Token**: Se obtiene en login y se envía en cada petición
- **Expiración**: Manejo automático de tokens expirados

### Login
```
URL: http://localhost:5173/
Credenciales: Usa credenciales institucionales
```

## 📱 Módulos por Sección

### Dashboard (`/dashboard`)
- **Widgets**: Total de activos, stock bajo, transferencias, alertas
- **Acciones Rápidas**: Acceso directo a funcionalidades principales
- **Actividad Reciente**: Últimas acciones del sistema
- **Info de Usuario**: Datos del usuario autenticado

### Activos (`/activos`)
- Listar con paginación y búsqueda
- Crear/Editar con validación
- Ver detalles completos
- Historial de movimientos
- Exportar datos
- Filtrar por estado, categoría, ubicación

### Inventario (`/inventario`)
- Gestión de materiales
- Stock disponible y mínimo
- Alertas de stock bajo
- Historial de movimientos
- Valores unitarios y totales

### Transferencias (`/transferencias`)
- Crear transferencias entre áreas
- Aprobar/Rechazar con justificación
- Rastrear estado
- Generar actas
- Historial por usuario

### Usuarios (`/usuarios`)
- Directorio de usuarios
- Crear/Editar usuarios
- Asignar roles y permisos
- Ver historial de acceso
- Estados: activo, inactivo, bloqueado

### Auditoría (`/auditoria`)
- Registro inmutable de cambios
- Filtros por usuario, acción, módulo
- Comparativa antes-después
- Exportar logs
- Búsqueda avanzada

### Reportes (`/reportes`)
- 10+ tipos de reportes prediseñados
- Formatos: PDF, Excel, CSV, JSON
- Generación programada
- Descarga de reportes
- Parámetros personalizables

## 🧩 Componentes Comunes

### Button
```tsx
<Button
  label="Guardar"
  variant="primary"    // primary | secondary | danger | success | warning
  size="md"           // sm | md | lg
  onClick={handleClick}
  isLoading={false}
  disabled={false}
/>
```

### Modal
```tsx
<Modal
  isOpen={isOpen}
  title="Confirmar Acción"
  onClose={handleClose}
  onConfirm={handleConfirm}
  confirmText="Confirmar"
  cancelText="Cancelar"
  size="md"           // sm | md | lg
  loading={false}
>
  Contenido del modal
</Modal>
```

### DataTable
```tsx
<DataTable
  columns={[
    { header: 'Nombre', accessor: 'nombre', sortable: true },
    { header: 'Estado', accessor: 'estado', render: (v) => <Badge>{v}</Badge> }
  ]}
  data={data}
  loading={loading}
  hover
  striped
  paginated
  pageSize={10}
/>
```

### Alert
```tsx
<Alert
  type="success"       // success | error | warning | info
  message="¡Listo!"
  title="Operación exitosa"
  dismissible
  onClose={handleClose}
/>
```

## 🔌 Servicios API

### Auth Service
```ts
await authService.loginRequest({ identifier, password })
```

### Activos Service
```ts
await activosService.obtenerTodos(filtros)
await activosService.obtenerPorId(id)
await activosService.crear(datos)
await activosService.actualizar(id, datos)
await activosService.eliminar(id)
await activosService.obtenerHistorial(id)
```

### Otros Services
- `inventarioService`
- `transferenciasService`
- `usuariosService`
- `auditoriaService`
- `reportesService`

## 🎨 Personalización

### Colores
Edita en `styles/components.css`:
```css
.btn-primary {
  background-color: #0056b3; /* Azul */
}
.btn-success {
  background-color: #28a745; /* Verde */
}
```

### Temas
La estructura permite fácil implementación de temas:
```tsx
<div className={`theme-${isDark ? 'dark' : 'light'}`}>
  {/* Contenido */}
</div>
```

## 🐛 Solución de Problemas

| Problema | Solución |
|----------|----------|
| "Cannot GET /api/..." | Verifica que el backend esté en puerto 3000 |
| "Token inválido" | Limpia localStorage y vuelve a hacer login |
| "Página en blanco" | Revisa consola (F12) para errores de React |
| "Estilos no cargan" | Reinicia servidor Vite (`npm run dev`) |

## 📝 Tipos TypeScript Ejemplo

```ts
interface Activo {
  id: string;
  codigoActivo: string;
  nombre: string;
  estado: EstadoActivo;
  ubicacionId: string;
  responsableId: string;
  valorAdquisicion: number;
}

interface Usuario {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  rolId: string;
  estado: 'activo' | 'inactivo';
}
```

## 🚦 Estado del Proyecto

| Característica | Estado |
|---|---|
| Estructura base | ✅ Completado |
| Componentes comunes | ✅ Completado |
| Dashboard | ✅ Completado |
| Módulo Activos | ✅ Completado |
| Módulo Inventario | ✅ Completado |
| Módulo Transferencias | ✅ Completado |
| Módulo Usuarios | ✅ Completado |
| Módulo Auditoría | ✅ Completado |
| Módulo Reportes | ✅ Completado |
| Autenticación | ✅ Completado |
| Estilos responsive | ✅ Completado |
| Tipos TypeScript | ✅ Completado |
| Documentación | ✅ Completado |

## 📅 Próximas Mejoras

- [ ] Gráficos y dashboards avanzados
- [ ] Notificaciones en tiempo real (WebSocket)
- [ ] Modo offline
- [ ] Tema oscuro
- [ ] Internacionalización (i18n)
- [ ] Mejorar validaciones de forma
- [ ] Búsqueda global
- [ ] Filtros guardados

## 📞 Contacto y Soporte

Para reportar bugs o sugerencias, contacta al equipo de desarrollo.

---

**Versión**: 2.4.0
**Última actualización**: Marzo 2026
**Tecnología**: React 18 + TypeScript + Vite

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
