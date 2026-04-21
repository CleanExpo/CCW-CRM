/**
 * AI Chat API client
 */

import { apiClient } from "./client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface SendMessageRequest {
  conversation_id: string;
  message: string;
  user_id?: string;
}

export interface SendMessageResponse {
  conversation_id: string;
  message: string;
  tools_used: string[];
  error?: string;
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

/**
 * Create a new conversation
 */
export async function createNewConversation(): Promise<NewConversationResponse> {
  return apiClient.post<NewConversationResponse>("/api/ai/chat/new", {});
}

/**
 * Send a message and get a response
 */
export async function sendMessage(
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  return apiClient.post<SendMessageResponse>("/api/ai/chat/message", request);
}

/**
 * Stream a message response (Server-Sent Events)
 */
export async function streamMessage(
  request: SendMessageRequest,
  onChunk: (chunk: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch("/api/ai/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("Response body is not readable");
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        onComplete?.();
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.substring(6);

          if (data === "[DONE]") {
            onComplete?.();
            return;
          }

          if (data.startsWith("[ERROR]")) {
            const error = data.substring(8);
            onError?.(error);
            return;
          }

          onChunk(data);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    onError?.(errorMessage);
  }
}

/**
 * Get conversation history
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
 * Delete a conversation
 */
export async function deleteConversation(
  conversationId: string
): Promise<{ message: string; messages_deleted: string }> {
  return apiClient.delete(`/api/ai/chat/history/${conversationId}`);
}
