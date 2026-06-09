# PA3 - Regresion de comportamiento del refactor UI

## Criterio

Dado que el usuario navega por las pantallas refactorizadas, cuando use las funcionalidades existentes, entonces el comportamiento debe mantenerse igual que antes del refactor.

## Pantalla refactorizada

- `frontend/src/pages/suppliers/SuppliersPage.tsx`

## Comportamientos preservados

- Cargar proveedores al abrir la pantalla.
- Actualizar el listado con la accion `Actualizar`.
- Buscar proveedores usando el campo de busqueda y submit del formulario.
- Registrar proveedor con los mismos campos: nombre, NIT, contacto, telefono, correo, direccion, rubro y observaciones.
- Mostrar mensaje de error cuando falla una peticion.
- Mostrar mensaje de exito cuando se registra un proveedor.
- Limpiar el formulario despues de registrar correctamente.
- Mostrar estado vacio cuando no existen proveedores.

## Verificaciones ejecutadas

- `docker compose -f docker-compose.dev.yml exec -T frontend npm run build`
- `GET http://localhost:8085/proveedores` responde `200`.
- `GET http://localhost:8085/activos-agent/health` responde `200`.
- Login por proxy contra `POST /activos-backend/api/auth/login` responde `201` usando `identifier` y `password`.

## Nota tecnica

El refactor cambia estructura visual a componentes reutilizables, pero mantiene las mismas llamadas a `getSuppliers`, `createSupplier`, `loadSuppliers`, `updateField` y `submit`. Los nuevos componentes (`FormField`, `EmptyState`, `Button`, `Alert`, `PageHeader`, `Section`) reciben datos por props y no contienen datos propios de proveedores.
