import { api } from "@/lib/api-client";
import { type ChatMessage, type ChatApiRequest, type ChatApiResponse } from "@/schemas/chat.schema";
import { logger } from "@/lib/logger";

interface ChatHistoryResponse {
  success: boolean;
  messages: ChatMessage[];
}

export const chatService = {
  /**
   * Dispatches a strictly typed LLM query through the Edge API boundary.
   */
  async sendMessage(request: ChatApiRequest, token?: string): Promise<ChatApiResponse> {
    try {
      const response = await api.post<ChatApiResponse>("/api/chat", request, { token });
      if (!response.success && response.error) {
        throw new Error(response.error);
      }
      return response;
    } catch (error) {
      logger.error("[chatService.sendMessage] Failed to send message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error communicating with AI Edge."
      };
    }
  },

  /**
   * Save a chat message to the database history.
   */
  async saveMessageToHistory(eventId: string, message: ChatMessage, token?: string): Promise<boolean> {
    try {
      const response = await api.post<{ success: boolean; error?: string }>("/api/chat-history", {
        eventId,
        message,
      }, { token });
      return response.success;
    } catch (error) {
      logger.error("[chatService.saveMessageToHistory] Failed to commit state:", error);
      return false;
    }
  },

  /**
   * Extracts historical sequence for hydration.
   */
  async getChatHistory(eventId: string, token?: string): Promise<ChatMessage[]> {
    try {
      const response = await api.get<ChatHistoryResponse>(`/api/chat-history?eventId=${eventId}`, { token });
      return response.messages || [];
    } catch (error) {
      logger.error("[chatService.getChatHistory] Hydration failed:", error);
      return [];
    }
  },

  /**
   * Clears the historical state.
   */
  async clearChatHistory(eventId: string, token?: string): Promise<boolean> {
    try {
      const response = await api.delete<{ success: boolean; error?: string }>(`/api/chat-history?eventId=${eventId}`, { token });
      return response.success;
    } catch (error) {
      logger.error("[chatService.clearChatHistory] Clearance failed:", error);
      return false;
    }
  }
};
