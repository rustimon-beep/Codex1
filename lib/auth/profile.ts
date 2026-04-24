import { supabase } from "../supabase";
import type { UserProfile } from "../orders/types";

function getProfileCacheKey(userId: string) {
  return `profile-${userId}`;
}

function mapProfile(data: {
  id: string;
  email: string;
  role: UserProfile["role"];
  full_name: string;
}): UserProfile {
  return {
    id: data.id,
    email: data.email,
    role: data.role,
    name: data.full_name,
  };
}

function readCachedProfile(userId: string) {
  if (typeof window === "undefined") return null;

  const cached = window.localStorage.getItem(getProfileCacheKey(userId));
  if (!cached) return null;

  return JSON.parse(cached) as UserProfile;
}

function writeCachedProfile(profile: UserProfile) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(getProfileCacheKey(profile.id), JSON.stringify(profile));
}

async function loadProfileFromDb(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.error("Ошибка профиля:", error);
    return null;
  }

  return mapProfile(data);
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const cachedProfile = readCachedProfile(userId);

    if (cachedProfile) {
      setTimeout(async () => {
        const freshProfile = await loadProfileFromDb(userId);

        if (freshProfile) {
          writeCachedProfile(freshProfile);
        }
      }, 0);

      return cachedProfile;
    }
  } catch (error) {
    console.error("Ошибка чтения кэша профиля:", error);
  }

  const profile = await loadProfileFromDb(userId);
  if (!profile) return null;

  try {
    writeCachedProfile(profile);
  } catch (error) {
    console.error("Ошибка записи кэша профиля:", error);
  }

  return profile;
}

export function clearCachedProfile(userId: string) {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(getProfileCacheKey(userId));
}
