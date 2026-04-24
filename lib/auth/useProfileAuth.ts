"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { fetchUserProfile } from "./profile";
import type { UserProfile } from "../orders/types";

export function useProfileAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const syncUserProfile = async (userId: string) => {
      if (!mounted) return;

      setProfileLoading(true);
      const profile = await fetchUserProfile(userId);

      if (!mounted) return;

      setUser(profile);
      setProfileLoading(false);
    };

    const initAuth = async () => {
      setAuthLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(false);
      await syncUserProfile(session.user.id);
    };

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setProfileLoading(false);
        return;
      }

      await syncUserProfile(session.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    setUser,
    authLoading,
    profileLoading,
    setProfileLoading,
  };
}
