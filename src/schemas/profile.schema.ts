import { z } from "zod";

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().nullable(),
  username: z.string().nullable(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  role: z.enum(["customer", "vendor", "admin"]),
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const profileUpdateSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters long.").max(100),
  username: z.string().min(3, "Username must be at least 3 characters long.").max(50).regex(/^[a-zA-Z0-9_]+$/, "Username must contain only alphanumeric characters and underscores."),
  bio: z.string().max(500, "Bio must be under 500 characters.").optional(),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
