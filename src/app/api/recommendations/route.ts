import { callOllama, type OllamaMessage } from "@/lib/ollama";
import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

interface RecommendationRequest {
  type?: "chat-suggestions" | "stats-insight" | "event-recommendations";
  conversationHistory?: Array<{
    role: "user" | "model";
    content: string;
  }>;
  eventContext?: string;
  stats?: {
    totalCreated: number;
    totalBooked: number;
    upcoming: number;
    attended: number;
    createdThisMonth: number;
  };
  userId?: string;
  interests?: string[];
  locations?: string[];
  bookedEventIds?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendationRequest = await request.json();
    const requestType = body.type || "chat-suggestions";

    // Handle stats insight request
    if (requestType === "stats-insight") {
      return handleStatsInsight(body.stats);
    }

    // Handle event recommendations request
    if (requestType === "event-recommendations") {
      return handleEventRecommendations(
        body.userId,
        body.interests,
        body.locations,
        body.bookedEventIds
      );
    }

    // Original chat suggestions logic
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

// Generate AI insight for stats
async function handleStatsInsight(
  stats?: RecommendationRequest["stats"]
): Promise<NextResponse> {
  if (!stats) {
    return NextResponse.json({ insight: "Start creating or attending events!" });
  }

  // Build fallback insight first
  let insight = "Keep exploring events!";
  if (stats.upcoming > 0) {
    insight = `You have ${stats.upcoming} exciting event${stats.upcoming > 1 ? "s" : ""} coming up!`;
  } else if (stats.createdThisMonth > 0) {
    insight = `Great job creating ${stats.createdThisMonth} event${stats.createdThisMonth > 1 ? "s" : ""} this month!`;
  } else if (stats.attended > 0) {
    insight = `You've attended ${stats.attended} event${stats.attended > 1 ? "s" : ""}. Discover more!`;
  }

  try {
    const systemPrompt = `You are a helpful event assistant. Generate a single short, encouraging insight (max 20 words) based on the user's event statistics. Be friendly and motivating.`;

    const messages: OllamaMessage[] = [
      {
        role: "user",
        content: `My event stats: ${stats.totalCreated} events created, ${stats.totalBooked} events booked, ${stats.upcoming} upcoming, ${stats.attended} attended, ${stats.createdThisMonth} created this month. Give me a brief encouraging insight.`,
      },
    ];

    const response = await callOllama(
      messages,
      systemPrompt,
      process.env.OLLAMA_MODEL || "llama3.1:8b"
    );

    // Clean up the response
    insight = response
      .replace(/^["']|["']$/g, "")
      .split("\n")[0]
      .trim()
      .slice(0, 150);

    return NextResponse.json({ insight });
  } catch {
    // Silently use fallback - Ollama might not be running
    return NextResponse.json({ insight });
  }
}

// Get event recommendations based on user interests
async function handleEventRecommendations(
  userId?: string,
  interests?: string[],
  locations?: string[],
  bookedEventIds?: string[]
): Promise<NextResponse> {
  if (!userId) {
    return NextResponse.json({ recommendations: [] });
  }

  try {
    // Fetch public events not already booked by user
    let query = supabase
      .from("events")
      .select("*")
      .eq("visibility_type", "public")
      .eq("event_status", "upcoming")
      .gte("start_date", new Date().toISOString().split("T")[0])
      .order("start_date", { ascending: true })
      .limit(10);

    // Exclude already booked events
    if (bookedEventIds && bookedEventIds.length > 0) {
      query = query.not("id", "in", `(${bookedEventIds.join(",")})`);
    }

    const { data: events, error } = await query;

    if (error) throw error;

    // If we have interests or locations, try to use AI to rank them
    if ((interests?.length || locations?.length) && events && events.length > 0) {
      try {
        const systemPrompt = `You are an event recommendation system. Given user interests and available events, return the IDs of the top 3 most relevant events as a JSON array. Only return the JSON array, nothing else.`;

        const messages: OllamaMessage[] = [
          {
            role: "user",
            content: `User interests: ${interests?.join(", ") || "none"}
User preferred locations: ${locations?.join(", ") || "any"}

Available events:
${events.map((e) => `ID: ${e.id}, Name: ${e.event_name}, Location: ${e.venue_city || "TBD"}, Tags: ${(e.tags || []).join(", ")}`).join("\n")}

Return only the top 3 event IDs as JSON array like: ["id1", "id2", "id3"]`,
          },
        ];

        const response = await callOllama(
          messages,
          systemPrompt,
          process.env.OLLAMA_MODEL || "llama3.1:8b"
        );

        const idsMatch = response.match(/\[[\s\S]*?\]/);
        if (idsMatch) {
          const rankedIds = JSON.parse(idsMatch[0]) as string[];
          const rankedEvents = rankedIds
            .map((id) => events.find((e) => e.id === id))
            .filter(Boolean);

          if (rankedEvents.length > 0) {
            return NextResponse.json({ recommendations: rankedEvents });
          }
        }
      } catch {
        // Silently fall back - Ollama might not be running
      }
    }

    // Fallback: return first 3 events
    return NextResponse.json({ recommendations: events?.slice(0, 3) || [] });
  } catch (error) {
    console.error("[recommendations API] Event recommendations error:", error);
    return NextResponse.json({ recommendations: [] });
  }
}
