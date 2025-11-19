import { callOllama, type OllamaMessage } from "@/lib/ollama";
import { NextRequest, NextResponse } from "next/server";

interface RecommendationRequest {
  conversationHistory: Array<{
    role: 'user' | 'model';
    content: string;
  }>;
  eventContext: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendationRequest = await request.json();
    const { conversationHistory, eventContext } = body;

    if (!conversationHistory || !eventContext) {
      return NextResponse.json(
        { error: "conversationHistory and eventContext are required" },
        { status: 400 }
      );
    }

    console.log("[recommendations API] Generating suggestions based on conversation");

    // Build a prompt that asks for follow-up question suggestions
    const systemPrompt = `You are a helpful event assistant. Based on the conversation history and event details below, suggest 3 concise follow-up questions that the user might want to ask. The questions should be natural and relevant to the event and conversation context.

EVENT DETAILS:
${eventContext}

Return ONLY a JSON object with this exact format, no other text:
{
  "suggestions": [
    "Question 1?",
    "Question 2?",
    "Question 3?"
  ]
}`;

    // Format conversation history for Ollama (convert 'model' to 'assistant')
    const messages: OllamaMessage[] = conversationHistory.slice(-4).map(msg => ({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.content,
    }));

    // Add a message asking for suggestions
    messages.push({
      role: 'user',
      content: 'Based on this conversation, what are 3 good follow-up questions I could ask about this event?',
    });

    console.log("[recommendations API] Calling Llama3.1 to generate suggestions");
    console.log("[recommendations API] Conversation context messages:", messages.length);

    const response = await callOllama(
      messages,
      systemPrompt,
      process.env.OLLAMA_MODEL || "llama3.1:8b"
    );

    console.log("[recommendations API] Llama3.1 response received");
    console.log("[recommendations API] Response:", response.substring(0, 200));

    // Parse the response to extract JSON
    let suggestions: string[] = [];
    try {
      const jsonMatch = response.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions || [];
      }
    } catch (parseError) {
      console.error("[recommendations API] Error parsing suggestions JSON:", parseError);
      // Fallback: extract questions from response
      const lines = response.split('\n').filter(line => line.includes('?'));
      suggestions = lines.slice(0, 3).map(line => line.replace(/^[\d\.\s-]*/, '').trim());
    }

    // Ensure we have valid suggestions
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      console.warn("[recommendations API] No valid suggestions generated, using defaults");
      suggestions = [
        "What's the schedule for this event?",
        "Who are the main performers?",
        "Where is the event located?",
      ];
    }

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, 3), // Ensure max 3 suggestions
    });
  } catch (error) {
    console.error("[recommendations API] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate recommendations",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
