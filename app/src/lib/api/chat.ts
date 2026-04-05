/**
 * Chat API Client
 *
 * Handles all API calls to the AI chat assistant endpoints.
 */

import { apiClient } from "./client";

// ============================================
// Types
// ============================================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatMessageRequest {
  conversation_id: string;
  message: string;
  user_id?: string | null;
}

export interface ChatMessageResponse {
  conversation_id: string;
  message: string;
  tools_used: string[];
  error: string | null;
}

export interface NewConversationResponse {
  conversation_id: string;
  created_at: string;
}

export interface ConversationHistoryResponse {
  conversation_id: string;
  messages: ChatMessage[];
  total: number;
}

// ============================================
// Conversation Management
// ============================================

/**
 * Create a new chat conversation
 */
export async function createConversation(): Promise<NewConversationResponse> {
  return apiClient.post<NewConversationResponse>("/api/ai/chat/new");
}

/**
 * Send a message and get AI response
 * @param request - Message request with conversation ID and message
 */
export async function sendMessage(
  request: ChatMessageRequest
): Promise<ChatMessageResponse> {
  return apiClient.post<ChatMessageResponse>("/api/ai/chat/message", request);
}

/**
 * Get conversation history
 * @param conversationId - Conversation UUID
 * @param limit - Maximum number of messages to return
 */
export async function getConversationHistory(
  conversationId: string,
  limit: number = 50
): Promise<ConversationHistoryResponse> {
  return apiClient.get<ConversationHistoryResponse>(
    `/api/ai/chat/history/${conversationId}?limit=${limit}`
  );
}

/**
 * Delete a conversation and its history
 * @param conversationId - Conversation UUID
 */
export async function deleteConversation(conversationId: string): Promise<{
  message: string;
  messages_deleted: string;
}> {
  return apiClient.delete(`/api/ai/chat/history/${conversationId}`);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format message for display
 */
export function formatMessage(message: ChatMessage): {
  role: string;
  content: string;
  timestamp: string;
} {
  return {
    role: message.role === "user" ? "You" : "Assistant",
    content: message.content,
    timestamp: new Date(message.created_at).toLocaleTimeString(),
  };
}

/**
 * Check if conversation ID is valid UUID
 */
export function isValidConversationId(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
