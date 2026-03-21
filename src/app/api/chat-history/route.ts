import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { MAX_CHAT_HISTORY } from "@/lib/constants";
import { chatMessageSchema, type ChatMessage } from "@/schemas/chat.schema";

interface RawChatMessage extends Partial<ChatMessage> {
  type?: string;
  [key: string]: unknown;
}

function createSupabaseClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function getToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  return token || null;
}

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const supabase = createSupabaseClient(token);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("chat_history")
      .select("messages")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: true, messages: [], count: 0 });
      }
      logger.error("[chat-history GET] DB error:", error.code, error.message);
      return NextResponse.json({ error: "Failed to load chat history", details: error.message }, { status: 500 });
    }

    // Map legacy 'type: bot' payloads to 'role: assistant' algorithmically if they exist in DB history
    const rawMessages = data?.messages || [];
    const messages: ChatMessage[] = (rawMessages as RawChatMessage[])
      .map((m) => ({
        ...m,
        role: m.role || (m.type === "bot" ? "assistant" : m.type === "user" ? "user" : "error")
      } as ChatMessage))
      .slice(-MAX_CHAT_HISTORY);

    return NextResponse.json({ success: true, messages, count: messages.length });
  } catch (error: unknown) {
    logger.error("[chat-history GET] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const SaveMessageSchema = z.object({
  eventId: z.string().uuid(),
  message: chatMessageSchema,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SaveMessageSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid schema payload bounded", details: parsed.error.flatten() }, { status: 400 });
    }

    const { eventId, message } = parsed.data;
    const token = getToken(request);
    
    if (!token) {
      return NextResponse.json({ success: true, message: "Node saved locally (Unauthenticated)" });
    }

    const supabase = createSupabaseClient(token);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: true, message: "Node saved locally (Auth Failure)" });
    }

    const { data: existingData } = await supabase
      .from("chat_history")
      .select("id, messages")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .single();

    let messages = existingData?.messages ?? [];
    
    // Map existing legacy history types to pure roles during read/write cycles
    messages = (messages as RawChatMessage[]).map((m) => ({
      ...m,
      role: m.role || (m.type === "bot" ? "assistant" : m.type === "user" ? "user" : "error")
    } as ChatMessage));
    
    messages.push(message);

    if (messages.length > MAX_CHAT_HISTORY) {
      messages = messages.slice(-MAX_CHAT_HISTORY);
    }

    const now = new Date().toISOString();

    if (existingData?.id) {
      const { error: updateError } = await supabase
        .from("chat_history")
        .update({ messages, updated_at: now })
        .eq("id", existingData.id);

      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await supabase.from("chat_history").insert({
        user_id: user.id,
        event_id: eventId,
        messages,
        created_at: now,
        updated_at: now,
      });

      if (insertError) throw new Error(insertError.message);
    }

    return NextResponse.json({ success: true, message: "Messages saved to database", totalMessages: messages.length });
  } catch (error: unknown) {
    logger.error("[chat-history POST] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ error: "eventId constraint required" }, { status: 400 });

    const token = getToken(request);
    if (!token) return NextResponse.json({ success: true, message: "Taint not cleared (unauth)" });

    const supabase = createSupabaseClient(token);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return NextResponse.json({ success: true, message: "Taint not cleared (auth fail)" });

    const { error } = await supabase
      .from("chat_history")
      .update({ messages: [], updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, message: "Chat mathematical history decimated" });
  } catch (error: unknown) {
    logger.error("[chat-history DELETE] Extirpate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
