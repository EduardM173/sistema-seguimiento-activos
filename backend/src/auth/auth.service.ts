import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

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

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        OR: [
          { correo: identifier },
          { nombreUsuario: identifier },
        ],
      },
      include: {
        rol: true,
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
      rolId: usuario.rolId,
      rol: usuario.rol.nombre,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        nombreUsuario: usuario.nombreUsuario,
        estado: usuario.estado,
        rolId: usuario.rolId,
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
      },
    };
  }
}