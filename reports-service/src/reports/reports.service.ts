import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type CountRow = {
  total: string;
};

type AssetStatusRow = {
  estado: string;
  cantidad: string;
};

@Injectable()
export class ReportsService {
  private readonly assetStatuses = [
    'OPERATIVO',
    'MANTENIMIENTO',
    'FUERA_DE_SERVICIO',
    'DADO_DE_BAJA',
  ];

  constructor(private readonly database: DatabaseService) {}

  async getGeneralInventoryReport() {
    const [assetsByStatus, totalMaterials, lowStockMaterials] =
      await Promise.all([
        this.getAssetsByStatus(),
        this.getTotalMaterials(),
        this.getLowStockMaterials(),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      assets: {
        byStatus: assetsByStatus,
        total: assetsByStatus.reduce((sum, item) => sum + item.quantity, 0),
      },
      materials: {
        total: totalMaterials,
        lowStock: lowStockMaterials,
      },
      downloadReady: true,
    };
  }

  private async getAssetsByStatus() {
    const result = await this.database.query<AssetStatusRow>(`
      SELECT estado, COUNT(*)::text AS cantidad
      FROM activos
      GROUP BY estado
    `);

    const counts = new Map(
      result.rows.map((row) => [row.estado, Number(row.cantidad)]),
    );

    return this.assetStatuses.map((status) => ({
      status,
      label: this.formatStatus(status),
      quantity: counts.get(status) || 0,
    }));
  }

  private async getTotalMaterials() {
    const result = await this.database.query<CountRow>(`
      SELECT COUNT(*)::text AS total
      FROM materiales
    `);

    return Number(result.rows[0]?.total || 0);
  }

  private async getLowStockMaterials() {
    const result = await this.database.query<CountRow>(`
      SELECT COUNT(*)::text AS total
      FROM materiales
      WHERE "stockActual" <= "stockMinimo"
    `);

    return Number(result.rows[0]?.total || 0);
  }

  private formatStatus(status: string) {
    const labels: Record<string, string> = {
      OPERATIVO: 'Operativo',
      MANTENIMIENTO: 'Mantenimiento',
      FUERA_DE_SERVICIO: 'Fuera de servicio',
      DADO_DE_BAJA: 'Dado de baja',
    };

    return labels[status] || status;
  }
}
