import {
  requiredPartsForVoicing,
  type MatchTitleVariant,
  type MatchTitleVariantSinger,
  type MatchResult,
} from "@/lib/matching";
import {
  functionalPartName,
  partAbbreviation,
  voicingDisplayLabel,
} from "@/lib/partAbbreviations";
import {
  arrangerDisplayName,
  noArrangerEnteredLabel,
} from "@/lib/arrangerDisplay";

type MatchCardProps = {
  match: MatchResult;
  personalNotes?: string[];
  isExpanded: boolean;
  isRecentlySung?: boolean;
  isMarkingSung?: boolean;
  isSungCelebrating?: boolean;
  onToggle: () => void;
  onMarkAsSung?: () => void;
};

function uniqueArrangerLabels(singers: MatchTitleVariantSinger[]) {
  return Array.from(
    new Set(singers.map((singer) => arrangerDisplayName(singer.arrangerName)))
  );
}

function variantKey(variant: MatchTitleVariant) {
  return `${variant.title}-${variant.singers
    .map(
      (singer) =>
        `${singer.displayName}-${singer.part}-${singer.arrangerName ?? ""}`
    )
    .join("|")}`;
}

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
  isExpanded,
  isRecentlySung = false,
  isMarkingSung = false,
  isSungCelebrating = false,
  onToggle,
  onMarkAsSung,
}: MatchCardProps) {
  const styles = categoryStyles[match.category];
  const parts = requiredPartsForVoicing(match.voicing);
  const hasDetails =
    Boolean(match.titleVariants?.length) ||
    match.warnings.length > 0 ||
    match.arrangerNames.length > 0 ||
    match.hasMissingArrangerInfo ||
    Boolean(match.arrangerVariantNote) ||
    personalNotes.length > 0 ||
    isRecentlySung;
  const hasTitleVariantDetails = Boolean(match.titleVariants?.length);
  const shouldShowEntryArrangers =
    match.arrangerNames.length > 1 || match.hasMissingArrangerInfo;

  return (
    <details
      open={isExpanded}
      className={`group relative overflow-hidden rounded-xl border px-3 py-2 shadow-lg open:pb-3 ${
        isSungCelebrating
          ? "ring-2 ring-cyan-200/70 ring-offset-2 ring-offset-slate-950 motion-safe:animate-pulse"
          : ""
      } ${styles.row}`}
    >
      <summary
        aria-expanded={isExpanded}
        onClick={(event) => {
          event.preventDefault();
          onToggle();
        }}
        className="cursor-pointer list-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">
              {match.songTitle}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                {voicingDisplayLabel(match.voicing)}
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
                <span>
                  {isMissing
                    ? `Missing ${functionalPartName(match.voicing, part)}`
                    : abbreviation}
                </span>
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
                  : singers
                      .map((singer) => {
                        if (!shouldShowEntryArrangers) {
                          return singer.displayName;
                        }

                        return `${singer.displayName} (Arranger: ${arrangerDisplayName(
                          singer.arrangerName
                        )})`;
                      })
                      .join(", ")}
              </p>
            );
          })}
        </div>

        {!hasTitleVariantDetails &&
          (match.arrangerNames.length > 0 || match.hasMissingArrangerInfo) && (
            <p className="mt-3">
              <span className="font-semibold text-white">Arranger:</span>{" "}
              {[
                ...match.arrangerNames,
                match.hasMissingArrangerInfo ? noArrangerEnteredLabel : null,
              ]
                .filter((name): name is string => Boolean(name))
                .join(", ")}
            </p>
          )}

        {match.arrangerVariantNote && (
          <p className="mt-2 text-sm text-slate-300">
            {match.arrangerVariantNote}
          </p>
        )}

        {match.titleMatchType === "fuzzy" && match.titleVariants?.length ? (
          <div className="mt-3 rounded-lg bg-amber-300/10 p-3 text-sm text-amber-50">
            <p className="font-semibold text-amber-100">
              Potential title match
            </p>
            <p className="mt-1 text-xs text-amber-50/80">
              These saved song entries may refer to the same song.
            </p>
            <p className="mt-2 text-xs text-amber-50/70">
              Comparison key:{" "}
              {match.titleVariants
                .map((variant) => variant.normalizedTitle)
                .join(" / ")}
            </p>
            <div className="mt-3 space-y-3">
              {match.titleVariants.map((variant) => {
                const arrangerLabels = uniqueArrangerLabels(variant.singers);
                const showVariantArranger = arrangerLabels.length === 1;

                return (
                  <div key={variantKey(variant)}>
                    <p className="font-semibold text-white">
                      "{variant.title}"
                    </p>
                    {showVariantArranger && (
                      <p className="mt-0.5 text-xs text-amber-50/80">
                        Arranger: {arrangerLabels[0]}
                      </p>
                    )}
                    <ul className="mt-1 space-y-1">
                      {variant.singers.map((singer) => (
                        <li
                          key={`${variant.title}-${singer.displayName}-${singer.part}-${singer.arrangerName ?? ""}`}
                          className="text-xs text-amber-50/90"
                        >
                          {singer.displayName} -{" "}
                          {partAbbreviation(match.voicing, singer.part)}
                          {singer.confidence ? ` - ${singer.confidence}` : ""}
                          {!showVariantArranger
                            ? ` - Arranger: ${arrangerDisplayName(
                                singer.arrangerName
                              )}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-amber-50/80">
              If these are the same song, consider updating song titles in My
              Songs so future matches are clearer.
            </p>
          </div>
        ) : null}

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
          <div className="relative mt-3 inline-flex">
            <button
              type="button"
              onClick={onMarkAsSung}
              disabled={isMarkingSung || isSungCelebrating}
              className={`rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/20 disabled:opacity-70 ${
                isSungCelebrating
                  ? "bg-cyan-300 text-slate-950"
                  : "bg-white/10 text-slate-200"
              }`}
            >
              {isMarkingSung
                ? "Marking..."
                : isSungCelebrating
                  ? "✓ Sung!"
                  : "Mark as sung"}
            </button>
            {isSungCelebrating && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-7 -top-5 flex gap-1 text-sm text-cyan-100 motion-safe:animate-bounce motion-reduce:hidden"
              >
                <span>♪</span>
                <span className="mt-2 text-cyan-200">♫</span>
                <span>♪</span>
              </div>
            )}
          </div>
        )}

        {!hasDetails && (
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            No extra details
          </p>
        )}
      </div>
    </details>
  );
}
