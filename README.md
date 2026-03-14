# Base de Datos — Guía rápida con Prisma

## Regla principal

La estructura de la base de datos **NO debe modificarse desde pgAdmin**.

Todos los cambios estructurales se hacen **únicamente en:**

```
prisma/schema.prisma
```

Luego se aplican usando **migraciones de Prisma**.

Esto garantiza que todo el equipo tenga **la misma estructura de base de datos**.

---

# Requisitos

Debes tener instalado:

- PostgreSQL
- Node.js
- Dependencias del proyecto
- Archivo `.env` configurado

Ejemplo de conexión:

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/seguimiento_activos"
```

---

# Primera vez ejecutando el proyecto

Entrar a la carpeta:

```
backend
```

### Instalar dependencias

```
npm install
```

### Verificar Prisma

```
npx prisma -v
```

### Ejecutar migraciones

Crea todas las tablas necesarias.

```
npx prisma migrate dev
```

### Generar cliente Prisma

```
npx prisma generate
```

### Ejecutar seed (Prisma 7)

```
npm run prisma:seed
```

### Abrir panel visual (opcional)

```
npx prisma studio
```

---

# Flujo de trabajo para cambios en la base

### 1 Editar el schema

```
prisma/schema.prisma
```

### 2 Formatear

```
npx prisma format
```

### 3 Validar

```
npx prisma validate
```

### 4 Crear migración

```
npx prisma migrate dev --name nombre_del_cambio
```

Ejemplo:

```
npx prisma migrate dev --name add_asset_documents
```

### 5 Regenerar cliente

```
npx prisma generate
```

---

# Comandos útiles

Formatear schema

```
npx prisma format
```

Validar schema

```
npx prisma validate
```

Crear migración

```
npx prisma migrate dev --name nombre_del_cambio
```

Generar cliente

```
npx prisma generate
```

Ver estado de migraciones

```
npx prisma migrate status
```

Abrir Prisma Studio

```
npx prisma studio
```

Ejecutar seed

```
npm run prisma:seed
```

Reiniciar base local (⚠ borra datos)

```
npx prisma migrate reset
npm run prisma:seed
```

---

# Lo que NO se debe hacer

❌ Modificar tablas manualmente en **pgAdmin**  
❌ Borrar tablas manualmente  
❌ Modificar migraciones antiguas  
❌ Borrar carpetas dentro de

```
prisma/migrations
```

❌ Ejecutar

```
prisma migrate reset
```

sin avisar al equipo.

---

# Flujo rápido

Modificar:

```
prisma/schema.prisma
```

Luego ejecutar:

```
npx prisma format
npx prisma validate
npx prisma migrate dev --name nombre_del_cambio
npx prisma generate
```

---

Siguiendo estas reglas todos los miembros del equipo tendrán **la misma estructura de base de datos**.
