// backend/src/common/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';

export interface PermissionRequirements {
  modulo: string;
  acciones: ('ver' | 'crear' | 'actualizar' | 'eliminar')[];
}

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (requirements: PermissionRequirements) => 
  SetMetadata(PERMISSIONS_KEY, requirements);