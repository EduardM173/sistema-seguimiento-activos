import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { nombres, apellidos, correo, nombreUsuario, password } = createUserDto;

    // Verificar si ya existe un usuario con ese correo
    const existingUserByCorreo = await this.prisma.usuario.findUnique({
      where: { correo },
    });

    if (existingUserByCorreo) {
      throw new BadRequestException('Correo ya registrado');
    }

    // Verificar si ya existe un usuario con ese nombre de usuario
    const existingUserByUsername = await this.prisma.usuario.findUnique({
      where: { nombreUsuario },
    });

    if (existingUserByUsername) {
      throw new BadRequestException('Nombre de usuario ya registrado');
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Buscar un rol existente
    // Cambia el where según cómo esté definido tu modelo Rol
    const rol = await this.prisma.rol.findUnique({
        where: { nombre: 'USUARIO_OPERATIVO' },
    });

    if (!rol) {
      throw new BadRequestException(
        'No existe ningún rol USUARIO OPERATIVO en la base de datos',
      );
    }

    // Crear usuario
    const usuarioCreado = await this.prisma.usuario.create({
      data: {
        nombres,
        apellidos,
        correo,
        nombreUsuario,
        hashContrasena: hashedPassword,
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
}