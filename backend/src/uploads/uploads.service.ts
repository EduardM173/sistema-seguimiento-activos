import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadsService {
  readonly baseDir = '/app/uploads';

  ensureDir(subPath: string): string {
    const dir = path.join(this.baseDir, subPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  deleteFile(ruta: string): void {
    if (fs.existsSync(ruta)) {
      fs.unlinkSync(ruta);
    }
  }

  buildUrl(relativePath: string): string {
    // relativePath como "activos/cuid123/imagen.webp"
    return `/uploads/${relativePath}`;
  }
}
