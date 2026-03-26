// backend/src/users/users.service.ts
import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { nombres, apellidos, correo, nombreUsuario, password, telefono, areaId, rolId } = createUserDto;

    const existingUser = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ correo }, { nombreUsuario }],
      },
    });

    if (existingUser) {
      if (existingUser.correo === correo) {
        throw new BadRequestException('Correo ya registrado');
      }
      if (existingUser.nombreUsuario === nombreUsuario) {
        throw new BadRequestException('Nombre de usuario ya registrado');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Si se envía rolId, usar ese, sino buscar rol operativo por defecto
    let rolAsignadoId = rolId;
    
    if (!rolAsignadoId) {
      const rol = await this.prisma.rol.findFirst({
        where: { nombre: { contains: 'OPERATIVO', mode: 'insensitive' } },
      });
      if (!rol) {
        throw new BadRequestException('No existe un rol operativo base en la base de datos');
      }
      rolAsignadoId = rol.id;
    } else {
      // Verificar que el rol existe
      const rolExiste = await this.prisma.rol.findUnique({ where: { id: rolId } });
      if (!rolExiste) {
        throw new BadRequestException('El rol especificado no existe');
      }
    }

    const usuarioCreado = await this.prisma.usuario.create({
      data: {
        nombres,
        apellidos,
        correo,
        nombreUsuario,
        hashContrasena: hashedPassword,
        telefono,
        areaId,
        rolId: rolAsignadoId,
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        nombreUsuario: true,
        telefono: true,
        estado: true,
        areaId: true,
        rolId: true,
        creadoEn: true,
        actualizadoEn: true,
        rol: {
          select: { id: true, nombre: true }
        }
      },
    });

    return {
      message: 'Usuario creado correctamente',
      user: usuarioCreado,
    };
  }

  async findAll() {
    return this.prisma.usuario.findMany({
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        nombreUsuario: true,
        telefono: true,
        estado: true,
        areaId: true,
        rolId: true,
        creadoEn: true,
        actualizadoEn: true,
        rol: {
          select: { id: true, nombre: true }
        },
        area: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: {
        creadoEn: 'desc',
      },
    });
  }

  // --- PARTE: HU04 - ASIGNAR ROLES ---
  async updateRole(id: string, updateUserRoleDto: UpdateUserRoleDto) {
    const { rolId } = updateUserRoleDto;

    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const rolExiste = await this.prisma.rol.findUnique({ where: { id: rolId } });
    if (!rolExiste) throw new BadRequestException('El rol especificado no existe');

    return this.prisma.usuario.update({
      where: { id },
      data: { rolId },
      include: { rol: true }
    });
  }

  // --- FUNCIONES PARA MATRIZ DE PERMISOS ---

  async getRoles() {
    return this.prisma.rol.findMany({
      select: {
        id: true,
        nombre: true,
        descripcion: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  async getPermissionsByRole(rolId: string) {
    // Obtener todos los módulos disponibles para este rol
    const permisos = await this.prisma.rolPermiso.findMany({
      where: { rolId },
      orderBy: { modulo: 'asc' },
    });
    
    // Si no hay permisos, crear los módulos básicos
    if (permisos.length === 0) {
      const modulosBase = [
        'Dashboard', 'Usuarios', 'Roles', 'Activos', 
        'Asignaciones', 'Inventario', 'Reportes', 'Auditoria'
      ];
      
      for (const modulo of modulosBase) {
        await this.prisma.rolPermiso.upsert({
          where: {
            rolId_modulo: { rolId, modulo }
          },
          update: {},
          create: {
            rolId,
            modulo,
            ver: false,
            crear: false,
            actualizar: false,
            eliminar: false,
          },
        });
      }
      
      // Volver a obtener los permisos
      return this.prisma.rolPermiso.findMany({
        where: { rolId },
        orderBy: { modulo: 'asc' },
      });
    }
    
    return permisos;
  }

  async updateMatrix(rolId: string, modulo: string, data: any) {
    const { ver, crear, actualizar, eliminar } = data;

    return this.prisma.rolPermiso.upsert({
      where: {
        rolId_modulo: { rolId, modulo }
      },
      update: {
        ver: ver ?? false,
        crear: crear ?? false,
        actualizar: actualizar ?? false,
        eliminar: eliminar ?? false
      },
      create: {
        rolId,
        modulo,
        ver: ver ?? false,
        crear: crear ?? false,
        actualizar: actualizar ?? false,
        eliminar: eliminar ?? false
      }
    });
  }
}