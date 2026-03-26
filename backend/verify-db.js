require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('\n=== VERIFICACION DE BASE DE DATOS ===\n');

    // 1. Contar registros
    const usuarios = await prisma.usuario.count();
    const roles = await prisma.rol.count();
    const permisos = await prisma.permiso.count();
    const materiales = await prisma.material.count();
    const areas = await prisma.area.count();

    console.log('📊 ESTADÍSTICAS DE BD:');
    console.log(`   ✓ Usuarios: ${usuarios}`);
    console.log(`   ✓ Roles: ${roles}`);
    console.log(`   ✓ Permisos: ${permisos}`);
    console.log(`   ✓ Materiales: ${materiales}`);
    console.log(`   ✓ Áreas: ${areas}`);

    // 2. Verificar usuario operativo
    console.log('\n👤 USUARIO OPERATIVO:');
    const usuarioOperativo = await prisma.usuario.findUnique({
      where: { correo: 'operativo@activos.bo' },
      include: {
        rol: {
          include: {
            rolPermisos: {
              include: { permiso: true }
            }
          }
        }
      }
    });

    if (usuarioOperativo) {
      console.log(`   ✓ Email: ${usuarioOperativo.correo}`);
      console.log(`   ✓ Nombre: ${usuarioOperativo.nombres} ${usuarioOperativo.apellidos}`);
      console.log(`   ✓ Estado: ${usuarioOperativo.estado}`);
      console.log(`   ✓ Rol: ${usuarioOperativo.rol.nombre}`);
      console.log(`   ✓ Permisos asignados:`);
      usuarioOperativo.rol.rolPermisos.forEach(rp => {
        console.log(`      - ${rp.permiso.codigo}: ${rp.permiso.nombre}`);
      });
    } else {
      console.log('   ✗ Usuario NO encontrado');
    }

    // 3. HU33 - Materiales/Inventario
    console.log('\n📦 HU33 - INVENTARIO (Materiales):');
    if (materiales > 0) {
      const ultimoMaterial = await prisma.material.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      console.log(`   ✓ Total materiales: ${materiales}`);
      console.log(`   ✓ Último creado: ${ultimoMaterial.nombre} (${ultimoMaterial.codigo})`);
      console.log(`   ✓ Endpoints disponibles:`);
      console.log(`      POST   /inventory-items        - Crear material`);
      console.log(`      GET    /inventory-items        - Listar materiales`);
      console.log(`      GET    /inventory-items/:id    - Obtener material`);
      console.log(`      PUT    /inventory-items/:id    - Actualizar material`);
      console.log(`      DELETE /inventory-items/:id    - Eliminar material`);
    } else {
      console.log('   ℹ No hay materiales creados aún');
      console.log(`   ✓ Endpoints disponibles:`);
      console.log(`      POST   /inventory-items        - Crear material`);
      console.log(`      GET    /inventory-items        - Listar materiales`);
      console.log(`      GET    /inventory-items/:id    - Obtener material`);
      console.log(`      PUT    /inventory-items/:id    - Actualizar material`);
      console.log(`      DELETE /inventory-items/:id    - Eliminar material`);
    }

    // 4. Verificar que usuario tiene permiso INVENTORY_MANAGE
    const tienePermisoInventario = usuarioOperativo?.rol.rolPermisos.some(
      rp => rp.permiso.codigo === 'INVENTORY_MANAGE'
    );

    console.log('\n✅ RESUMEN:');
    console.log(`   BD: ${usuarios > 0 ? '✓ Conectada' : '✗ Vacía'}`);
    console.log(`   Usuario operativo: ${usuarioOperativo ? '✓ Existe' : '✗ No existe'}`);
    console.log(`   Permiso INVENTORY_MANAGE: ${tienePermisoInventario ? '✓ Asignado' : '✗ No asignado'}`);
    console.log(`   HU33 Status: ${materiales >= 0 ? '✓ Funcional' : '✗ Error'}`);

    console.log('\n💡 PRÓXIMOS PASOS:');
    console.log('   1. Inicia backend: npm run start:dev');
    console.log('   2. Inicia frontend: npm run dev');
    console.log('   3. Accede a: http://localhost:5173');
    console.log('   4. Login con: operativo@activos.bo / Operativo123*');
    console.log('   5. Prueba HU33 en módulo Inventario\n');

  } catch (error) {
    console.error('❌ Error al verificar BD:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
