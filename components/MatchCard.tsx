import {
  requiredPartsForVoicing,
  type MatchResult,
} from "@/lib/matching";
import { partAbbreviation } from "@/lib/partAbbreviations";

type MatchCardProps = {
  match: MatchResult;
  personalNotes?: string[];
  isRecentlySung?: boolean;
  isMarkingSung?: boolean;
  onMarkAsSung?: () => void;
};

const categoryStyles: Record<
  MatchResult["category"],
  {
    row: string;
    part: string;
  }
> = {
  ready: {
    row: "border-emerald-300/25 bg-emerald-300/10",
    part: "bg-emerald-300/15 text-emerald-100 ring-emerald-300/20",
  },
  possible: {
    row: "border-amber-300/25 bg-amber-300/10",
    part: "bg-amber-300/15 text-amber-100 ring-amber-300/20",
  },
  one_part_missing: {
    row: "border-rose-300/25 bg-rose-400/10",
    part: "bg-slate-900/80 text-slate-100 ring-white/10",
  },
};

export function MatchCard({
  match,
  personalNotes = [],
  isRecentlySung = false,
  isMarkingSung = false,
  onMarkAsSung,
}: MatchCardProps) {
  const styles = categoryStyles[match.category];
  const parts = requiredPartsForVoicing(match.voicing);
  const hasDetails =
    match.warnings.length > 0 ||
    match.arrangerNames.length > 0 ||
    personalNotes.length > 0 ||
    isRecentlySung;

  return (
    <details
      className={`group rounded-xl border px-3 py-2 shadow-lg open:pb-3 ${styles.row}`}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">
              {match.songTitle}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                {match.voicing}
              </p>
              {isRecentlySung && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-200">
                  Sung recently
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-slate-950/80 px-2 py-1 text-xs font-semibold text-slate-300 group-open:hidden">
            Details
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {parts.map((part) => {
            const singers = match.assignments[part] ?? [];
            const abbreviation = partAbbreviation(match.voicing, part);
            const isMissing = match.missingParts.includes(part);

            return (
              <span
                key={part}
                className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                  isMissing
                    ? "bg-rose-400/15 text-rose-100 ring-rose-300/30"
                    : styles.part
                }`}
              >
                <span>{isMissing ? `Missing ${abbreviation}` : abbreviation}</span>
                {singers.length > 0 && (
                  <span className="truncate font-medium text-slate-200">
                    {singers.map((singer) => singer.displayName).join(", ")}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </summary>

      <div className="mt-3 border-t border-white/10 pt-3 text-sm text-slate-300">
        <div className="grid gap-2 sm:grid-cols-2">
          {parts.map((part) => {
            const singers = match.assignments[part] ?? [];
            const abbreviation = partAbbreviation(match.voicing, part);
            const isMissing = match.missingParts.includes(part);

            return (
              <p key={part} className={isMissing ? "text-rose-200" : undefined}>
                <span className="font-semibold text-white">{abbreviation}:</span>{" "}
                {isMissing
                  ? "Missing"
                  : singers.map((singer) => singer.displayName).join(", ")}
              </p>
            );
          })}
        </div>

        {match.arrangerNames.length > 0 && (
          <p className="mt-3">
            <span className="font-semibold text-white">Arranger:</span>{" "}
            {match.arrangerNames.join(", ")}
          </p>
        )}

        {match.warnings.length > 0 && (
          <div
            className="mt-3 rounded-lg bg-amber-300/10 p-2 text-sm text-amber-100"
          >
            {match.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        {personalNotes.length > 0 && (
          <div className="mt-3 rounded-lg bg-white/5 p-2 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">My notes</p>
            {personalNotes.map((note, index) => (
              <p key={`${note}-${index}`} className="mt-1 whitespace-pre-wrap">
                {note}
              </p>
            ))}
          </div>
        )}

        {onMarkAsSung && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onMarkAsSung}
              disabled={isMarkingSung}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/20 disabled:opacity-40"
            >
              {isMarkingSung ? "Marking..." : "Mark as sung"}
            </button>
          </div>
        )}

        {!hasDetails && (
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            No arrangement warnings
          </p>
        )}
      </div>
    </details>
  );
}
