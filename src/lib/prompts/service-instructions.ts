/**
 * AI system prompts for the vendor-service-creation assistant.
 * 
 * STRICT MODE: Pure Data Extraction.
 */

/**
 * Builds the system prompt for SERVICE mode.
 */
export function buildServiceModePrompt(contextMessage: string, isEditMode: boolean): string {
    const modeText = isEditMode ? "EDIT an existing service" : "CREATE a new vendor service";

    return `You are a helpful assistant that outputs JSON only.

User wants to ${modeText}. Extract details into the following STRICT JSON structure.

<schema>
{
  "data": {
    "service_name": "string | null",
    "description": "string | null",
    "base_price": "number | null",
    "category": "string | null",
    "images": ["string url"]
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
4. If critical info (Service Name) is missing and not provided/implied, prioritize asking a "question".
5. Return valid JSON.
`;
}
