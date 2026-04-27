import { supabase } from "@/lib/supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export type ProfileDisplayName = Pick<Profile, "id" | "display_name">;

export type ProfileChangePayload =
  RealtimePostgresChangesPayload<ProfileDisplayName>;

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getMyProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function getProfilesByIds(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds)).filter(Boolean);

  if (uniqueUserIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", uniqueUserIds);

  if (error) throw error;

  return Object.fromEntries(
    (data as ProfileDisplayName[]).map((profile) => [
      profile.id,
      profile.display_name,
    ])
  );
}

export function subscribeToProfileDisplayNames(
  userIds: string[],
  onChange: (payload: ProfileChangePayload) => void,
  onStatusChange?: (status: string) => void
) {
  const uniqueUserIds = Array.from(new Set(userIds)).filter(Boolean).sort();

  if (uniqueUserIds.length === 0) {
    return () => undefined;
  }

  const channel = supabase
    .channel(`profiles-display-names-${uniqueUserIds.join("-")}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles",
        filter: `id=in.(${uniqueUserIds.join(",")})`,
      },
      (payload) => {
        onChange(payload as ProfileChangePayload);
      }
    )
    .subscribe((status) => {
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        onStatusChange?.(status);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function upsertMyProfile(displayName: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in.");

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
