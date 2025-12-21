import { callOllama, type OllamaMessage } from "@/lib/ollama";
import { NextRequest, NextResponse } from "next/server";

interface ParsedEventData {
  basicInfo: {
    eventName?: string;
    eventDescription?: string;
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    organizerName?: string;
    organizerContact?: string;
    maxAttendees?: number;
    venueType?: 'indoor' | 'outdoor' | 'hybrid';
  };
  venue?: {
    venueName?: string;
    venueAddress?: string;
    venueCity?: string;
    venueLandmark?: string;
    latitude?: number;
    longitude?: number;
    googleMapsUrl?: string;
  };
  schedules?: Array<{
    day_number: number;
    start_time: string;
    end_time: string;
    title: string;
    description: string;
    location: string;
  }>;
  performers?: Array<{
    name: string;
    bio: string;
    performer_type: 'artist' | 'speaker' | 'dj' | 'band' | 'host' | 'other';
  }>;
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instructions, conversationHistory, currentEventData, isEditMode } = body as { 
      instructions: string; 
      conversationHistory?: ConversationMessage[];
      isEditMode?: boolean;
      currentEventData?: {
        eventName?: string;
        eventDescription?: string;
        startDate?: string;
        startTime?: string;
        endDate?: string;
        endTime?: string;
        organizerName?: string;
        organizerContact?: string;
        maxAttendees?: number;
        venueType?: string;
        venueName?: string;
        venueAddress?: string;
        venueCity?: string;
        venueLandmark?: string;
        latitude?: number;
        longitude?: number;
        googleMapsUrl?: string;
        schedules?: unknown[];
        performers?: unknown[];
        faqs?: unknown[];
      };
    };

    if (!instructions || typeof instructions !== 'string') {
      return NextResponse.json(
        { error: "Instructions are required" },
        { status: 400 }
      );
    }

    console.log("[parse-event-instructions] Processing instructions:", instructions.substring(0, 100));
    console.log("[parse-event-instructions] Conversation history length:", conversationHistory?.length || 0);
    console.log("[parse-event-instructions] Has current event data:", !!currentEventData);

    // Build conversation messages for Ollama
    const messages: OllamaMessage[] = [];
    
    // Add context about current form state if available
    let contextMessage = '';
    if (currentEventData) {
      const filled: string[] = [];
      const missing: string[] = [];
      
      if (currentEventData.eventName) filled.push(`Event Name: "${currentEventData.eventName}"`);
      else missing.push('Event Name');
      
      if (currentEventData.eventDescription) filled.push(`Description: "${currentEventData.eventDescription.substring(0, 100)}..."`);
      else missing.push('Event Description');
      
      if (currentEventData.startDate) filled.push(`Start Date: ${currentEventData.startDate}`);
      else missing.push('Start Date');
      
      if (currentEventData.startTime) filled.push(`Start Time: ${currentEventData.startTime}`);
      else missing.push('Start Time');
      
      if (currentEventData.endDate) filled.push(`End Date: ${currentEventData.endDate}`);
      else missing.push('End Date');
      
      if (currentEventData.endTime) filled.push(`End Time: ${currentEventData.endTime}`);
      else missing.push('End Time');
      
      if (currentEventData.organizerName) filled.push(`Organizer: ${currentEventData.organizerName}`);
      if (currentEventData.maxAttendees) filled.push(`Max Attendees: ${currentEventData.maxAttendees}`);
      if (currentEventData.venueType) filled.push(`Venue Type: ${currentEventData.venueType}`);
      if (currentEventData.venueName) filled.push(`Venue: ${currentEventData.venueName}`);
      if (currentEventData.venueCity) filled.push(`City: ${currentEventData.venueCity}`);
      if (currentEventData.latitude && currentEventData.longitude) filled.push(`Location: (${currentEventData.latitude}, ${currentEventData.longitude})`);
      
      // Include actual data for arrays
      let schedulesDetail = '';
      let performersDetail = '';
      let faqsDetail = '';
      
      if (currentEventData.schedules && currentEventData.schedules.length > 0) {
        schedulesDetail = `\nSchedules (${currentEventData.schedules.length}):\n${JSON.stringify(currentEventData.schedules, null, 2)}`;
      }
      
      if (currentEventData.performers && currentEventData.performers.length > 0) {
        performersDetail = `\nPerformers (${currentEventData.performers.length}):\n${JSON.stringify(currentEventData.performers, null, 2)}`;
      }
      
      if (currentEventData.faqs && currentEventData.faqs.length > 0) {
        faqsDetail = `\nFAQs (${currentEventData.faqs.length}):\n${JSON.stringify(currentEventData.faqs, null, 2)}`;
      }
      
      contextMessage = `CURRENT EVENT STATE:
${filled.length > 0 ? `Already filled:\n- ${filled.join('\n- ')}` : 'No fields filled yet'}

${missing.length > 0 ? `Still missing (REQUIRED):\n- ${missing.join('\n- ')}` : 'All required fields filled!'}${schedulesDetail}${performersDetail}${faqsDetail}`;
    }
    
    // Add previous conversation if exists
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      });
    }
    
    // Add current user message
    messages.push({
      role: 'user',
      content: instructions,
    });

    // Different prompts for create vs edit mode
    const systemPrompt = isEditMode ? 
    // EDIT MODE: Direct updates, no questions
    `MODE: EDITING
    You are an AI assistant helping users edit existing events. Your PRIMARY goal is to identify what the user wants to change and ONLY change that.

${contextMessage ? `\n${contextMessage}\n` : ''}

CRITICAL: You MUST ONLY respond with valid JSON. No other text, no markdown, no explanations - ONLY JSON.

=== STEP 1: IDENTIFY WHAT TO UPDATE ===

Read the user's message and determine which specific field(s) they're updating.
Update the corresponding fields in the 'data' object IMMEDIATELY based on the request (Live Update).

=== STEP 2: RETURN ONLY CHANGED DATA ===

CRITICAL RULES:
1. If user provides FAQs → Return ONLY faqs array, DO NOT include basicInfo, venue, schedules, or performers
2. If user updates description → Return ONLY basicInfo.eventDescription, DO NOT include other fields
3. If user updates schedule → Return ONLY schedules array, DO NOT include other fields
4. If user doesn't mention a field → DO NOT include it in your response AT ALL
5. NEVER modify description when user provides FAQs
6. NEVER modify schedules when user provides FAQs
7. NEVER add extra punctuation like "..." to any field

=== COMPLETE FIELD REFERENCE ===

basicInfo object fields:
- eventName: string (event title)
- eventDescription: string (detailed description)
- startDate: string (YYYY-MM-DD format)
- startTime: string (HH:MM 24-hour format)
- endDate: string (YYYY-MM-DD format)
- endTime: string (HH:MM 24-hour format)
- organizerName: string (who organizes it)
- organizerContact: string (email/phone)
- maxAttendees: number (capacity limit)
- venueType: string (must be: "indoor", "outdoor", or "hybrid")

venue object fields:
- venueName: string (venue name)
- venueAddress: string (street address)
- venueCity: string (city)
- venueLandmark: string (nearby landmark)
- latitude: number (map coordinate)
- longitude: number (map coordinate)
- googleMapsUrl: string (Google Maps link)

schedules array format (ALL fields required):
[
  {
    "day_number": 1,  // Integer: which day (1, 2, 3...)
    "start_time": "09:00",  // String: HH:MM format
    "end_time": "17:00",  // String: HH:MM format
    "title": "Keynote Speech", // KEEP SHORT (max 5-7 words)
    "description": "Speaker: Dr. Smith. Topic: Future of AI.", // DETAILS GO HERE
    "location": "Main Hall"  // String: where it happens, can be empty ""
  }
]

CRITICAL RULES FOR SCHEDULES:
1. Split long activities into Title and Description.
2. BAD: Title="Lunch break with vegan options provided"
3. GOOD: Title="Lunch Break", Description="Vegan options provided"

performers array format (ALL fields required):
[
  {
    "name": "Artist Name",  // String: performer name
    "bio": "Biography",  // String: about them, can be empty ""
    "performer_type": "artist"  // String: MUST be one of: "artist", "speaker", "chef", "performer", "other"
  }
]

faqs array format (ALL fields required):
[
  {
    "question": "Question text",  // String: the question
    "answer": "Answer text"  // String: the answer
  }
]

=== RESPONSE FORMAT ===

{
  "needsMoreInfo": false,
  "allRequiredFieldsComplete": true,
  "completionMessage": "✅ Updated [ONLY what changed]. Everything else preserved.",
  "data": {
    // ONLY include the fields the user asked to change
    // Examples:
    
    // If user provided FAQs:
    "faqs": [array of FAQ objects]
    
    // If user changed description:
    "basicInfo": {
      "eventDescription": "new description"
    }
    
    // If user updated schedule:
    "schedules": [array of schedule objects]
    
    // If user changed event name and date:
    "basicInfo": {
      "eventName": "new name",
      "startDate": "2026-03-15"
    }
  }
}

=== EXAMPLES ===

User: "Here are the FAQs: Q: What time? A: 9 AM"
→ Return ONLY: { "data": { "faqs": [{"question": "What time?", "answer": "9 AM"}] } }
→ DO NOT include basicInfo, venue, schedules, or performers

User: "Change description to: This is a great event"
→ Return ONLY: { "data": { "basicInfo": { "eventDescription": "This is a great event" } } }
→ DO NOT include faqs, schedules, or performers

User: "Add schedule: Day 1, 9 AM - 5 PM, Opening Ceremony, Main Hall"
→ Return ONLY: { "data": { "schedules": [{"day_number": 1, "start_time": "09:00", "end_time": "17:00", "title": "Opening Ceremony", "description": "", "location": "Main Hall"}] } }
→ DO NOT include basicInfo, faqs, or performers

NEVER return anything except pure JSON. Start with { and end with }`
    :
    // CREATE MODE: Conversational, ask for missing info
    `MODE: CREATION
    You are a friendly AI assistant helping users create events. Have a natural conversation to gather all required information.

${contextMessage ? `\n${contextMessage}\n` : ''}

CRITICAL: You MUST ONLY respond with valid JSON. No other text, no markdown, no explanations - ONLY JSON.

REQUIRED FIELDS that you MUST collect:
1. Event Name
2. Event Description (detailed)
3. Start Date (YYYY-MM-DD format)
4. Start Time (HH:MM 24-hour format)
5. End Date (YYYY-MM-DD format)
6. End Time (HH:MM 24-hour format)

OPTIONAL but helpful fields:
- Organizer name and contact
- Max attendees
- Venue type (indoor/outdoor/hybrid)
- Schedules (day activities)
- Performers/speakers
- FAQs

IMPORTANT: Extract and return ALL information collected SO FAR in every response, even if incomplete. This allows the form to fill in progressively (Live Update).

Your job is to:
1. Review what information the user has provided so far
2. Extract ANY information you can from their message (event name, dates, times, etc.)
3. Return the extracted data PLUS determine if you need more required fields
4. If missing required fields, ask ONE or TWO clear questions at a time. Do NOT ask for everything at once.
5. If all required fields collected, acknowledge completion and offer to help with optional details

=== DATA STRUCTURE REFERENCE ===

basicInfo object fields:
- eventName: string
- eventDescription: string
- startDate: string (YYYY-MM-DD)
- startTime: string (HH:MM)
- endDate: string (YYYY-MM-DD)
- endTime: string (HH:MM)
- organizerName: string
- organizerContact: string
- maxAttendees: number
- venueType: string ("indoor", "outdoor", "hybrid")

schedules array format:
[
  {
    "day_number": 1,
    "start_time": "09:00",
    "end_time": "10:00",
    "title": "Keynote Speech", // KEEP SHORT (max 5-7 words)
    "description": "Speaker: Dr. Smith. Topic: Future of AI.", // DETAILS GO HERE
    "location": "Room A"
  }
]

CRITICAL RULES FOR SCHEDULES:
1. Split long activities into Title and Description.
2. BAD: Title="Lunch break with vegan options provided"
3. GOOD: Title="Lunch Break", Description="Vegan options provided"

performers array format:
[
  {
    "name": "Name",
    "bio": "Bio",
    "performer_type": "artist" // or "speaker", "chef", "performer", "other"
  }
]

faqs array format:
[
  {
    "question": "Question?",
    "answer": "Answer."
  }
]

RESPONSE FORMAT - ALWAYS include "partialData" with whatever you've extracted:

FORMAT 1 - If required information is incomplete:
{
  "needsMoreInfo": true,
  "question": "Your friendly follow-up question here (asking for 1-2 missing fields)",
  "partialData": {
    "basicInfo": {
      "eventName": "extracted name or omit",
      "eventDescription": "extracted description or omit",
      "startDate": "YYYY-MM-DD if mentioned or omit",
      "startTime": "HH:MM if mentioned or omit",
      "endDate": "YYYY-MM-DD if mentioned or omit",
      "endTime": "HH:MM if mentioned or omit",
      "organizerName": "extracted name or omit",
      "organizerContact": "extracted contact or omit"
    },
    "schedules": [],
    "performers": [],
    "faqs": []
  },
  "missingRequired": ["list of missing required fields"]
}

FORMAT 2 - If all REQUIRED fields collected (but can add optional):
{
  "needsMoreInfo": false,
  "allRequiredFieldsComplete": true,
  "completionMessage": "Great! I have all the required info. Would you like to add optional details like organizer info, performers, schedule, or FAQs? Or shall we create the event now?",
  "data": {
    "basicInfo": {
      "eventName": "string",
      "eventDescription": "string",
      "startDate": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endDate": "YYYY-MM-DD",
      "endTime": "HH:MM",
      "organizerName": "string",
      "organizerContact": "string"
    },
    "schedules": [],
    "performers": [],
    "faqs": []
  }
}

FORMAT 3 - User adds optional info after required is complete:
{
  "needsMoreInfo": false,
  "allRequiredFieldsComplete": true,
  "completionMessage": "Added! Anything else you'd like to include?",
  "data": {
    "basicInfo": { ... },
    "schedules": [...],
    "performers": [...],
    "faqs": [...]
  }
}

NEVER return anything except pure JSON. Start with { and end with }`;

    console.log("[parse-event-instructions] Calling AI");

    const response = await callOllama(
      messages,
      systemPrompt,
      process.env.OLLAMA_MODEL || "llama3.1:8b"
    );

    console.log("[parse-event-instructions] AI response received");
    console.log("[parse-event-instructions] Raw response:", response.substring(0, 200));

    // Parse the JSON response
    let parsedResponse: { 
      needsMoreInfo: boolean; 
      question?: string; 
      data?: ParsedEventData;
      partialData?: ParsedEventData;
      allRequiredFieldsComplete?: boolean;
      completionMessage?: string;
      missingRequired?: string[];
    };
    try {
      // Try to extract JSON from response
      // First, try to parse the entire response as JSON
      try {
        parsedResponse = JSON.parse(response);
      } catch {
        // If that fails, try to find JSON within the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error("[parse-event-instructions] No JSON found in response");
          // Fallback: treat response as a question
          return NextResponse.json({
            success: true,
            needsMoreInfo: true,
            question: response.trim() || "Could you provide more details about your event?",
          });
        }
        parsedResponse = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("[parse-event-instructions] Failed to parse AI response:", parseError);
      console.error("[parse-event-instructions] Raw response:", response.substring(0, 500));
      // Fallback: treat response as a question
      return NextResponse.json({
        success: true,
        needsMoreInfo: true,
        question: response.trim() || "Could you provide more details about your event?",
      });
    }

    // If AI needs more info, return the question AND any partial data collected
    if (parsedResponse.needsMoreInfo && !parsedResponse.allRequiredFieldsComplete) {
      console.log("[parse-event-instructions] AI needs more info, asking:", parsedResponse.question);
      return NextResponse.json({
        success: true,
        needsMoreInfo: true,
        question: parsedResponse.question || "Could you provide more details about your event?",
        partialData: parsedResponse.partialData || null,
        missingRequired: parsedResponse.missingRequired || [],
      });
    }

    // If all required fields are complete
    if (parsedResponse.allRequiredFieldsComplete) {
      console.log("[parse-event-instructions] All required fields complete!");
      return NextResponse.json({
        success: true,
        needsMoreInfo: false,
        allRequiredFieldsComplete: true,
        completionMessage: parsedResponse.completionMessage || "Great! All required fields are filled. Would you like to add optional details?",
        data: parsedResponse.data,
      });
    }

    // Fallback validation for old format
    if (!parsedResponse.data?.basicInfo?.eventName || 
        !parsedResponse.data?.basicInfo?.startDate || 
        !parsedResponse.data?.basicInfo?.startTime) {
      console.error("[parse-event-instructions] Missing required fields in parsed data");
      return NextResponse.json({
        success: true,
        needsMoreInfo: true,
        question: "I need a few more details. What's the event name and when does it start?",
      });
    }

    console.log("[parse-event-instructions] All info collected, returning complete data");
    console.log("[parse-event-instructions] Event name:", parsedResponse.data.basicInfo.eventName);

    return NextResponse.json({
      success: true,
      needsMoreInfo: false,
      data: parsedResponse.data,
    });
  } catch (error) {
    console.error("[parse-event-instructions] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to parse event instructions",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
