import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildDatabaseUrl } from '../src/common/build-database-url.js';

const connectionString = buildDatabaseUrl();

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🌱 Iniciando seed...');

  // =========================
  // PERMISOS
  // =========================
  const permisosData = [
    {
      codigo: 'USER_MANAGE',
      nombre: 'Gestionar usuarios',
      descripcion: 'Crear, editar, desactivar y consultar usuarios',
    },
    {
      codigo: 'ROLE_ASSIGN',
      nombre: 'Asignar roles',
      descripcion: 'Asignar roles a los usuarios del sistema',
    },
    {
      codigo: 'ASSET_CREATE',
      nombre: 'Registrar activos',
      descripcion: 'Registrar nuevos activos en el sistema',
    },
    {
      codigo: 'ASSET_UPDATE',
      nombre: 'Actualizar activos',
      descripcion: 'Editar información de activos',
    },
    {
      codigo: 'ASSET_VIEW',
      nombre: 'Ver activos',
      descripcion: 'Consultar y buscar activos',
    },
    {
      codigo: 'ASSET_ASSIGN',
      nombre: 'Asignar activos',
      descripcion: 'Asignar y transferir activos',
    },
    {
      codigo: 'INVENTORY_MANAGE',
      nombre: 'Gestionar inventario',
      descripcion: 'Registrar entradas, salidas y ajustes',
    },
    {
      codigo: 'REPORT_VIEW',
      nombre: 'Generar reportes',
      descripcion: 'Generar y descargar reportes',
    },
    {
      codigo: 'AUDIT_VIEW',
      nombre: 'Ver auditoría',
      descripcion: 'Consultar historial y bitácora',
    },
  ];

  for (const permiso of permisosData) {
    await prisma.permiso.upsert({
      where: { codigo: permiso.codigo },
      update: {
        nombre: permiso.nombre,
        descripcion: permiso.descripcion,
      },
      create: permiso,
    });
  }

  // =========================
  // ROLES
  // =========================
  const rolAdmin = await prisma.rol.upsert({
    where: { nombre: 'ADMIN_GENERAL' },
    update: {
      descripcion: 'Administrador general del sistema',
    },
    create: {
      nombre: 'ADMIN_GENERAL',
      descripcion: 'Administrador general del sistema',
    },
  });

  const rolOperativo = await prisma.rol.upsert({
    where: { nombre: 'USUARIO_OPERATIVO' },
    update: {
      descripcion: 'Usuario operativo encargado del registro y gestión',
    },
    create: {
      nombre: 'USUARIO_OPERATIVO',
      descripcion: 'Usuario operativo encargado del registro y gestión',
    },
  });

  const rolResponsable = await prisma.rol.upsert({
    where: { nombre: 'RESPONSABLE_AREA' },
    update: {
      descripcion: 'Responsable de área',
    },
    create: {
      nombre: 'RESPONSABLE_AREA',
      descripcion: 'Responsable de área',
    },
  });

  const permisos = await prisma.permiso.findMany();

  const codigosPermisosAdmin = [
    'USER_MANAGE',
    'ROLE_ASSIGN',
    'ASSET_CREATE',
    'ASSET_UPDATE',
    'ASSET_VIEW',
    'ASSET_ASSIGN',
    'INVENTORY_MANAGE',
    'REPORT_VIEW',
    'AUDIT_VIEW',
  ];

  const codigosPermisosOperativo = [
    'ASSET_CREATE',
    'ASSET_UPDATE',
    'ASSET_VIEW',
    'ASSET_ASSIGN',
    'INVENTORY_MANAGE',
  ];

  const codigosPermisosResponsable = ['ASSET_VIEW', 'REPORT_VIEW'];

  for (const permiso of permisos) {
    if (codigosPermisosAdmin.includes(permiso.codigo)) {
      await prisma.rolPermiso.upsert({
        where: {
          rolId_permisoId: {
            rolId: rolAdmin.id,
            permisoId: permiso.id,
          },
        },
        update: {},
        create: {
          rolId: rolAdmin.id,
          permisoId: permiso.id,
        },
      });
    }

    if (codigosPermisosOperativo.includes(permiso.codigo)) {
      await prisma.rolPermiso.upsert({
        where: {
          rolId_permisoId: {
            rolId: rolOperativo.id,
            permisoId: permiso.id,
          },
        },
        update: {},
        create: {
          rolId: rolOperativo.id,
          permisoId: permiso.id,
        },
      });
    }

    if (codigosPermisosResponsable.includes(permiso.codigo)) {
      await prisma.rolPermiso.upsert({
        where: {
          rolId_permisoId: {
            rolId: rolResponsable.id,
            permisoId: permiso.id,
          },
        },
        update: {},
        create: {
          rolId: rolResponsable.id,
          permisoId: permiso.id,
        },
      });
    }
  }

  // =========================
  // UBICACIONES
  // =========================
  const ubicacionSistemas = await prisma.ubicacion.upsert({
    where: {
      nombre_edificio_piso_ambiente: {
        nombre: 'Oficina de Sistemas',
        edificio: 'Bloque A',
        piso: '2',
        ambiente: '201',
      },
    },
    update: {
      descripcion: 'Oficina principal del área de sistemas',
    },
    create: {
      nombre: 'Oficina de Sistemas',
      edificio: 'Bloque A',
      piso: '2',
      ambiente: '201',
      descripcion: 'Oficina principal del área de sistemas',
    },
  });

  const ubicacionAlmacen = await prisma.ubicacion.upsert({
    where: {
      nombre_edificio_piso_ambiente: {
        nombre: 'Almacén Central',
        edificio: 'Bloque B',
        piso: '1',
        ambiente: '102',
      },
    },
    update: {
      descripcion: 'Área de almacenamiento institucional',
    },
    create: {
      nombre: 'Almacén Central',
      edificio: 'Bloque B',
      piso: '1',
      ambiente: '102',
      descripcion: 'Área de almacenamiento institucional',
    },
  });

  // =========================
  // ÁREAS
  // =========================
  const areaSistemas = await prisma.area.upsert({
    where: { nombre: 'Sistemas' },
    update: {
      descripcion: 'Área encargada de TI',
      ubicacionId: ubicacionSistemas.id,
    },
    create: {
      nombre: 'Sistemas',
      descripcion: 'Área encargada de TI',
      ubicacionId: ubicacionSistemas.id,
    },
  });

  const areaAdministracion = await prisma.area.upsert({
    where: { nombre: 'Administración' },
    update: {
      descripcion: 'Área administrativa institucional',
      ubicacionId: ubicacionAlmacen.id,
    },
    create: {
      nombre: 'Administración',
      descripcion: 'Área administrativa institucional',
      ubicacionId: ubicacionAlmacen.id,
    },
  });

  // =========================
  // USUARIOS
  // =========================
  const passwordAdmin = await bcrypt.hash('Admin123*', 10);
  const passwordOperativo = await bcrypt.hash('Operativo123*', 10);
  const passwordResponsable = await bcrypt.hash('Responsable123*', 10);

  const usuarioAdmin = await prisma.usuario.upsert({
    where: { correo: 'admin@activos.bo' },
    update: {
      nombres: 'Eduardo',
      apellidos: 'Administrador',
      nombreUsuario: 'admin.general',
      hashContrasena: passwordAdmin,
      rolId: rolAdmin.id,
      estado: 'ACTIVO',
    },
    create: {
      nombres: 'Eduardo',
      apellidos: 'Administrador',
      correo: 'admin@activos.bo',
      nombreUsuario: 'admin.general',
      hashContrasena: passwordAdmin,
      rolId: rolAdmin.id,
      estado: 'ACTIVO',
      telefono: '70000001',
    },
  });

  const usuarioOperativo = await prisma.usuario.upsert({
    where: { correo: 'operativo@activos.bo' },
    update: {
      nombres: 'María',
      apellidos: 'Operativa',
      nombreUsuario: 'maria.operativa',
      hashContrasena: passwordOperativo,
      rolId: rolOperativo.id,
      areaId: areaSistemas.id,
      estado: 'ACTIVO',
    },
    create: {
      nombres: 'María',
      apellidos: 'Operativa',
      correo: 'operativo@activos.bo',
      nombreUsuario: 'maria.operativa',
      hashContrasena: passwordOperativo,
      rolId: rolOperativo.id,
      areaId: areaSistemas.id,
      estado: 'ACTIVO',
      telefono: '70000002',
    },
  });

  const usuarioResponsable = await prisma.usuario.upsert({
    where: { correo: 'responsable@activos.bo' },
    update: {
      nombres: 'Carlos',
      apellidos: 'Responsable',
      nombreUsuario: 'carlos.responsable',
      hashContrasena: passwordResponsable,
      rolId: rolResponsable.id,
      areaId: areaAdministracion.id,
      estado: 'ACTIVO',
    },
    create: {
      nombres: 'Carlos',
      apellidos: 'Responsable',
      correo: 'responsable@activos.bo',
      nombreUsuario: 'carlos.responsable',
      hashContrasena: passwordResponsable,
      rolId: rolResponsable.id,
      areaId: areaAdministracion.id,
      estado: 'ACTIVO',
      telefono: '70000003',
    },
  });

  await prisma.area.update({
    where: { id: areaSistemas.id },
    data: {
      encargadoId: usuarioOperativo.id,
    },
  });

  await prisma.area.update({
    where: { id: areaAdministracion.id },
    data: {
      encargadoId: usuarioResponsable.id,
    },
  });

  // =========================
  // CATEGORÍAS DE ACTIVOS
  // =========================
  const categoriaLaptop = await prisma.categoriaActivo.upsert({
    where: { nombre: 'Laptop' },
    update: {
      descripcion: 'Equipos portátiles',
    },
    create: {
      nombre: 'Laptop',
      descripcion: 'Equipos portátiles',
    },
  });

  const categoriaImpresora = await prisma.categoriaActivo.upsert({
    where: { nombre: 'Impresora' },
    update: {
      descripcion: 'Equipos de impresión',
    },
    create: {
      nombre: 'Impresora',
      descripcion: 'Equipos de impresión',
    },
  });

  const categoriaMobiliario = await prisma.categoriaActivo.upsert({
    where: { nombre: 'Mobiliario' },
    update: {
      descripcion: 'Muebles institucionales',
    },
    create: {
      nombre: 'Mobiliario',
      descripcion: 'Muebles institucionales',
    },
  });

  // =========================
  // ACTIVOS
  // =========================
  const laptopDell = await prisma.activo.upsert({
    where: { codigo: 'ACT-001' },
    update: {
      nombre: 'Laptop Dell Latitude 5420',
      categoriaId: categoriaLaptop.id,
      ubicacionId: ubicacionSistemas.id,
      areaActualId: areaSistemas.id,
      responsableActualId: usuarioOperativo.id,
      actualizadoPorId: usuarioAdmin.id,
    },
    create: {
      codigo: 'ACT-001',
      nombre: 'Laptop Dell Latitude 5420',
      descripcion: 'Laptop institucional para trabajo operativo',
      marca: 'Dell',
      modelo: 'Latitude 5420',
      numeroSerie: 'DL-5420-0001',
      fechaAdquisicion: new Date('2025-01-15'),
      costoAdquisicion: '6800.00',
      vencimientoGarantia: new Date('2027-01-15'),
      estado: 'OPERATIVO',
      categoriaId: categoriaLaptop.id,
      ubicacionId: ubicacionSistemas.id,
      areaActualId: areaSistemas.id,
      responsableActualId: usuarioOperativo.id,
      creadoPorId: usuarioAdmin.id,
      actualizadoPorId: usuarioAdmin.id,
    },
  });

  const impresoraHp = await prisma.activo.upsert({
    where: { codigo: 'ACT-002' },
    update: {
      nombre: 'Impresora HP LaserJet Pro',
      categoriaId: categoriaImpresora.id,
      ubicacionId: ubicacionAlmacen.id,
      areaActualId: areaAdministracion.id,
      responsableActualId: usuarioResponsable.id,
      actualizadoPorId: usuarioAdmin.id,
    },
    create: {
      codigo: 'ACT-002',
      nombre: 'Impresora HP LaserJet Pro',
      descripcion: 'Impresora del área administrativa',
      marca: 'HP',
      modelo: 'LaserJet Pro',
      numeroSerie: 'HP-LJ-0002',
      fechaAdquisicion: new Date('2024-11-10'),
      costoAdquisicion: '3200.00',
      vencimientoGarantia: new Date('2026-11-10'),
      estado: 'OPERATIVO',
      categoriaId: categoriaImpresora.id,
      ubicacionId: ubicacionAlmacen.id,
      areaActualId: areaAdministracion.id,
      responsableActualId: usuarioResponsable.id,
      creadoPorId: usuarioAdmin.id,
      actualizadoPorId: usuarioAdmin.id,
    },
  });

  const escritorio = await prisma.activo.upsert({
    where: { codigo: 'ACT-003' },
    update: {
      nombre: 'Escritorio Ejecutivo',
      categoriaId: categoriaMobiliario.id,
      ubicacionId: ubicacionAlmacen.id,
      areaActualId: areaAdministracion.id,
      actualizadoPorId: usuarioAdmin.id,
    },
    create: {
      codigo: 'ACT-003',
      nombre: 'Escritorio Ejecutivo',
      descripcion: 'Mobiliario para oficina administrativa',
      marca: 'Genérico',
      modelo: 'Oficina 120',
      numeroSerie: 'MOB-0003',
      fechaAdquisicion: new Date('2024-06-20'),
      costoAdquisicion: '950.00',
      estado: 'OPERATIVO',
      categoriaId: categoriaMobiliario.id,
      ubicacionId: ubicacionAlmacen.id,
      areaActualId: areaAdministracion.id,
      creadoPorId: usuarioAdmin.id,
      actualizadoPorId: usuarioAdmin.id,
    },
  });

  // =========================
  // MOVIMIENTOS DE ACTIVOS
  // =========================
  for (const activo of [laptopDell, impresoraHp, escritorio]) {
    const movExistente = await prisma.movimientoActivo.findFirst({
      where: { activoId: activo.id, tipo: 'REGISTRO' },
    });
    if (!movExistente) {
      await prisma.movimientoActivo.create({
        data: {
          activoId: activo.id,
          tipo: 'REGISTRO',
          realizadoPorId: usuarioAdmin.id,
          detalle: 'Registro inicial del activo en el sistema',
        },
      });
    }
  }

  // =========================
  // ASIGNACIÓN PENDIENTE
  // =========================
  let asignacionPendiente = await prisma.asignacionActivo.findFirst({
    where: { activoId: laptopDell.id, estado: 'PENDIENTE' },
  });
  if (!asignacionPendiente) {
    asignacionPendiente = await prisma.asignacionActivo.create({
      data: {
        activoId: laptopDell.id,
        areaAsignadaId: areaAdministracion.id,
        usuarioAsignadoId: usuarioResponsable.id,
        asignadoPorId: usuarioOperativo.id,
        estado: 'PENDIENTE',
        observaciones: 'Entrega pendiente de confirmación por el responsable',
      },
    });

    await prisma.movimientoActivo.create({
      data: {
        activoId: laptopDell.id,
        tipo: 'ASIGNACION',
        areaOrigenId: areaSistemas.id,
        areaDestinoId: areaAdministracion.id,
        usuarioOrigenId: usuarioOperativo.id,
        usuarioDestinoId: usuarioResponsable.id,
        realizadoPorId: usuarioOperativo.id,
        asignacionId: asignacionPendiente.id,
        detalle: 'Asignación inicial pendiente de confirmación',
      },
    });
  }

  // =========================
  // INCIDENTE
  // =========================
  let incidente = await prisma.incidenteActivo.findFirst({
    where: { activoId: impresoraHp.id, titulo: 'Atasco de papel frecuente' },
  });
  if (!incidente) {
    incidente = await prisma.incidenteActivo.create({
      data: {
        activoId: impresoraHp.id,
        reportadoPorId: usuarioResponsable.id,
        titulo: 'Atasco de papel frecuente',
        descripcion: 'La impresora presenta fallas recurrentes al imprimir documentos largos.',
      },
    });

    await prisma.documentoActivo.create({
      data: {
        incidenteId: incidente.id,
        nombreArchivo: 'reporte-impresora.pdf',
        urlArchivo: '/uploads/reporte-impresora.pdf',
        tipoMime: 'application/pdf',
      },
    });
  }

  // =========================
  // CATEGORÍAS DE MATERIALES
  // =========================
  const categoriaPapeleria = await prisma.categoriaMaterial.upsert({
    where: { nombre: 'Papelería' },
    update: {
      descripcion: 'Materiales de oficina',
    },
    create: {
      nombre: 'Papelería',
      descripcion: 'Materiales de oficina',
    },
  });

  const categoriaLimpieza = await prisma.categoriaMaterial.upsert({
    where: { nombre: 'Limpieza' },
    update: {
      descripcion: 'Materiales de limpieza institucional',
    },
    create: {
      nombre: 'Limpieza',
      descripcion: 'Materiales de limpieza institucional',
    },
  });

  // =========================
  // MATERIALES
  // =========================
  const papelCarta = await prisma.material.upsert({
    where: { codigo: 'MAT-001' },
    update: {
      nombre: 'Papel bond carta',
      unidad: 'paquete',
      stockActual: '15.00',
      stockMinimo: '10.00',
      categoriaId: categoriaPapeleria.id,
    },
    create: {
      codigo: 'MAT-001',
      nombre: 'Papel bond carta',
      descripcion: 'Paquete de hojas tamaño carta',
      unidad: 'paquete',
      stockActual: '15.00',
      stockMinimo: '10.00',
      categoriaId: categoriaPapeleria.id,
    },
  });

  const tonerHp = await prisma.material.upsert({
    where: { codigo: 'MAT-002' },
    update: {
      nombre: 'Tóner HP 85A',
      unidad: 'unidad',
      stockActual: '3.00',
      stockMinimo: '5.00',
      categoriaId: categoriaPapeleria.id,
    },
    create: {
      codigo: 'MAT-002',
      nombre: 'Tóner HP 85A',
      descripcion: 'Tóner para impresora HP LaserJet',
      unidad: 'unidad',
      stockActual: '3.00',
      stockMinimo: '5.00',
      categoriaId: categoriaPapeleria.id,
    },
  });

  const detergente = await prisma.material.upsert({
    where: { codigo: 'MAT-003' },
    update: {
      nombre: 'Detergente líquido',
      unidad: 'litro',
      stockActual: '8.00',
      stockMinimo: '4.00',
      categoriaId: categoriaLimpieza.id,
    },
    create: {
      codigo: 'MAT-003',
      nombre: 'Detergente líquido',
      descripcion: 'Insumo de limpieza',
      unidad: 'litro',
      stockActual: '8.00',
      stockMinimo: '4.00',
      categoriaId: categoriaLimpieza.id,
    },
  });

  // =========================
  // MOVIMIENTOS DE INVENTARIO
  // =========================
  const movInvExistente = await prisma.movimientoInventario.findFirst({
    where: { materialId: papelCarta.id, motivo: 'Ingreso inicial de stock' },
  });
  if (!movInvExistente) {
    await prisma.movimientoInventario.createMany({
      data: [
        {
          materialId: papelCarta.id,
          tipo: 'ENTRADA',
          cantidad: '20.00',
          stockAnterior: '0.00',
          stockNuevo: '20.00',
          motivo: 'Ingreso inicial de stock',
          realizadoPorId: usuarioOperativo.id,
        },
        {
          materialId: papelCarta.id,
          tipo: 'SALIDA',
          cantidad: '5.00',
          stockAnterior: '20.00',
          stockNuevo: '15.00',
          motivo: 'Consumo administrativo',
          realizadoPorId: usuarioOperativo.id,
        },
        {
          materialId: tonerHp.id,
          tipo: 'ENTRADA',
          cantidad: '3.00',
          stockAnterior: '0.00',
          stockNuevo: '3.00',
          motivo: 'Ingreso inicial de stock',
          realizadoPorId: usuarioOperativo.id,
        },
        {
          materialId: detergente.id,
          tipo: 'ENTRADA',
          cantidad: '8.00',
          stockAnterior: '0.00',
          stockNuevo: '8.00',
          motivo: 'Ingreso inicial de stock',
          realizadoPorId: usuarioOperativo.id,
        },
      ],
    });
  }

  // =========================
  // NOTIFICACIONES
  // =========================
  const notifTonerExistente = await prisma.notificacion.findFirst({
    where: { usuarioId: usuarioOperativo.id, tipo: 'STOCK_BAJO', materialId: tonerHp.id },
  });
  if (!notifTonerExistente) {
    await prisma.notificacion.create({
      data: {
        usuarioId: usuarioOperativo.id,
        materialId: tonerHp.id,
        tipo: 'STOCK_BAJO',
        titulo: 'Stock bajo de tóner',
        mensaje: 'El material Tóner HP 85A está por debajo del stock mínimo.',
        estado: 'NO_LEIDA',
      },
    });
  }

  const notifActivoExistente = await prisma.notificacion.findFirst({
    where: { usuarioId: usuarioResponsable.id, tipo: 'ACTIVO_PENDIENTE_CONFIRMACION', areaId: areaAdministracion.id },
  });
  if (!notifActivoExistente) {
    await prisma.notificacion.create({
      data: {
        usuarioId: usuarioResponsable.id,
        areaId: areaAdministracion.id,
        tipo: 'ACTIVO_PENDIENTE_CONFIRMACION',
        titulo: 'Activo pendiente de confirmación',
        mensaje: 'Tienes un activo pendiente de recepción en tu área.',
        estado: 'NO_LEIDA',
      },
    });
  }

  // =========================
  // AUDITORÍA
  // =========================
  const audAdminExistente = await prisma.auditoria.findFirst({
    where: { accion: 'SEED_CREATE_ADMIN' },
  });
  if (!audAdminExistente) {
    await prisma.auditoria.create({
      data: {
        usuarioId: usuarioAdmin.id,
        tipoEntidad: 'Usuario',
        entidadId: usuarioAdmin.id,
        accion: 'SEED_CREATE_ADMIN',
        valoresNuevos: {
          correo: usuarioAdmin.correo,
          rol: 'ADMIN_GENERAL',
        },
        direccionIp: '127.0.0.1',
        userAgent: 'seed-script',
      },
    });
  }

  const audAsignExistente = await prisma.auditoria.findFirst({
    where: { accion: 'SEED_ASSIGNMENT_CREATED' },
  });
  if (!audAsignExistente) {
    await prisma.auditoria.create({
      data: {
        usuarioId: usuarioOperativo.id,
        tipoEntidad: 'Activo',
        entidadId: laptopDell.id,
        accion: 'SEED_ASSIGNMENT_CREATED',
        valoresNuevos: {
          codigoActivo: laptopDell.codigo,
          estado: 'PENDIENTE',
        },
        direccionIp: '127.0.0.1',
        userAgent: 'seed-script',
      },
    });
  }

  // =========================
  // REPORTE GENERADO
  // =========================
  const reporteExistente = await prisma.reporteGenerado.findFirst({
    where: { nombre: 'Reporte inicial de inventario' },
  });
  if (!reporteExistente) {
    await prisma.reporteGenerado.create({
      data: {
        generadoPorId: usuarioAdmin.id,
        nombre: 'Reporte inicial de inventario',
        tipo: 'INVENTORY_SUMMARY',
        formato: 'PDF',
        filtros: {
          area: 'todas',
          categoria: 'todas',
        },
        urlArchivo: '/reports/reporte-inicial-inventario.pdf',
      },
    });
  }

  console.log('✅ Seed completado correctamente');
  console.log('');
  console.log('Usuarios de prueba:');
  console.log('Admin -> admin@activos.bo / Admin123*');
  console.log('Operativo -> operativo@activos.bo / Operativo123*');
  console.log('Responsable -> responsable@activos.bo / Responsable123*');
}

main()
  .catch((error) => {
    console.error('❌ Error al ejecutar el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });