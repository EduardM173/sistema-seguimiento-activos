# PA4 - Reduccion de duplicacion visual

## Criterio

Dado que se haya terminado el refactor, cuando se revise el codigo, entonces debe reducirse la duplicacion de componentes visuales en las pantallas trabajadas.

## Pantalla revisada

- `frontend/src/pages/suppliers/SuppliersPage.tsx`

## Duplicacion reducida

| Antes | Ahora |
| --- | --- |
| Encabezado propio con `suppliersHeader` | `PageHeader` reutilizable con `eyebrow`, `title`, `subtitle` y `actions` |
| Botones propios `suppliersButton` | `Button` reutilizable con `label`, `variant`, `icon`, `isLoading` |
| Alertas propias `suppliersAlert` | `Alert` reutilizable con `type`, `message`, `onClose` |
| Labels e inputs repetidos | `FormField` reutilizable con `id`, `label`, `value`, `onChange`, `required`, `as` |
| Estado vacio propio `suppliersEmpty` | `EmptyState` reutilizable con `icon`, `title`, `message`, `action` |
| Secciones propias con titulo | `Section` reutilizable con `title`, `actions`, `children` |

## Evidencia de codigo

- `frontend/src/styles/suppliers.css` queda enfocado en layout propio de proveedores.
- Los estilos compartidos de campos y estados vacios viven en `frontend/src/styles/components.css`.
- `SuppliersPage` mantiene la logica de negocio y delega elementos visuales repetidos a componentes comunes.

## Resultado

La pantalla trabajada ya no define variantes visuales propias para encabezado, botones, alertas, campos y estados vacios. Esos elementos se centralizan en componentes reutilizables y reciben datos por props.
