import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
});

export type SignInFormData = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string().min(6, "Password confirmation must be at least 6 characters long."),
  role: z.enum(["customer", "vendor"]),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
