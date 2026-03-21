"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { type ChatMessage } from "@/schemas/chat.schema";
import { useAuth } from "@/context/AuthContext";
import { chatService } from "@/services/chat.service";

export function useEventChat(eventId: string | null | undefined, eventName: string = "Platform") {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);

  const { data: historyData = [], mutate: mutateHistory } = useSWR(
    accessToken && eventId ? ["chat-history", eventId] : null,
    async () => chatService.getChatHistory(eventId!, accessToken!),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const messages = useMemo(() => {
    const welcomeMsg: ChatMessage = {
      id: "welcome-system-node",
      role: "assistant",
      content: `Hi! I'm your assistant for **${eventName}**. Ask me anything about this event.`,
      source: "local",
      timestamp: new Date().toISOString(),
    };

    const combined = [...historyData, ...localMessages];
    const unique = combined.filter((msg, index, self) =>
      index === self.findIndex((m) => m.id === msg.id)
    );

    return [welcomeMsg, ...unique];
  }, [historyData, localMessages, eventName]);

  const saveChatMessage = async (message: ChatMessage) => {
    if (!accessToken || !eventId) return;
    await chatService.saveMessageToHistory(eventId, message, accessToken);
    mutateHistory();
  };

  const clearChatHistory = async () => {
    setLocalMessages([]);
    if (!accessToken || !eventId) return;
    await chatService.clearChatHistory(eventId, accessToken);
    mutateHistory([], false);
  };

  const sendMessage = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setLocalMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (session) saveChatMessage(userMessage);

    try {
      const conversationHistory = messages
        .filter((m) => m.role !== "error" && m.id !== "welcome-system-node")
        .slice(-6);

      const response = await chatService.sendMessage(
        {
          history: conversationHistory,
          message: text,
          eventId: eventId || null,
          useWebSearch: false,
        },
        accessToken
      );

      if (!response.success || !response.response) {
        throw new Error(response.error);
      }

      setLocalMessages((prev) => [...prev, response.response!]);
      if (session) saveChatMessage(response.response!);

    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        String(error.message).includes("429")
      ) {
        setRateLimitUntil(Date.now() + 15 * 60 * 1000);
        setLocalMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "error",
            content: "**Rate limit reached.** Please wait 15 minutes before sending another message.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        setLocalMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "error",
            content: "Something went wrong. Please try again.",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    rateLimitUntil,
    setRateLimitUntil,
    sendMessage,
    clearChatHistory,
  };
}
