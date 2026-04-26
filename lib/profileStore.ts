import { supabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  display_name: string;
  default_part: string | null;
  created_at: string;
  updated_at: string;
};

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

export async function upsertMyProfile(displayName: string, defaultPart?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in.");

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      display_name: displayName,
      default_part: defaultPart || null,
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