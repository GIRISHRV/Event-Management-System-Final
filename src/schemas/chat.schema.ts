import { z } from "zod";

// ─── Chat System Types ─────────────

// Define roles for chat messages
export const chatRoleEnum = z.enum(["user", "assistant", "system", "error"]);
export type ChatRole = z.infer<typeof chatRoleEnum>;

export const chatSourceEnum = z.enum(["local", "AI", "web"]);
export type ChatSource = z.infer<typeof chatSourceEnum>;

// Core individual message schema
export const chatMessageSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  role: chatRoleEnum,
  content: z.string().min(1, "Message content cannot be empty").max(10000, "Message too long"),
  source: chatSourceEnum.optional().nullable(),
  responseTime: z.number().optional().nullable(), // For response time tracking
  timestamp: z.string().datetime({ offset: true }).default(() => new Date().toISOString()),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Strict History Tracking Schema (persisted representation)
export const chatHistoryRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  event_id: z.string().uuid().optional().nullable(), // Nullable for global platform questions
  messages: z.array(chatMessageSchema), // DB stores as JSONB array bounds
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional().nullable(),
});

export type ChatHistoryRow = z.infer<typeof chatHistoryRowSchema>;
export type CreateChatHistoryInput = Omit<ChatHistoryRow, "id" | "created_at" | "updated_at">;

// Payload Request / Response Schemas for API boundary security
export const chatApiRequestSchema = z.object({
  history: z.array(chatMessageSchema),
  message: z.string().min(1).max(2000), // Bound the maximum LLM input context
  eventId: z.string().uuid().optional().nullable(),
  useWebSearch: z.boolean().default(false).optional(),
});

export type ChatApiRequest = z.infer<typeof chatApiRequestSchema>;

// Payload strictly bounded response shape
export const chatApiResponseSchema = z.object({
  success: z.boolean(),
  response: chatMessageSchema.optional(),
  error: z.string().optional(),
});

export type ChatApiResponse = z.infer<typeof chatApiResponseSchema>;

// Web Search Tool Call schema boundary
export const webSearchResultSchema = z.object({
  query: z.string(),
  results: z.array(z.string().or(z.object({ title: z.string(), link: z.string().url(), snippet: z.string() }))),
});

export type WebSearchResult = z.infer<typeof webSearchResultSchema>;
