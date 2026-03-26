import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRole(role: {
    id: string;
    nombre: string;
    descripcion: string | null;
    permisos?: Array<{
      permiso: {
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string | null;
      };
    }>;
  }) {
    return {
      id: role.id,
      nombre: role.nombre,
      descripcion: role.descripcion,
      permisos: (role.permisos ?? [])
        .map((item) => item.permiso)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  }

  async create(createUserDto: CreateUserDto) {
    const {
      nombres,
      apellidos,
      correo,
      nombreUsuario,
      password,
      telefono,
      areaId,
    } = createUserDto;

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

    const rol = await this.prisma.rol.findUnique({
      where: { nombre: 'USUARIO_OPERATIVO' },
    });

    if (!rol) {
      throw new BadRequestException(
        'No existe el rol USUARIO_OPERATIVO en la base de datos',
      );
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
        rolId: rol.id,
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
          select: {
            id: true,
            nombre: true,
            descripcion: true,
          },
        },
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
          select: {
            id: true,
            nombre: true,
            descripcion: true,
          },
        },
      },
      orderBy: {
        creadoEn: 'desc',
      },
    });
  }

  async findRoles() {
    const roles = await this.prisma.rol.findMany({
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        permisos: {
          select: {
            permiso: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                descripcion: true,
              },
            },
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    return roles.map((role) => this.mapRole(role));
  }

  async findPermissions() {
    return this.prisma.permiso.findMany({
      select: {
        id: true,
        codigo: true,
        nombre: true,
        descripcion: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  async updateUserRole(userId: string, rolId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        rolId: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const rol = await this.prisma.rol.findUnique({
      where: { id: rolId },
    });

    if (!rol) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (usuario.rolId === rolId) {
      throw new BadRequestException('El usuario ya tiene asignado ese rol');
    }

    const usuarioActualizado = await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        rolId,
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
          select: {
            id: true,
            nombre: true,
            descripcion: true,
          },
        },
      },
    });

    return {
      message: 'Rol actualizado correctamente',
      user: usuarioActualizado,
    };
  }

  async createRole(createRoleDto: CreateRoleDto) {
    const nombreNormalizado = createRoleDto.nombre
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

    const descripcion = createRoleDto.descripcion?.trim() || null;
    const permisoIds = createRoleDto.permisoIds ?? [];

    const existingRole = await this.prisma.rol.findUnique({
      where: { nombre: nombreNormalizado },
    });

    if (existingRole) {
      throw new BadRequestException('Ya existe un rol con ese nombre');
    }

    if (permisoIds.length > 0) {
      const permisosValidos = await this.prisma.permiso.findMany({
        where: {
          id: { in: permisoIds },
        },
        select: { id: true },
      });

      if (permisosValidos.length !== permisoIds.length) {
        throw new BadRequestException(
          'Uno o más permisos enviados no existen',
        );
      }
    }

    const rolCreado = await this.prisma.rol.create({
      data: {
        nombre: nombreNormalizado,
        descripcion,
        permisos:
          permisoIds.length > 0
            ? {
                create: permisoIds.map((permisoId) => ({
                  permisoId,
                })),
              }
            : undefined,
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        permisos: {
          select: {
            permiso: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                descripcion: true,
              },
            },
          },
        },
      },
    });

    return {
      message: 'Rol creado correctamente',
      role: this.mapRole(rolCreado),
    };
  }

  async updateRolePermissions(
    roleId: string,
    updateRolePermissionsDto: UpdateRolePermissionsDto,
  ) {
    const { permisoIds } = updateRolePermissionsDto;

    const role = await this.prisma.rol.findUnique({
      where: { id: roleId },
      select: { id: true, nombre: true },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (permisoIds.length > 0) {
      const permisosValidos = await this.prisma.permiso.findMany({
        where: {
          id: { in: permisoIds },
        },
        select: { id: true },
      });

      if (permisosValidos.length !== permisoIds.length) {
        throw new BadRequestException(
          'Uno o más permisos enviados no existen',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolPermiso.deleteMany({
        where: { rolId: roleId },
      });

      if (permisoIds.length > 0) {
        await tx.rolPermiso.createMany({
          data: permisoIds.map((permisoId) => ({
            rolId: roleId,
            permisoId,
          })),
        });
      }
    });

    const rolActualizado = await this.prisma.rol.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        permisos: {
          select: {
            permiso: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                descripcion: true,
              },
            },
          },
        },
      },
    });

    if (!rolActualizado) {
      throw new NotFoundException('Rol no encontrado');
    }

    return {
      message: 'Permisos del rol actualizados correctamente',
      role: this.mapRole(rolActualizado),
    };
  }
}