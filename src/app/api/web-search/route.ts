import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      console.error("  [web-search API] ERROR - Missing search query");
      return NextResponse.json(
        { error: "Missing search query" },
        { status: 400 }
      );
    }

    console.log("\n    [web-search API] Received search query:", query);

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("    [web-search API] WARNING - Gemini API key not configured");
      return NextResponse.json(
        { summary: null, note: "Web search not configured" },
        { status: 200 }
      );
    }

    console.log("    [web-search API] Calling Gemini API to search web");
    // Use Gemini's search capabilities via the API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: {
            text: "You are a search assistant. Search the web for information about the given query and provide a concise summary with 2-3 key findings.",
          },
        },
        contents: {
          parts: {
            text: `Search for and summarize information about: ${query}\n\nProvide brief, relevant results.`,
          },
        },
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 300,
        },
      }),
      next: { revalidate: 0 },
    });

    console.log("    [web-search API] Gemini API response status:", response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error("    [web-search API] ERROR - Gemini API failed:", error);
      return NextResponse.json(
        { summary: null, error: "Search failed" },
        { status: 200 }
      );
    }

    const data = await response.json();
    const summary =
      data.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (!summary) {
      console.log("    [web-search API] WARNING - No summary in response");
      return NextResponse.json({ summary: null });
    }

    console.log("    [web-search API] Got summary from Gemini:");
    console.log("    [web-search API] Summary length:", summary.length);
    console.log("    [web-search API] Summary preview:", summary.substring(0, 150));

    return NextResponse.json({
      summary,
      sources: [],
    });
  } catch (error) {
    console.error("    [web-search API] ERROR - Exception:", error);
    console.error("    [web-search API] Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { summary: null, error: "Internal server error" },
      { status: 200 }
    );
  }
}
