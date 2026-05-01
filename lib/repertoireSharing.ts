import { supabase } from "@/lib/supabase";
import type { Confidence, Part, Voicing } from "@/lib/matching";
import {
  addRepertoireItem,
  getMyRepertoire,
  type RepertoireRow,
} from "@/lib/repertoireStore";
import { getCurrentUser } from "@/lib/profileStore";

export type RepertoireShare = {
  id: string;
  owner_id: string;
  code: string;
  created_at: string;
  revoked_at: string | null;
  expires_at: string | null;
};

type SharedRepertoireRpcRow = {
  share_id: string;
  code: string;
  owner_display_name: string;
  song_id: string | null;
  song_title: string | null;
  voicing: Voicing | null;
  arranger_name: string | null;
};

export type SharedRepertoireSong = {
  id: string;
  songTitle: string;
  voicing: Voicing;
  arrangerName: string | null;
};

export type SharedRepertoire = {
  shareId: string;
  code: string;
  ownerDisplayName: string;
  songs: SharedRepertoireSong[];
};

export type CopyableSharedSong = SharedRepertoireSong & {
  duplicateStatus: "eligible" | "exact" | "possible_arrangement";
};

export function normalizeSharedSongText(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function sharedSongExactKey(input: {
  songTitle: string;
  voicing: Voicing;
  arrangerName?: string | null;
}) {
  return [
    normalizeSharedSongText(input.songTitle),
    input.voicing,
    input.arrangerName?.trim()
      ? normalizeSharedSongText(input.arrangerName)
      : "__blank_arranger__",
  ].join("|");
}

function sharedSongTitleVoicingKey(input: {
  songTitle: string;
  voicing: Voicing;
}) {
  return [normalizeSharedSongText(input.songTitle), input.voicing].join("|");
}

export function resolveSharedSongCopyability(
  songs: SharedRepertoireSong[],
  myRepertoire: Pick<RepertoireRow, "song_title" | "voicing" | "arranger_name">[]
): CopyableSharedSong[] {
  const exactKeys = new Set(
    myRepertoire.map((item) =>
      sharedSongExactKey({
        songTitle: item.song_title,
        voicing: item.voicing,
        arrangerName: item.arranger_name,
      })
    )
  );
  const titleVoicingKeys = new Set(
    myRepertoire.map((item) =>
      sharedSongTitleVoicingKey({
        songTitle: item.song_title,
        voicing: item.voicing,
      })
    )
  );

  return songs.map((song) => {
    const exactKey = sharedSongExactKey(song);
    const titleVoicingKey = sharedSongTitleVoicingKey(song);

    return {
      ...song,
      duplicateStatus: exactKeys.has(exactKey)
        ? "exact"
        : titleVoicingKeys.has(titleVoicingKey)
          ? "possible_arrangement"
          : "eligible",
    };
  });
}

function generateShareCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function defaultExpirationDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  return expiresAt.toISOString();
}

export async function getMyActiveRepertoireShare() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("repertoire_shares")
    .select("*")
    .eq("owner_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  const now = Date.now();
  const activeShare = ((data ?? []) as RepertoireShare[]).find(
    (share) => !share.expires_at || Date.parse(share.expires_at) > now
  );
  return activeShare ?? null;
}

export async function createRepertoireShare() {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in.");

  const existingShare = await getMyActiveRepertoireShare();
  if (existingShare) return existingShare;

  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("repertoire_shares")
      .insert({
        owner_id: user.id,
        code: generateShareCode(),
        expires_at: defaultExpirationDate(),
      })
      .select()
      .single();

    if (!error) return data as RepertoireShare;
    lastError = error;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not create repertoire share link.");
}

export async function revokeRepertoireShare(shareId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in.");

  const { data, error } = await supabase
    .from("repertoire_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as RepertoireShare;
}

export async function getSharedRepertoire(code: string) {
  const { data, error } = await supabase.rpc("get_shared_repertoire", {
    p_code: code,
  });

  if (error) throw error;

  const rows = (data ?? []) as SharedRepertoireRpcRow[];
  const firstRow = rows[0];
  if (!firstRow) return null;

  return {
    shareId: firstRow.share_id,
    code: firstRow.code,
    ownerDisplayName: firstRow.owner_display_name,
    songs: rows
      .filter(
        (row): row is SharedRepertoireRpcRow & {
          song_id: string;
          song_title: string;
          voicing: Voicing;
        } => Boolean(row.song_id && row.song_title && row.voicing)
      )
      .map((row) => ({
        id: row.song_id,
        songTitle: row.song_title,
        voicing: row.voicing,
        arrangerName: row.arranger_name,
      })),
  } satisfies SharedRepertoire;
}

export async function copySharedSongsToMyRepertoire(
  songs: SharedRepertoireSong[],
  selectionsByVoicing: Record<Voicing, { part: Part; confidence: Confidence }>
) {
  const myRepertoire = await getMyRepertoire();
  const copyableSongs = resolveSharedSongCopyability(
    songs,
    myRepertoire
  ).filter((song) => song.duplicateStatus !== "exact");
  let copiedCount = 0;
  const skippedExactCount = songs.length - copyableSongs.length;

  for (const song of copyableSongs) {
    const selection = selectionsByVoicing[song.voicing];
    if (!selection) {
      throw new Error(`Choose a part and confidence for ${song.voicing}.`);
    }

    await addRepertoireItem({
      songTitle: song.songTitle,
      voicing: song.voicing,
      arrangerName: song.arrangerName ?? undefined,
      partConfidences: [
        {
          part: selection.part,
          confidence: selection.confidence,
        },
      ],
    });
    copiedCount += 1;
  }

  return {
    copiedCount,
    skippedExactCount,
  };
}
