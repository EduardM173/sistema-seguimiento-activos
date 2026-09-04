import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { ensureCoreAccessPermissions } from '../common/access-permissions';
import { PrismaService } from '../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailConfirmationService } from './email-confirmation.service';
import { EstadoUsuario } from '../generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailConfirmationService: EmailConfirmationService,
  ) {}

  async register(registerDto: RegisterDto) {
    const nombres = registerDto.nombres.trim();
    const apellidos = registerDto.apellidos.trim();
    const correo = registerDto.correo.trim().toLowerCase();
    const nombreUsuario = registerDto.nombreUsuario.trim();
    const telefono = registerDto.telefono?.trim() || null;

    const existingUser = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ correo }, { nombreUsuario }],
      },
      select: {
        correo: true,
        nombreUsuario: true,
      },
    });

    if (existingUser?.correo === correo) {
      throw new BadRequestException('Correo ya registrado');
    }

    if (existingUser?.nombreUsuario === nombreUsuario) {
      throw new BadRequestException('Nombre de usuario ya registrado');
    }

    const defaultRoleName =
      process.env.AUTH_REGISTER_DEFAULT_ROLE || 'USUARIO_OPERATIVO';
    const rol = await this.prisma.rol.findUnique({
      where: { nombre: defaultRoleName },
    });

    if (!rol) {
      throw new BadRequestException(
        `No existe el rol ${defaultRoleName} para registro de usuarios`,
      );
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const usuario = await this.prisma.usuario.create({
      data: {
        nombres,
        apellidos,
        correo,
        nombreUsuario,
        hashContrasena: hashedPassword,
        telefono,
        estado: EstadoUsuario.ACTIVO,
        correoConfirmado: false,
        rolId: rol.id,
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        nombreUsuario: true,
        estado: true,
        correoConfirmado: true,
        creadoEn: true,
      },
    });

    const confirmationUrl = await this.buildEmailConfirmationUrl(usuario);
    const emailResult =
      await this.emailConfirmationService.sendConfirmationEmail({
        to: usuario.correo,
        fullName: `${usuario.nombres} ${usuario.apellidos}`.trim(),
        confirmationUrl,
      });

    return {
      message:
        'Usuario registrado correctamente. Revisa tu correo para confirmar la cuenta.',
      emailConfirmationSent: emailResult.sent,
      usuario,
    };
  }

  async confirmEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Token de confirmacion requerido');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        correo: string;
        purpose: string;
      }>(token);

      if (payload.purpose !== 'email-confirmation') {
        throw new BadRequestException('Token de confirmacion invalido');
      }

      await this.prisma.usuario.update({
        where: {
          id: payload.sub,
          correo: payload.correo,
        },
        data: {
          correoConfirmado: true,
          correoConfirmadoEn: new Date(),
        },
      });

      return {
        message: 'Correo confirmado correctamente',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Token de confirmacion invalido o expirado');
    }
  }

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

  private async buildEmailConfirmationUrl(usuario: {
    id: string;
    correo: string;
  }) {
    const token = await this.jwtService.signAsync(
      {
        sub: usuario.id,
        correo: usuario.correo,
        purpose: 'email-confirmation',
      },
      {
        expiresIn: (process.env.EMAIL_CONFIRMATION_EXPIRES_IN || '1d') as any,
      },
    );

    const publicBaseUrl =
      process.env.AUTH_PUBLIC_URL ||
      process.env.APP_PUBLIC_URL ||
      process.env.FRONTEND_URL ||
      `http://localhost:${process.env.BACKEND_PORT || '3001'}`;

    return `${publicBaseUrl.replace(/\/$/, '')}/api/auth/confirm-email?token=${encodeURIComponent(token)}`;
  }
}
