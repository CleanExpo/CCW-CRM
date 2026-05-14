import { apiClient } from './client';

export type UpcomingIntegrationSecretsStatus = {
  google_ai: { configured: boolean };
  anthropic: { configured: boolean };
  heygen: { configured: boolean };
  ap2: { configured: boolean };
};

export type UpcomingIntegrationSecretsUpdate = {
  google_ai_api_key?: string | null;
  anthropic_api_key?: string | null;
  heygen_api_key?: string | null;
  ap2_client_secret?: string | null;
};

export async function getUpcomingIntegrationSecrets(): Promise<UpcomingIntegrationSecretsStatus> {
  return apiClient.get<UpcomingIntegrationSecretsStatus>('/api/integrations/upcoming-secrets');
}

export async function saveUpcomingIntegrationSecrets(
  body: UpcomingIntegrationSecretsUpdate
): Promise<UpcomingIntegrationSecretsStatus> {
  return apiClient.put<UpcomingIntegrationSecretsStatus>('/api/integrations/upcoming-secrets', body);
}
