// Ollama API client for self-hosted LLM
// Make sure Ollama is running: ollama serve
// Pull a model: ollama pull mistral (or llama2, neural-chat, etc.)

export interface OllamaMessage {
  role: "user" | "assistant";
  content: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
}

export async function callOllama(
  messages: OllamaMessage[],
  systemPrompt: string,
  model: string = "mistral"
): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

  try {
    const payload = {
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
      stream: false,
      temperature: 0.7,
    };

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as OllamaResponse;

    return data.message.content;
  } catch (error) {
    throw error;
  }
}

// Check if Ollama is available
export async function isOllamaAvailable(): Promise<boolean> {
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Get available models
export async function getAvailableModels(): Promise<string[]> {
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) return [];

    const data = await response.json() as { models?: Array<{ name: string }> };
    return data.models?.map((m) => m.name) || [];
  } catch {
    return [];
  }
}
