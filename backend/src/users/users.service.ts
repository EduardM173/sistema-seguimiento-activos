import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { nombres, apellidos, correo, nombreUsuario, password, telefono, areaId } = createUserDto;

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
      },
      orderBy: {
        id: 'desc',
      },
    });
  }
}