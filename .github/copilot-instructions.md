# GitHub Copilot Instructions for Event Management System

## Project Overview
This is a Next.js 16+ application for Event Management, using Supabase for backend/auth and Tailwind CSS for styling. The project uses the App Router but relies heavily on Client Components for data fetching and interactivity.

## Tech Stack
- **Framework**: Next.js 16 (App Router), React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4, Lucide React (icons)
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI**: Google Gemini (Model: `gemini-3-flash-preview`) & Ollama (local fallback)

## Core Architecture & Patterns

### 1. Component Structure
- **Client Components**: Most pages (`page.tsx`) are marked `"use client"` to access `useAuth` and perform client-side data fetching.
- **UI Components**: Located in `src/components/ui`. Prefer using these over raw HTML/Tailwind when possible.
- **Layouts**: `src/components/layout` contains shared layout elements like `PillNav`.

### 2. Data Fetching & State
- **Pattern**: Client-side fetching using `useEffect` and the singleton `supabase` client is the dominant pattern.
- **Supabase Client**: Import from `@/lib/supabase`.
  ```typescript
  import { supabase } from "@/lib/supabase";
  // Usage
  const { data, error } = await supabase.from("events").select("*");
  ```
- **Types**: Always use generated types from `@/lib/supabase-types`.
  ```typescript
  import type { Event, Profile } from "@/lib/supabase-types";
  ```

### 3. Authentication
- **Context**: Auth is managed via `AuthContext`.
- **Hook**: Use `useAuth()` to access `session`, `userProfile`, and `signOut`.
  ```typescript
  import { useAuth } from "@/context/AuthContext";
  const { session, userProfile } = useAuth();
  ```
- **Role-Based Access**: Check `userProfile.role` ('customer' | 'vendor' | 'admin').

### 4. Database & Schema
- **Tables**: `profiles`, `events`, `bookings`, `chat_history`.
- **JSONB Usage**: The `events` table uses JSONB for `schedules`, `performers`, and `faqs`. Handle these as arrays of objects in frontend code.
- **RLS**: Row Level Security is enabled. Ensure queries respect user policies (though client-side checks are also good for UX).

### 5. AI Integration
- **Chat API**: Located in `src/app/api/chat/route.ts`.
- **Model Standard**: Always use `gemini-3-flash-preview` for Gemini integrations.
- **Providers**: Supports both Gemini (cloud) and Ollama (local).
- **Pattern**: Check for `useWebSearch` flag to toggle between simple chat and search-grounded responses.

## Development Workflows

### Styling Conventions
- Use Tailwind utility classes.
- Dark mode is default (`bg-zinc-950 text-white`).
- Use `bg-linear-to-r` (Tailwind v4 syntax) for gradients.

### Common Commands
- `npm run dev`: Start development server.
- `npm run verify-db`: Check database connection and schema.

## Key Files
- `src/lib/supabase.ts`: Supabase client initialization.
- `src/context/AuthContext.tsx`: Authentication logic.
- `src/lib/supabase-types.ts`: Database type definitions.
- `src/components/ui/`: Reusable UI components.
