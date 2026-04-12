/**
 * HeyGen API client — CCW video generation integration.
 * Wraps the FastAPI backend at /api/integrations/heygen/*.
 */

import { apiClient } from '@/lib/api/client';

export interface GenerateVideoRequest {
  script: string;
  avatar_id?: string;
  voice_id?: string;
  title?: string;
  width?: number;
  height?: number;
}

export interface GenerateVideoResponse {
  success: boolean;
  video_id: string;
  status: string;
  title: string | null;
  mode: string;
}

export interface VideoStatusResponse {
  success: boolean;
  video_id: string;
  status: 'pending' | 'processing' | 'waiting' | 'completed' | 'failed';
  video_url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  error: string | null;
  estimated_cost_usd: number | null;
  mode: string;
}

export interface AvatarListResponse {
  success: boolean;
  avatars: Array<{
    avatar_id: string;
    avatar_name?: string;
    gender?: string;
    preview_image_url?: string;
  }>;
  mode: string;
}

export interface VoiceListResponse {
  success: boolean;
  voices: Array<{
    voice_id: string;
    name: string;
    language?: string;
    gender?: string;
  }>;
  mode: string;
}

export interface QuotaResponse {
  success: boolean;
  remaining_quota: number | null;
  unit: string | null;
  mode: string;
}

export const heygenApi = {
  /**
   * Submit async video generation. Returns video_id for polling.
   */
  generateVideo(request: GenerateVideoRequest): Promise<GenerateVideoResponse> {
    return apiClient.post<GenerateVideoResponse>('/api/integrations/heygen/generate', request);
  },

  /**
   * Poll for video generation status by video_id.
   */
  getVideoStatus(videoId: string): Promise<VideoStatusResponse> {
    return apiClient.get<VideoStatusResponse>(
      `/api/integrations/heygen/status/${encodeURIComponent(videoId)}`
    );
  },

  /**
   * List available HeyGen avatars.
   */
  listAvatars(): Promise<AvatarListResponse> {
    return apiClient.get<AvatarListResponse>('/api/integrations/heygen/avatars');
  },

  /**
   * List available HeyGen voices.
   */
  listVoices(): Promise<VoiceListResponse> {
    return apiClient.get<VoiceListResponse>('/api/integrations/heygen/voices');
  },

  /**
   * Get remaining HeyGen API quota.
   */
  getQuota(): Promise<QuotaResponse> {
    return apiClient.get<QuotaResponse>('/api/integrations/heygen/quota');
  },
};
