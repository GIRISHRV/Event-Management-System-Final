/**
 * AI system prompts for the event-creation assistant.
 * 
 * STRICT MODE: Pure Data Extraction.
 */

/**
 * Builds the system prompt for EDIT mode.
 */
export function buildEditModePrompt(contextMessage: string, budgetContext?: string): string {
  const budgetSection = budgetContext
    ? `\nBudget Information:\n${budgetContext}\n`
    : '';

  return `You are a helpful assistant that outputs JSON only.

User wants to EDIT an existing event. Identify changes and extract them into this JSON structure:
{
  "data": {
    "basicInfo": { ... },
    "venue": { ... },
    "schedules": [ ... ],
    "performers": [ ... ],
    "faqs": [ ... ]
  }
}
${budgetSection}
Existing Context:
${contextMessage || "None"}

Rules:
1. ONLY return fields that have CHANGED or been mentioned by the user.
2. Be LAZY: If a field is not mentioned, set it to null.
3. Return valid JSON.
4. When mentioning vendors or services, always keep suggestions within the stated budget if set.
`;
}

/**
 * Builds the system prompt for CREATE mode.
 */
export function buildCreateModePrompt(contextMessage: string, budgetContext?: string): string {
  const budgetSection = budgetContext
    ? `\nBudget Information:\n${budgetContext}\n`
    : '';

  return `You are a helpful assistant that outputs JSON only.

User wants to create an event. Extract details into the following STRICT JSON structure.
${budgetSection}
<schema>
{
  "data": {
    "basicInfo": {
      "eventName": "string",
      "eventDescription": "string (MUST provide a detailed description. DO NOT OMIT.)",
      "startDate": "YYYY-MM-DD or null",
      "startTime": "HH:MM or null",
      "endDate": "YYYY-MM-DD or null",
      "endTime": "HH:MM or null (use 23:59 instead of 24:00)",
      "timezone": "string (default 'UTC')",
      "organizerName": "string or null",
      "organizerContact": "string or null",
      "maxAttendees": "number or null",
      "venueType": "indoor | outdoor | hybrid",
      "visibilityType": "public | private",
      "eventStatus": "upcoming | ongoing | completed | cancelled"
    },
    "venue": {
      "venueName": "string or null",
      "venueAddress": "string or null",
      "venueCity": "string or null",
      "venueLandmark": "string or null",
      "latitude": "number or null",
      "longitude": "number or null"
    },
    "schedules": [
      {
        "day_number": "number",
        "start_time": "HH:MM",
        "end_time": "HH:MM",
        "title": "string",
        "description": "string",
        "location": "string"
      }
    ],
    "performers": [
      {
        "name": "string",
        "bio": "string or null",
        "image_url": "string or null",
        "performer_type": "artist | speaker | chef | performer | other",
        "social_links": {
          "platform": "url"
        }
      }
    ],
    "faqs": [
      {
        "question": "string",
        "answer": "string",
        "display_order": "number"
      }
    ]
  },
  "question": "string (follow-up question if critical info is missing) or null"
}
</schema>

Existing Context:
${contextMessage || "None"}

Rules:
1. Output ONLY valid JSON. No markdown, no conversational fillers.
2. BE LAZY: Only populate fields explicitly mentioned or strongly implied by the user.
3. DEFAULT TO NULL: For all other fields in the schema, you MUST provide "null" as the value unless the user explicitly asks you to "Generate ideas" or "Guess information".
4. If critical info (Name) is missing and not provided/implied, prioritize asking a "question".
5. Use 23:59 for any end of day times.
6. When the budget is set, always prefer vendor/service suggestions that fit within the per-category budget.
`;
}

