import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { ChatHistoryMessage } from "@/lib/supabase-types";

// Create a Supabase client with the user's session token
function createSupabaseClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

// GET: Load chat history for an event
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      );
    }

    // Get session from Authorization header
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      console.log("[chat-history GET] No token provided, returning empty history");
      return NextResponse.json({
        success: true,
        messages: [],
        count: 0,
      });
    }

    const supabase = createSupabaseClient(token);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log("[chat-history GET] Auth failed:", authError?.message);
      return NextResponse.json({
        success: true,
        messages: [],
        count: 0,
      });
    }

    console.log("[chat-history GET] Loading history for event:", eventId, "user:", user.id);

    // Get chat history
    const { data, error } = await supabase
      .from("chat_history")
      .select("messages")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows found - this is OK, return empty
        console.log("[chat-history GET] No history found (first time)");
        return NextResponse.json({
          success: true,
          messages: [],
          count: 0,
        });
      }
      console.error("[chat-history GET] Error loading history:", error.code, error.message);
      return NextResponse.json(
        { 
          error: "Failed to load chat history",
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    const messages: ChatHistoryMessage[] = data?.messages || [];
    const returnMessages = messages.slice(-20); // Keep last 20

    console.log("[chat-history GET] Loaded", returnMessages.length, "messages");

    return NextResponse.json({
      success: true,
      messages: returnMessages,
      count: returnMessages.length,
    });
  } catch (error) {
    console.error("[chat-history GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Save chat message to history
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, message } = body;

    if (!eventId || !message) {
      return NextResponse.json(
        { error: "eventId and message are required" },
        { status: 400 }
      );
    }

    // Get session from Authorization header
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      console.log("[chat-history POST] No token provided, skipping save");
      return NextResponse.json({
        success: true,
        message: "Message not saved (not authenticated)",
      });
    }

    const supabase = createSupabaseClient(token);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log("[chat-history POST] Auth failed:", authError?.message);
      return NextResponse.json({
        success: true,
        message: "Message not saved (auth failed)",
      });
    }

    console.log("[chat-history POST] Saving message for event:", eventId, "user:", user.id);

    // Get existing chat history
    const { data: existingData } = await supabase
      .from("chat_history")
      .select("id, messages")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .single();

    let messages: ChatHistoryMessage[] = existingData?.messages || [];
    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    messages.push(messageWithTimestamp);

    // Keep only last 20 messages
    if (messages.length > 20) {
      messages = messages.slice(-20);
      console.log("[chat-history POST] Pruned to 20 messages");
    }

    if (existingData?.id) {
      // Update existing record
      console.log("[chat-history POST] Updating existing record");
      const { error: updateError } = await supabase
        .from("chat_history")
        .update({
          messages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingData.id);

      if (updateError) {
        console.error("[chat-history POST] Update error:", updateError.code, updateError.message);
        return NextResponse.json(
          { 
            error: "Failed to save message",
            details: updateError.message,
            code: updateError.code
          },
          { status: 500 }
        );
      }
    } else {
      // Create new record
      console.log("[chat-history POST] Creating new record");
      const { error: insertError } = await supabase
        .from("chat_history")
        .insert({
          user_id: user.id,
          event_id: eventId,
          messages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("[chat-history POST] Insert error:", insertError.code, insertError.message);
        return NextResponse.json(
          { 
            error: "Failed to save message",
            details: insertError.message,
            code: insertError.code
          },
          { status: 500 }
        );
      }
    }

    console.log("[chat-history POST] Message saved, total messages:", messages.length);

    return NextResponse.json({
      success: true,
      message: "Message saved",
      totalMessages: messages.length,
    });
  } catch (error) {
    console.error("[chat-history POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Clear chat history for an event
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      );
    }

    // Get session from Authorization header
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      console.log("[chat-history DELETE] No token provided");
      return NextResponse.json({
        success: true,
        message: "History not cleared (not authenticated)",
      });
    }

    const supabase = createSupabaseClient(token);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log("[chat-history DELETE] Auth failed:", authError?.message);
      return NextResponse.json({
        success: true,
        message: "History not cleared (auth failed)",
      });
    }

    console.log("[chat-history DELETE] Clearing history for event:", eventId);

    // Reset messages to empty array
    const { error } = await supabase
      .from("chat_history")
      .update({
        messages: [],
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (error) {
      console.error("[chat-history DELETE] Error clearing history:", error.code, error.message);
      return NextResponse.json(
        { 
          error: "Failed to clear history",
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    console.log("[chat-history DELETE] History cleared successfully");

    return NextResponse.json({
      success: true,
      message: "Chat history cleared",
    });
  } catch (error) {
    console.error("[chat-history DELETE] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
