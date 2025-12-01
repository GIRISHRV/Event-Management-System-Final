// Error handling utility for Supabase errors with user-friendly messages

export interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export function getErrorMessage(error: unknown): string {
  if (!error) return "An unknown error occurred";
  
  const supabaseError = error as SupabaseError;
  
  switch (supabaseError.code) {
    case '42P17':
      return "🚨 Database Policy Conflict: The database security policies have a circular reference. Please run the latest SQL migration script to fix this.";
    
    case '42P01':
      return `🚨 Missing Database Table: ${supabaseError.message}. Please run the complete database setup script.`;
    
    case '42703':
      return `🚨 Missing Database Column: ${supabaseError.message}. Please run the database migration to add missing columns.`;
    
    case 'PGRST301':
      return "🚨 Permission Denied: You don't have permission to access this data. Please check your authentication.";
    
    case 'PGRST204':
      return "🚨 No Data Found: The requested data was not found or has been deleted.";
    
    case 'PGRST116':
      return `🚨 Query Error: ${supabaseError.message}. There might be an issue with the data format.`;
    
    default:
      if (supabaseError.message?.includes('column') && supabaseError.message?.includes('does not exist')) {
        return `🚨 Database Column Missing: ${supabaseError.message}. Please run the database migration script.`;
      }
      
      if (supabaseError.message?.includes('relation') && supabaseError.message?.includes('does not exist')) {
        return `🚨 Database Table Missing: ${supabaseError.message}. Please run the complete database setup script.`;
      }
      
      if (supabaseError.message?.includes('infinite recursion')) {
        return "🚨 Database Policy Error: Circular reference in security policies. Please update your database policies.";
      }
      
      return `🚨 Database Error${supabaseError.code ? ` (${supabaseError.code})` : ''}: ${supabaseError.message || 'An unexpected database error occurred'}`;
  }
}

/**
 * Log error details in development mode only
 */
export function logError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 Error in ${context}`);
    console.error("Error:", error);
    console.error("User-friendly message:", getErrorMessage(error));
    console.groupEnd();
  }
}