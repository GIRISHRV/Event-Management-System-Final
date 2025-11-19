import type { Event, EventFAQData, EventScheduleData, EventPerformerData } from "./supabase-types";

interface SearchMatch {
  score: number;
  answer: string;
  source: string;
}

// Simple string similarity (Levenshtein distance)
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function findKeywordMatch(question: string, keywords: string[]): number {
  const questionLower = question.toLowerCase();
  let matchScore = 0;

  keywords.forEach((keyword) => {
    if (questionLower.includes(keyword.toLowerCase())) {
      matchScore += 1;
    }
  });

  return Math.min(matchScore / keywords.length, 1);
}

// Detect question intent to skip irrelevant searches
function getQuestionIntent(question: string): {
  type: 'schedule' | 'performer' | 'location' | 'faq' | 'advice' | 'unknown';
  confidence: number;
} {
  const questionLower = question.toLowerCase();

  // Schedule/timing questions
  if (/when|what time|how long|duration|start|end|schedule/.test(questionLower)) {
    return { type: 'schedule', confidence: 0.95 };
  }

  // Performer questions - MUST have "who" or "performer" or "artist"
  if (/(who|performers?|artists?|musicians?|speakers?|acts?|bands?)\b/.test(questionLower)) {
    return { type: 'performer', confidence: 0.95 };
  }

  // Location questions
  if (/where|location|venue|address|how to get|directions|parking|transport/.test(questionLower)) {
    return { type: 'location', confidence: 0.9 };
  }

  // FAQ-like questions (how, can, do, should)
  if (/^(how|can|do|should|will|is|are|what are)/.test(questionLower)) {
    return { type: 'faq', confidence: 0.7 };
  }

  // Advice/opinion questions (requires AI or web)
  if (/wear|dress|bring|prepare|advice|recommend|suitable|appropriate|family|weather|climate/.test(questionLower)) {
    return { type: 'advice', confidence: 1.0 };
  }

  return { type: 'unknown', confidence: 0.3 };
}

// Search FAQs
export function searchFAQs(question: string, faqs: EventFAQData[] | undefined): SearchMatch | null {
  if (!faqs || faqs.length === 0) return null;

  let bestMatch: SearchMatch | null = null;

  faqs.forEach((faq) => {
    const faqQuestion = faq.question || "";
    const similarity = stringSimilarity(question.toLowerCase(), faqQuestion.toLowerCase());

    if (similarity > 0.5 && (!bestMatch || similarity > bestMatch.score)) {
      bestMatch = {
        score: similarity,
        answer: faq.answer || "",
        source: "FAQ",
      };
    }
  });

  return bestMatch;
}

// Search schedule
export function searchSchedule(question: string, schedules: EventScheduleData[] | undefined): SearchMatch | null {
  if (!schedules || schedules.length === 0) return null;

  const timeKeywords = [
    "time",
    "start",
    "begin",
    "when",
    "schedule",
    "duration",
    "end",
    "finish",
  ];

  if (findKeywordMatch(question, timeKeywords) > 0.3) {
    const schedule = schedules[0];
    const answer = `The event schedule includes:
- Start Time: ${schedule.start_time || "N/A"}
- End Time: ${schedule.end_time || "N/A"}
- Title: ${schedule.title || "N/A"}`;

    return {
      score: 0.8,
      answer,
      source: "Schedule",
    };
  }

  return null;
}

// Search performers
export function searchPerformers(question: string, performers: EventPerformerData[] | undefined): SearchMatch | null {
  if (!performers || performers.length === 0) return null;

  const performerKeywords = [
    "performer",
    "artist",
    "who",
    "perform",
    "singing",
    "playing",
    "act",
    "music",
  ];

  if (findKeywordMatch(question, performerKeywords) < 0.2) return null;

  let bestMatch: SearchMatch | null = null;

  performers.forEach((performer) => {
    const name = performer.name || "";
    const similarity = stringSimilarity(question.toLowerCase(), name.toLowerCase());

    if (similarity > 0.3) {
      const answer = `${name} (${performer.performer_type})${
        performer.bio ? `: ${performer.bio}` : ""
      }`;

      if (!bestMatch || similarity > bestMatch.score) {
        bestMatch = {
          score: similarity,
          answer,
          source: "Performers",
        };
      }
    }
  });

  // If no specific performer found, list all
  if (!bestMatch) {
    const performerList = performers.map((p) => `- ${p.name} (${p.performer_type})`).join("\n");
    bestMatch = {
      score: 0.6,
      answer: `Performers:\n${performerList}`,
      source: "Performers",
    };
  }

  return bestMatch;
}

// Search location
export function searchLocation(question: string, event: Event): SearchMatch | null {
  const locationKeywords = ["where", "location", "venue", "address", "place", "city", "map"];

  if (findKeywordMatch(question, locationKeywords) < 0.2) return null;

  const answer = `Event Location:
- Venue: ${event.venue_name || "N/A"}
- Address: ${event.venue_address || "N/A"}
- City: ${event.venue_city || "N/A"}
- Coordinates: ${event.latitude && event.longitude ? `${event.latitude}, ${event.longitude}` : "N/A"}`;

  return {
    score: 0.9,
    answer,
    source: "Location",
  };
}

// Search event basics
export function searchEventBasics(question: string, event: Event): SearchMatch | null {
  const basicKeywords = ["event name", "tell me about", "describe", "what is this"];

  // Much stricter matching - only exact topic queries
  const hasBasicKeyword = basicKeywords.some((kw) =>
    question.toLowerCase().includes(kw)
  );

  if (!hasBasicKeyword) return null;

  const answer = `${event.event_name}
${event.event_description ? `${event.event_description}` : ""}
- Status: ${event.event_status || "Scheduled"}
- Date: ${event.start_date || "N/A"}
- Time: ${event.start_time || "N/A"}`;

  return {
    score: 0.9, // High score for exact match
    answer,
    source: "Event Info",
  };
}

// Main search function - returns best local match or null
export function searchEventLocally(
  question: string,
  event: Event
): SearchMatch | null {
  const intent = getQuestionIntent(question);

  // If question is clearly looking for advice/opinion, skip local search
  if (intent.type === 'advice' && intent.confidence >= 0.9) {
    return null; // Send to AI
  }

  // Build targeted searches based on intent
  const searches: (SearchMatch | null)[] = [];

  // Always check FAQs first (most reliable)
  searches.push(searchFAQs(question, event.faqs));

  // Check based on detected intent
  if (intent.type === 'schedule') {
    searches.push(searchSchedule(question, event.schedules));
  } else if (intent.type === 'performer') {
    searches.push(searchPerformers(question, event.performers));
  } else if (intent.type === 'location') {
    searches.push(searchLocation(question, event));
  } else if (intent.type === 'unknown') {
    // For unknown, try all
    searches.push(searchSchedule(question, event.schedules));
    searches.push(searchPerformers(question, event.performers));
    searches.push(searchLocation(question, event));
    searches.push(searchEventBasics(question, event));
  }

  const matches = searches.filter((match) => match !== null) as SearchMatch[];

  if (matches.length === 0) return null;

  // Return best match with higher confidence threshold
  matches.sort((a, b) => b.score - a.score);
  const best = matches[0];

  // Only return if VERY confident (0.6+ minimum)
  return best.score > 0.6 ? best : null;
}

// Prepare event context for LLM
export function prepareEventContextForLLM(event: Event): string {
  const context = `Event Name: ${event.event_name}
Description: ${event.event_description || "N/A"}

Date & Time:
- Start: ${event.start_date} at ${event.start_time}
- End: ${event.end_date} at ${event.end_time}
- Timezone: ${event.timezone}

Location:
- Venue: ${event.venue_name}
- Address: ${event.venue_address}
- City: ${event.venue_city}

Performers:
${
  event.performers?.length
    ? event.performers.map((p: EventPerformerData) => `- ${p.name} (${p.performer_type}): ${p.bio || "N/A"}`).join("\n")
    : "No performers listed"
}

Schedule:
${
  event.schedules?.length
    ? event.schedules.map((s: EventScheduleData) => `- ${s.start_time} to ${s.end_time}: ${s.title}`).join("\n")
    : "No schedule listed"
}

FAQs:
${
  event.faqs?.length
    ? event.faqs.map((f: EventFAQData) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "No FAQs"
}

Gallery:
- Images: ${event.gallery_images?.length || 0} images
- Videos: ${event.gallery_videos?.length || 0} videos`;

  return context.trim();
}

// Web search function - calls API to search the web
export async function searchWeb(query: string): Promise<string | null> {
  try {
    const response = await fetch("/api/web-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    return data.summary || null;
  } catch (error) {
    return null;
  }
}
