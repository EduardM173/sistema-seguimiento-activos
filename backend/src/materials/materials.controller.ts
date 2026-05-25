import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Delete,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';

@ApiTags('materials')
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  create(@Body() createMaterialDto: CreateMaterialDto) {
    return this.materialsService.create(createMaterialDto);
  }

  @Get()
  findAll() {
    return this.materialsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  // ── Imágenes ────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Subir imágenes a un material' })
  @ApiParam({ name: 'id', description: 'ID del material' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Imágenes subidas correctamente' })
  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const id = (req.params as any).id as string;
          const dir = `/app/uploads/materiales/${id}`;
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|avif)$/)) {
          return cb(new BadRequestException('Solo se permiten imágenes (jpg, png, gif, webp, avif)'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Debe adjuntar al menos una imagen');
    }
    const imagenes = await this.materialsService.addImages(id, files);
    return { success: true, data: imagenes, message: 'Imágenes subidas correctamente' };
  }

  @ApiOperation({ summary: 'Listar imágenes de un material' })
  @ApiParam({ name: 'id', description: 'ID del material' })
  @ApiOkResponse({ description: 'Lista de imágenes' })
  @Get(':id/images')
  async listImages(@Param('id') id: string) {
    const imagenes = await this.materialsService.listImages(id);
    return { success: true, data: imagenes };
  }

  @ApiOperation({ summary: 'Eliminar una imagen de un material' })
  @ApiParam({ name: 'id', description: 'ID del material' })
  @ApiParam({ name: 'imageId', description: 'ID de la imagen' })
  @ApiOkResponse({ description: 'Imagen eliminada correctamente' })
  @Delete(':id/images/:imageId')
  async deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    await this.materialsService.deleteImage(id, imageId);
    return { success: true, message: 'Imagen eliminada correctamente' };
  }
}
