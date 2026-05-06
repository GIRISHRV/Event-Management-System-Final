/**
 * Hugging Face Inference API client utilities.
 * Provides typed wrappers around the HF router API (OpenAI-compatible).
 */
import { DEFAULT_HF_MODEL, HF_TIMEOUT_MS } from "./constants";
import { logger } from "./logger";

export interface HFMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface HFChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Sends a chat request to Hugging Face's inference router.
 * Uses OpenAI-compatible API format.
 * Throws on timeout or network error.
 */
export async function callHuggingFace(
  messages: HFMessage[],
  systemPrompt?: string,
  model: string = (process.env.HF_MODEL || DEFAULT_HF_MODEL).trim()
): Promise<string> {
  const hfToken = process.env.HF_TOKEN?.trim();
  
  if (!hfToken) {
    throw new Error("HF_TOKEN environment variable is not set");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);

  try {
    const chatMessages: HFMessage[] = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${hfToken}`,
      },
      body: JSON.stringify({
        model,
        messages: chatMessages,
        stream: false,
        max_tokens: 2048,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[HuggingFace] HTTP ${response.status}: ${errorText}`);
      throw new Error(`Hugging Face returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as HFChatCompletionResponse;
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error("Hugging Face returned no choices");
    }

    return data.choices[0].message.content;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Hugging Face request timed out after ${HF_TIMEOUT_MS / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Checks whether the Hugging Face service is reachable and token is valid.
 * Returns false on any network error instead of throwing.
 */
export async function isHuggingFaceAvailable(): Promise<boolean> {
  const hfToken = process.env.HF_TOKEN?.trim();
  
  if (!hfToken) {
    logger.warn("[HuggingFace] HF_TOKEN not set");
    return false;
  }

  try {
    const response = await fetch("https://router.huggingface.co/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    logger.warn("[HuggingFace] Availability check failed:", error);
    return false;
  }
}
