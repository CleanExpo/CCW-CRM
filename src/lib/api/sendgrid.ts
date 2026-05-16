/**
 * SendGrid Integration API Client
 *
 * Handles all API calls to SendGrid email integration endpoints.
 */

import { apiClient } from './client';

// ============================================
// Types
// ============================================

export interface SendGridConnectionStatus {
  connected: boolean;
  can_send?: boolean;
  mode: 'demo' | 'live' | 'not_configured';
  from_email?: string | null;
  from_name?: string | null;
  environment_key_configured?: boolean;
  workspace_configured?: boolean;
  api_key_source?: 'cookie' | 'environment' | 'workspace' | null;
  api_verified?: boolean | null;
  browser_overrides_active?: boolean;
  browser_overrides_allowed?: boolean;
  webhooks_configured?: boolean;
  ai_auto_response_enabled?: boolean;
  ai_confidence_threshold?: number;
  template_id_invoice?: string | null;
  template_id_general?: string | null;
  message?: string;
}

/** api_key optional when SENDGRID_API_KEY is set on the server (shared testing). */
export interface SendGridConfigureRequest {
  api_key?: string;
  from_email?: string;
  from_name?: string;
  template_id_invoice?: string;
  template_id_general?: string;
  inbound_mailbox_email?: string;
}

export interface EmailConversation {
  id: string;
  thread_id: string;
  subject: string;
  customer_email: string;
  customer_name: string | null;
  status: 'open' | 'responded' | 'escalated' | 'closed';
  intent: string | null;
  message_count: number;
  first_message_at: string;
  last_message_at: string;
}

export interface EmailMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  to_email: string;
  subject: string;
  body_text: string;
  sent_at: string;
  was_ai_generated: boolean;
  delivery_status?: string;
  delivery_detail?: string;
}

export interface ConversationDetail {
  conversation: EmailConversation;
  messages: EmailMessage[];
}

export interface SendEmailRequest {
  to_email: string;
  subject: string;
  body_text: string;
  body_html?: string | null;
  conversation_id?: string;
}

export interface SendEmailResult {
  success: boolean;
  message_id: string;
  mode: 'demo' | 'live';
}

export interface SimulateEmailResult {
  success: boolean;
  mode: string;
  email_variation: number;
  conversation_id: string;
  intent: string;
  confidence: number;
  response_sent: boolean;
  preview: {
    from: string;
    subject: string;
    body: string;
  };
}

export interface ConversationsResponse {
  success: boolean;
  count: number;
  conversations: EmailConversation[];
}

export interface ConversationResponse {
  success: boolean;
  conversation: EmailConversation;
  messages: EmailMessage[];
}

// ============================================
// Connection Status
// ============================================

/**
 * Get current SendGrid connection status
 */
export async function getSendGridStatus(): Promise<SendGridConnectionStatus> {
  return apiClient.get<SendGridConnectionStatus>('/api/integrations/sendgrid/status');
}

export async function configureSendGrid(
  data: SendGridConfigureRequest
): Promise<SendGridConnectionStatus> {
  return apiClient.post<SendGridConnectionStatus>('/api/integrations/sendgrid/configure', data);
}

export async function disconnectSendGrid(): Promise<SendGridConnectionStatus> {
  return apiClient.post<SendGridConnectionStatus>('/api/integrations/sendgrid/disconnect', {});
}

// ============================================
// Email Sending
// ============================================

/**
 * Send an email via SendGrid
 * @param emailData - Email details (to, subject, body)
 */
export async function sendEmail(emailData: SendEmailRequest): Promise<SendEmailResult> {
  return apiClient.post<SendEmailResult>('/api/integrations/sendgrid/send', emailData);
}

// ============================================
// Conversations
// ============================================

/**
 * List email conversations with optional filtering
 * @param status - Filter by status (open|responded|escalated|closed)
 * @param limit - Maximum number of conversations to return
 */
export async function listConversations(
  status?: string,
  limit: number = 50
): Promise<ConversationsResponse> {
  const params = new URLSearchParams();
  if (status) params.append('status_filter', status);
  params.append('limit', limit.toString());

  return apiClient.get<ConversationsResponse>(
    `/api/integrations/sendgrid/conversations?${params.toString()}`
  );
}

/**
 * Get conversation details with all messages
 * @param conversationId - UUID of the conversation
 */
export async function getConversation(conversationId: string): Promise<ConversationResponse> {
  return apiClient.get<ConversationResponse>(
    `/api/integrations/sendgrid/conversations/${conversationId}`
  );
}

// ============================================
// Demo Mode
// ============================================

/**
 * Simulate an inbound email for testing (demo mode only)
 * @param emailNumber - Email variation number (1-5)
 */
export async function simulateInboundEmail(emailNumber: number = 1): Promise<SimulateEmailResult> {
  return apiClient.post<SimulateEmailResult>(
    `/api/integrations/sendgrid/demo/simulate-inbound?email_number=${emailNumber}`
  );
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if SendGrid is connected
 */
export async function isSendGridConnected(): Promise<boolean> {
  try {
    const status = await getSendGridStatus();
    return status.can_send ?? status.connected;
  } catch {
    return false;
  }
}

/**
 * Get status badge color based on conversation status
 */
export function getStatusColor(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'open':
      return 'secondary';
    case 'responded':
      return 'default';
    case 'escalated':
      return 'destructive';
    case 'closed':
      return 'outline';
    default:
      return 'secondary';
  }
}

/**
 * Get intent badge color
 */
export function getIntentColor(
  intent: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (intent) {
    case 'order_inquiry':
      return 'default';
    case 'stock_check':
      return 'secondary';
    case 'quote_request':
      return 'default';
    case 'complaint':
      return 'destructive';
    case 'support':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Format intent text for display
 */
export function formatIntent(intent: string | null): string {
  if (!intent) return 'Unknown';
  return intent
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
