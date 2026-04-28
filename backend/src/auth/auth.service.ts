import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { ensureCoreAccessPermissions } from '../common/access-permissions';
import { PrismaService } from '../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import { EstadoUsuario } from '../generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { identifier, password } = loginDto;

    await ensureCoreAccessPermissions(this.prisma);

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ correo: identifier }, { nombreUsuario: identifier }],
      },
      include: {
        rol: {
          include: {
            permisos: {
              include: {
                permiso: true,
              },
            },
          },
        },
        area: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException('La cuenta no está activa');
    }

    const passwordMatches = await bcrypt.compare(
      password,
      usuario.hashContrasena,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const payload = {
      sub: usuario.id,
      correo: usuario.correo,
      nombreUsuario: usuario.nombreUsuario,
      rol: usuario.rol.nombre,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      usuario: this.buildAuthenticatedUser(usuario),
    };
  }

  async getCurrentSession(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        rol: {
          include: {
            permisos: {
              include: {
                permiso: true,
              },
            },
          },
        },
        area: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario autenticado no encontrado');
    }

    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException('La cuenta no está activa');
    }

    return {
      usuario: this.buildAuthenticatedUser(usuario),
    };
  }

  private buildAuthenticatedUser(usuario: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
    nombreUsuario: string;
    estado: EstadoUsuario;
    rol: {
      id: string;
      nombre: string;
      permisos: Array<{
        permiso: {
          id: string;
          codigo: string;
          nombre: string;
        };
      }>;
    };
    area: {
      id: string;
      nombre: string;
    } | null;
  }) {
    return {
      id: usuario.id,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      nombreUsuario: usuario.nombreUsuario,
      estado: usuario.estado,
      rol: {
        id: usuario.rol.id,
        nombre: usuario.rol.nombre,
      },
      area: usuario.area
        ? {
            id: usuario.area.id,
            nombre: usuario.area.nombre,
          }
        : null,
      permisos: usuario.rol.permisos.map((item) => ({
        id: item.permiso.id,
        codigo: item.permiso.codigo,
        nombre: item.permiso.nombre,
      })),
    };
  }
}
