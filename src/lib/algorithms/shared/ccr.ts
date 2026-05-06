import type { RecommendedEvent } from "./types";

export function applyCCR(
  recommendations: RecommendedEvent[],
  eventDataMap: Map<string, { attendee_count: number; max_attendees: number | null; start_date: string }>
): (RecommendedEvent & { pre_ccr_score: number })[] {
  const now = new Date();

  return recommendations
    .map((rec) => {
      const data = eventDataMap.get(rec.eventId);
      if (!data) return { ...rec, pre_ccr_score: rec.score };

      const { attendee_count, max_attendees, start_date } = data;

      // 1. Capacity factor
      let capacityFactor = 1.0;
      if (max_attendees !== null && max_attendees > 0) {
        const ratio = attendee_count / max_attendees;
        capacityFactor = Math.max(0, 1 - Math.pow(ratio, 2));
      }

      // 2. Urgency factor
      const eventDate = new Date(start_date);
      const daysToEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      const urgencyFactor = 1 / (1 + Math.exp(-(daysToEvent / 7)));

      // 3. Final score
      const finalScore = rec.score * capacityFactor * urgencyFactor;

      return {
        ...rec,
        pre_ccr_score: rec.score,
        score: finalScore,
      };
    })
    .sort((a, b) => b.score - a.score);
}
