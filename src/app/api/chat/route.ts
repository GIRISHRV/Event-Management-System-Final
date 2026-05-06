import { NextRequest, NextResponse } from "next/server";
import { callHuggingFace, isHuggingFaceAvailable } from "@/lib/huggingface";
import { DEFAULT_HF_MODEL } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { handleApiError, validationError } from "@/lib/error-handler";
import { chatApiRequestSchema, type ChatApiResponse } from "@/schemas/chat.schema";
import { createSupabaseServerClient } from "@/services/supabase/server";

function fallbackAssistantMessage(question: string) {
  return `I’m having trouble reaching the AI service right now, but I can still help with event basics.\n\nYou asked: ${question}\n\nTry asking about the schedule, venue, performers, or booking details.`;
}

export async function POST(req: NextRequest): Promise<NextResponse<ChatApiResponse | { error: string; details?: unknown }>> {
  try {
    const body = await req.json();

    const parsed = chatApiRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const { message: question, history, eventId } = parsed.data;

    logger.info(`[Chat API] message length=${question.length}, history depth=${history.length}`);

    // Fetch event context server-side to prevent client prompt injection
    let eventContext = "No specific event context provided. Answer generally about the event management platform.";

    if (eventId) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("events")
        .select(`
          event_name, event_description, start_date, start_time, end_date, end_time,
          venue_name, venue_address, venue_city, max_attendees, budget,
          tags, faqs
        `)
        .eq("id", eventId)
        .single();

      if (!error && data) {
        eventContext = `
Event: ${data.event_name}
Date: ${data.start_date} ${data.start_time} to ${data.end_date} ${data.end_time}
Venue: ${data.venue_name}, ${data.venue_address}, ${data.venue_city}
Description: ${data.event_description || "N/A"}
Budget: ${data.budget ? "₹" + data.budget : "N/A"}
Capacity: ${data.max_attendees || "Unlimited"}
Tags: ${(data.tags || []).join(", ") || "None"}
FAQs: ${JSON.stringify(data.faqs || [])}`;
      }
    }

    const hfAvailable = await isHuggingFaceAvailable();
    if (!hfAvailable) {
      return NextResponse.json({
        success: true,
        response: {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fallbackAssistantMessage(question),
          source: "local",
          responseTime: 0,
          timestamp: new Date().toISOString(),
        },
      } as ChatApiResponse);
    }

    const systemPrompt = `You are a helpful AI assistant for EventMS, an event management platform.
Only provide information about events and event planning. Keep responses helpful and friendly.

Event Information:
${eventContext}

Instructions:
1. Focus on helping with event planning and management.
2. If asked about topics unrelated to events, politely redirect to event-related topics.
3. If specific information is not available, let the user know clearly.`;

    const hfMessages = [
      ...history.map((msg) => ({
        role: (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: question },
    ];

    const startTime = Date.now();
    const answer = await callHuggingFace(hfMessages, systemPrompt, process.env.HF_MODEL || DEFAULT_HF_MODEL);
    const latency = Date.now() - startTime;

    logger.info(`[Chat API] response in ${latency}ms`);

    return NextResponse.json({
      success: true,
      response: {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        source: "AI",
        responseTime: latency,
        timestamp: new Date().toISOString(),
      },
    } as ChatApiResponse);
  } catch (error: unknown) {
    logger.warn("[Chat API] Falling back after error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({
      success: true,
      response: {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fallbackAssistantMessage("your question"),
        source: "local",
        responseTime: 0,
        timestamp: new Date().toISOString(),
      },
    } as ChatApiResponse);
  }
}
