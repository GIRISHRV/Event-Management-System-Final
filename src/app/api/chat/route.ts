import { NextRequest, NextResponse } from "next/server";
import { callOllama, isOllamaAvailable } from "@/lib/ollama";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { question, eventContext, conversationHistory, useWebSearch } = await req.json();

    console.log("\n      [chat API] Chat request received");
    console.log("      [chat API] Use web search:", useWebSearch ? "ENABLED" : "DISABLED");
    console.log("      [chat API] Event context length:", eventContext?.length || 0);
    console.log("      [chat API] Conversation history length:", conversationHistory?.length || 0);

    if (!question || !eventContext) {
      console.error("Missing required fields - question:", !!question, "eventContext:", !!eventContext);
      return NextResponse.json(
        { error: "Missing question or event context" },
        { status: 400 }
      );
    }

    // If web search is requested, use Gemini with Google Search
    if (useWebSearch) {
      console.log("      [chat API] Using Gemini AI with Google Search");
      
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("      [chat API] WARNING - Gemini API key not configured");
        return NextResponse.json(
          { error: "Web search not configured. Please add GEMINI_API_KEY to environment variables." },
          { status: 503 }
        );
      }

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        
        const systemInstruction = `You are a helpful assistant for an event. You have access to Google Search to find up-to-date information.

Event Information:
${eventContext}

INSTRUCTIONS:
1. Use Google Search to find current information about lineups, performers, news, or other external details.
2. Combine search results with the Event Information provided above.
3. Prioritize search results for time-sensitive information (like lineups, announcements).
4. Provide concise, helpful answers.
5. If you find information via search, present it naturally without repeatedly saying "according to search results".`;

        // Note: Google Search grounding requires specific API access and model support
        // Using gemini-3-flash-preview which supports Google Search grounding
        const model = genAI.getGenerativeModel({
          model: "gemini-3-flash-preview",
          systemInstruction,
          tools: [{ googleSearchRetrieval: {} }],
        });

        // Build conversation history for Gemini
        interface GeminiMessage {
          role: "user" | "model";
          parts: { text: string }[];
        }
        const geminiHistory: GeminiMessage[] = [];
        if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
          conversationHistory.slice(-4).forEach((msg: { role: "user" | "model"; content: string }) => {
            geminiHistory.push({
              role: msg.role === "model" ? "model" : "user",
              parts: [{ text: msg.content }],
            });
          });
        }

        // Gemini requires the first message in history to be from 'user'
        while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
          geminiHistory.shift();
        }

        const chat = model.startChat({
          history: geminiHistory,
        });

        console.log("      [chat API] Sending to Gemini with search capability");
        const result = await chat.sendMessage(question);
        const response = await result.response;
        const answer = response.text();

        console.log("      [chat API] Gemini response received");
        console.log("      [chat API] Answer length:", answer.length);

        return NextResponse.json({
          answer,
          source: "web",
        });
      } catch (error: any) {
        console.error("      [chat API] Gemini error:", error);
        
        // Check for rate limit error (429 or RESOURCE_EXHAUSTED)
        if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
          console.warn("      [chat API] Gemini rate limit reached");
          return NextResponse.json(
            { error: "Gemini API rate limit reached. Please try again later." },
            { status: 429 }
          );
        }

        // Fall back to Ollama for other errors
        console.log("      [chat API] Falling back to Ollama");
      }
    }

    // Use Ollama for local-only queries
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

    const systemPrompt = `You are a helpful assistant that answers questions about a specific event.
IMPORTANT: Only answer based on the event information provided below. Do not hallucinate or use outside knowledge.

Event Information:
${eventContext}

INSTRUCTIONS:
1. Answer ONLY based on the Event Information above.
2. If the answer is not in the Event Information, politely explain that the information is not available.
3. Keep answers practical and relevant to the event.`;

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

    const answer = await callOllama(ollamaMessages, systemPrompt, process.env.OLLAMA_MODEL || "llama3.1:8b");

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
