"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "@/lib/supabase-types";

// Use the Profile type from supabase-types, but ensure role is compatible
export type UserProfile = Profile;

interface AuthContextType {
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Helper to fetch profile
    const fetchProfile = async (userId: string) => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        
        if (profile) {
          setUserProfile(profile as UserProfile);
        }
      } catch {
        // Profile fetch failed silently - user can still use the app
      }
    };

    // Get initial session from Supabase
    const initAuth = async () => {
      try {
        // First check if there's a stored session in localStorage
        const { data: { session: storedSession } } = await supabase.auth.getSession();
        
        if (storedSession) {
          setSession(storedSession);
          // Fetch profile in background (don't wait)
          void fetchProfile(storedSession.user.id);
        }
      } catch {
        // Auth init failed silently - user will be redirected to login
      } finally {
        // Always set loading to false immediately
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        
        if (newSession?.user) {
          // Fetch updated profile in background
          void fetchProfile(newSession.user.id);
        } else {
          setUserProfile(null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, userProfile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
