"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/services/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { userProfileSchema, type UserProfile } from "@/schemas/profile.schema";
import { logger } from "@/lib/logger";

interface AuthContextType {
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Strict fetch and Zod validation of user profile
    const fetchProfile = async (userId: string) => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(); // Use maybeSingle to avoid 406 on missing row

        if (error) {
          logger.error("[AuthContext] Profile fetch error:", error.message || error);
          return;
        }

        if (profile && isMounted) {
          // Validate using our user profile schema
          const validatedProfile = userProfileSchema.parse(profile);
          setUserProfile(validatedProfile);
        } else if (isMounted) {
          logger.info("[AuthContext] Profile not found yet for user:", userId);
          // Optional: Retry logic could go here if we expect a trigger delay
        }
      } catch (err) {
        logger.error("[AuthContext] Profile processing failed:", err instanceof Error ? err.message : err);
      }
    };

    const initAuth = async () => {
      try {
        const { data: { session: storedSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (storedSession && isMounted) {
          setSession(storedSession);
          void fetchProfile(storedSession.user.id);
        }
      } catch (err) {
        logger.error("[AuthContext] Failed to initialize session", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void initAuth();

    // Listen to Supabase edge auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        
        setSession(newSession);

        if (newSession?.user) {
          void fetchProfile(newSession.user.id);
        } else {
          setUserProfile(null);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (signOutErr) {
      logger.warn(
        "[AuthContext] Remote logout failed:",
        signOutErr instanceof Error ? signOutErr.message : String(signOutErr)
      );
    } finally {
      setSession(null);
      setUserProfile(null);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, userProfile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider root boundary.");
  }
  return context;
}
