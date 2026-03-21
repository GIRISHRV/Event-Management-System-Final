// src/lib/algorithms/chatbot/context-suggestions.ts

interface EventWithContext {
  event_performers?: unknown[];
  event_schedules?: unknown[];
  event_faqs?: { question?: string }[];
  venue_name?: string | null;
  venue_city?: string | null;
}

export function generateContextualSuggestions(event: EventWithContext): string[] {
  if (!event) {
    return [
      "How do I get to the venue?",
      "What time does it start?",
      "Who is performing?",
      "What should I know before attending?",
    ];
  }

  const suggestions: string[] = [];

  const hasPerformers = Array.isArray(event.event_performers) && event.event_performers.length > 0;
  const hasSchedule = Array.isArray(event.event_schedules) && event.event_schedules.length > 0;
  const hasFaqs = Array.isArray(event.event_faqs) && event.event_faqs.length > 0;

  if (hasPerformers) {
    suggestions.push("Who's performing?");
  }

  if (hasSchedule) {
    suggestions.push("What's on the schedule?");
  }

  const firstFaq = event.event_faqs?.[0];
  if (hasFaqs && firstFaq?.question) {
    suggestions.push(firstFaq.question);
  }

  if (event.venue_name || event.venue_city) {
    suggestions.push("How do I get to the venue?");
  }

  const fallbacks = [
    "What time does it start?",
    "What should I know before attending?",
    "Are there any age restrictions?",
    "Will there be food and drinks?",
  ];

  for (const fallback of fallbacks) {
    if (suggestions.length >= 4) break;
    if (!suggestions.includes(fallback)) {
      suggestions.push(fallback);
    }
  }

  return suggestions.slice(0, 4);
}
