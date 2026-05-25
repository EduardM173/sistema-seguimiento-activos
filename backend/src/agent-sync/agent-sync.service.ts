/**
 * AgentSyncService
 * ================
 * Internal HTTP client that speaks to the agent-service (activos-agent).
 *
 * Two responsibilities:
 *  1. Fire-and-forget sync: push asset/material data to Neo4j after a
 *     create or update in PostgreSQL.  Failures are logged but never
 *     surfaced to the caller.
 *
 *  2. Delegated search: forward the full SearchAssetsDto / findAll
 *     parameters to the agent-service and return the semantic-ranked
 *     paginated result. Falls back to null on errors so the caller can
 *     use PostgreSQL instead.
 *
 * Service discovery:
 *   Uses the AGENT_SERVICE_URL environment variable first
 *   (e.g. http://agent:8000 in Docker Compose), falling back to
 *   Consul discovery via createServiceClient when the variable is absent.
 */
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { createServiceClient } from '@activos/config';
import { ActivosService } from '@activos/config';

export interface AssetSyncPayload {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  estado?: string;
  categoriaId?: string | null;
  categoriaNombre?: string | null;
  ubicacionId?: string | null;
  ubicacionNombre?: string | null;
  areaActualId?: string | null;
  areaNombre?: string | null;
  responsableActualId?: string | null;
  responsableNombre?: string | null;
  creadoEn?: string | null;
  actualizadoEn?: string | null;
}

export interface MaterialSyncPayload {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  unidad?: string;
  stockActual?: number;
  stockMinimo?: number;
  categoriaId?: string | null;
  categoriaNombre?: string | null;
  areaId?: string | null;
  areaNombre?: string | null;
  creadoEn?: string | null;
  actualizadoEn?: string | null;
}

export interface SemanticSearchResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AgentSyncService {
  private readonly logger = new Logger(AgentSyncService.name);

  // ── HTTP client resolution ─────────────────────────────────────────────

  private async getClient(timeoutMs = 10_000): Promise<AxiosInstance> {
    const directUrl = process.env.AGENT_SERVICE_URL;
    if (directUrl) {
      return axios.create({
        baseURL: directUrl,
        timeout: timeoutMs,
        headers: { 'X-Internal-Service': 'true' },
      });
    }
    // Consul-based discovery fallback
    return createServiceClient(ActivosService.AGENT, { timeout: timeoutMs });
  }

  // ── Sync (fire-and-forget) ─────────────────────────────────────────────

  syncAsset(payload: AssetSyncPayload): void {
    this.getClient()
      .then((client) => client.post('/embeddings/asset', payload))
      .then(() => this.logger.debug('[Sync] Asset synced: %s', payload.id))
      .catch((err) =>
        this.logger.warn('[Sync] Asset sync failed (%s): %s', payload.id, err?.message),
      );
  }

  syncMaterial(payload: MaterialSyncPayload): void {
    this.getClient()
      .then((client) => client.post('/embeddings/material', payload))
      .then(() => this.logger.debug('[Sync] Material synced: %s', payload.id))
      .catch((err) =>
        this.logger.warn('[Sync] Material sync failed (%s): %s', payload.id, err?.message),
      );
  }

  // ── Delegated search ───────────────────────────────────────────────────

  async searchAssets(
    params: Record<string, unknown>,
  ): Promise<SemanticSearchResult | null> {
    try {
      const client = await this.getClient(15_000);
      const { data } = await client.get<SemanticSearchResult>('/search/assets', { params });
      return data;
    } catch (err: any) {
      this.logger.warn('[Search] Asset search via agent failed: %s', err?.message);
      return null;
    }
  }

  async searchMaterials(
    params: Record<string, unknown>,
  ): Promise<SemanticSearchResult | null> {
    try {
      const client = await this.getClient(15_000);
      const { data } = await client.get<SemanticSearchResult>('/search/materials', { params });
      return data;
    } catch (err: any) {
      this.logger.warn('[Search] Material search via agent failed: %s', err?.message);
      return null;
    }
  }

  // ── Diff-sync helper ───────────────────────────────────────────────────

  /**
   * Given a list of Postgres IDs, returns the subset that is NOT yet
   * indexed in Neo4j.  Returns null when the agent-service is unavailable
   * (caller should fall back to syncing everything).
   */
  async getMissingIds(
    ids: string[],
    type: 'asset' | 'material',
  ): Promise<string[] | null> {
    if (ids.length === 0) return [];
    try {
      const client = await this.getClient(30_000);
      const { data } = await client.post<{ missing: string[]; total: number }>(
        '/embeddings/check-missing',
        { ids, type },
      );
      return data.missing;
    } catch (err: any) {
      this.logger.warn('[Sync] getMissingIds failed (%s): %s', type, err?.message);
      return null;
    }
  }
}
