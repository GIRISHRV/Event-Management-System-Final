"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  email: string;
  role: "customer" | "vendor";
}

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
    // Get initial session from Supabase
    const initAuth = async () => {
      try {
        // First check if there's a stored session in localStorage
        const { data: { session: storedSession } } = await supabase.auth.getSession();
        
        if (storedSession) {
          setSession(storedSession);
          // Fetch profile in background (don't wait)
          const fetchProfile = async () => {
            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", storedSession.user.id)
                .single();
              
              if (profile) {
                setUserProfile(profile as UserProfile);
              }
            } catch (err) {
              console.error("Profile fetch error:", err);
            }
          };
          void fetchProfile();
        }
      } catch (err) {
        console.error("Auth init error:", err);
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
          const fetchProfile = async () => {
            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", newSession.user.id)
                .single();
              
              if (profile) {
                setUserProfile(profile as UserProfile);
              }
            } catch (err) {
              console.error("Profile fetch error:", err);
            }
          };
          void fetchProfile();
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
