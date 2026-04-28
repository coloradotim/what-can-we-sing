import type { SingerEntry } from "@/lib/matching";
import type { RepertoireRow } from "@/lib/repertoireStore";

export function buildParticipantEntries(
  displayName: string,
  repertoire: RepertoireRow[]
): SingerEntry[] {
  return repertoire.map((item) => ({
    repertoireId: item.id,
    userId: item.user_id,
    displayName,
    songTitle: item.song_title,
    voicing: item.voicing,
    arrangerName: item.arranger_name,
    partsKnown: item.parts_known,
    confidence: item.confidence,
    partConfidences: Object.fromEntries(
      item.part_confidences.map(({ part, confidence }) => [part, confidence])
    ),
  }));
}
