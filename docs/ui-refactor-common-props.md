# Refactor UI - propiedades comunes identificadas

## Propiedades comunes de elementos UI

- Acciones: `label`, `variant`, `size`, `icon`, `disabled`, `isLoading`, `onClick`, `type`.
- Campos de formulario: `id`, `label`, `value`, `onChange`, `required`, `disabled`, `placeholder`, `error`, `hint`.
- Estados de pantalla: `loading`, `emptyMessage`, `errorMessage`, `title`, `message`, `action`.
- Contenedores de página: `title`, `subtitle`, `eyebrow`, `actions`, `children`, `className`.
- Listas/tablas: `data`, `columns`, `actions`, `loading`, `emptyMessage`, `sort`, `onRowClick`.
- Modales: `isOpen`, `title`, `subtitle`, `onClose`, `children`, `loading`, `footer/actions`.

## Componentes reutilizables existentes

- `Button`: acciones principales/secundarias con variantes, icono y estado de carga.
- `Alert`: mensajes de exito, error, advertencia o informacion.
- `PageHeader`: encabezado estandar para paginas.
- `Section`: bloque de contenido con titulo y acciones.
- `SmartTable` y `SmartGalery`: visualizacion de datos con carga, vacio y acciones.
- `OverlayModal` y `Modal`: estructura comun para modales.

## Componentes agregados

- `FormField`: centraliza label, input/textarea/select, requerido, ayuda y error.
- `EmptyState`: centraliza pantallas/listas vacias con icono, titulo, mensaje y accion.

## Refactor aplicado

- `SuppliersPage` reemplaza botones, alertas, encabezado, campos y estado vacio propios por componentes comunes.
- Se reducen estilos duplicados en `suppliers.css` y se mueven patrones compartidos a `components.css`.
