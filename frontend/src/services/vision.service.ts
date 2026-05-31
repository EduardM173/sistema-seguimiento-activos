import { ActivosService } from '@activos/config/browser';
import { getAccessToken } from './auth.service';

export interface VisionPartial {
  nombre?: string;
  marca?: string;
  modelo?: string;
  numeroDeSerie?: string;
  unidad?: string;
  descripcion?: string;
  [key: string]: unknown;
}

export interface VisionAnalysisResult {
  partial: VisionPartial;
  existingAssetId?: string;
  existingAssetCode?: string;
  /** 0 – 1 confidence score */
  confidence: number;
  notes: string;
}

/**
 * Calls POST /<agent-service>/vision/analyze with a single image file.
 * Field name must be "image" as expected by the agent endpoint.
 */
export const visionService = {
  analyzeImage: async (file: File): Promise<VisionAnalysisResult> => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`/${ActivosService.AGENT}/vision/analyze`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let message = `Error ${response.status}`;
      try {
        const body = await response.json();
        message = body?.message || body?.error || body?.detail || message;
      } catch {
        // keep default message
      }
      throw new Error(message);
    }

    return response.json() as Promise<VisionAnalysisResult>;
  },
};
