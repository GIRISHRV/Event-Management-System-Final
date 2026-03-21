// Shared chat utilities for AI message handling
import { logger } from "@/lib/logger";

export interface ChatMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

/**
 * Extract JSON from AI responses that may contain markdown wrappers or extra text
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    // Strip markdown wrappers
    const clean = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    try {
      return JSON.parse(clean);
    } catch {
      // Find outermost braces
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(raw.substring(start, end + 1));
        } catch {
          logger.error("JSON parse failed", { raw: raw.substring(0, 200) });
          return null;
        }
      }
      return null;
    }
  }
}

/**
 * Format conversation history for Hugging Face API
 * Limits history to prevent context overflow
 */
export function formatHFHistory(
  messages: ChatMessage[],
  maxMessages: number = 6
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .slice(-maxMessages)
    .map((msg) => ({
      role: (msg.role === "model" ? "assistant" : msg.role) as "user" | "assistant",
      content: msg.content,
    }));
}


/**
 * Slice conversation history to prevent context overflow
 */
export function sliceHistory<T>(messages: T[], maxMessages: number): T[] {
  return messages.slice(-maxMessages);
}
