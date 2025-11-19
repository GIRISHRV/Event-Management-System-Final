import { NextRequest, NextResponse } from "next/server";
import { callOllama, isOllamaAvailable } from "@/lib/ollama";

export async function POST(req: NextRequest) {
  try {
    const { question, eventContext, webContext, conversationHistory } = await req.json();

    console.log("\n      [chat API] Chat request received");
    console.log("      [chat API] Web search was", webContext ? "ENABLED" : "DISABLED");
    if (webContext) {
      console.log("      [chat API] Web context length:", webContext.length);
      console.log("      [chat API] Web context preview:", webContext.substring(0, 150));
    } else {
      console.log("      [chat API] No web context provided");
    }
    console.log("      [chat API] Event context length:", eventContext?.length || 0);
    console.log("      [chat API] Conversation history length:", conversationHistory?.length || 0);

    if (!question || !eventContext) {
      console.error("Missing required fields - question:", !!question, "eventContext:", !!eventContext);
      return NextResponse.json(
        { error: "Missing question or event context" },
        { status: 400 }
      );
    }

    // Check if Ollama is available
    const ollamaAvailable = await isOllamaAvailable();
    if (!ollamaAvailable) {
      console.error("Ollama not available at configured URL");
      return NextResponse.json(
        { error: "AI service not available. Please ensure Ollama is running." },
        { status: 503 }
      );
    }

    console.log("      [chat API] Ollama is available");
    console.log("      [chat API] Building system prompt");
    if (webContext) {
      console.log("      [chat API] Including web context in system prompt");
    }

    let systemPrompt = `You are a helpful assistant that answers questions about a specific event.
IMPORTANT: Only answer based on the event information provided. Do not generate test cases, code examples, or unrelated content.
Provide helpful, well-formatted answers using bullet points and clear structure when appropriate.
Keep answers practical and relevant to the event. Be concise.

Event Information:
${eventContext}

Answer ONLY about this event. If a question is not about the event, politely decline and refocus on event-related topics.`;

    // If web context is provided, add it to the prompt and allow using it
    if (webContext) {
      systemPrompt += `\n\nWhen answering questions about advice (clothing, preparation, etc.), use the following context:
- Consider the event type, date, and location mentioned above
- Use web search results below to provide practical, relevant suggestions
- Tailor recommendations to match the event's nature, season, and theme

Web Search Results:
${webContext}

Answer with advice that's specific to this event based on both the event details and web search information.`;
    } else {
      // If no web context, only use event data
      systemPrompt += `\n\nIf a question cannot be answered using the event data above, politely explain that the information is not available.`;
    }

    // Convert conversation history to Ollama format
    interface OllamaMessage {
      role: "user" | "assistant";
      content: string;
    }

    const ollamaMessages: OllamaMessage[] = [];

    // Add previous conversation history
    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: { role: "user" | "model"; content: string }) => {
        ollamaMessages.push({
          role: msg.role === "model" ? "assistant" : "user",
          content: msg.content,
        });
      });
    }

    // Add current question
    ollamaMessages.push({
      role: "user",
      content: question,
    });

    console.log("      [chat API] Sending to Llama3.1");
    console.log("      [chat API] Number of messages:", ollamaMessages.length);
    console.log("      [chat API] System prompt includes web context:", webContext ? "YES" : "NO");

    const answer = await callOllama(ollamaMessages, systemPrompt, process.env.OLLAMA_MODEL || "mistral");

    console.log("      [chat API] Llama3.1 response received");
    console.log("      [chat API] Answer length:", answer.length);
    console.log("      [chat API] Answer preview:", answer.substring(0, 150));

    return NextResponse.json({
      answer,
      source: "AI",
    });
  } catch (error) {
    console.error("      [chat API] ERROR:", error);
    console.error("      [chat API] Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
