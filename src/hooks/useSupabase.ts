"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AuthSession } from "@supabase/supabase-js";

export type UserRole = "customer" | "vendor" | null;

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
}

export function useSupabaseAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (data) {
        setUserProfile(data);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      // Don't block auth on profile fetch failure
      setError(err instanceof Error ? err.message : "Profile fetch error");
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        if (!mounted) return;
        setSession(session);
        setLoading(false); // Set loading to false immediately after getting session

        if (session?.user) {
          // Fetch profile in background without blocking
          void fetchUserProfile(session.user.id);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Auth error");
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes - this will auto-restore session from storage
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setUserProfile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out error");
    }
  };

  return { session, userProfile, loading, error, signOut };
}
