import type { MatchResult } from "@/lib/matching";

type MatchCardProps = {
  match: MatchResult;
};

const categoryLabels: Record<MatchResult["category"], string> = {
  ready: "Ready to sing",
  possible: "Confirm arrangement",
  one_part_missing: "One part missing",
};

export function MatchCard({ match }: MatchCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-lg sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-xl font-bold sm:text-2xl">
            {match.songTitle} — {match.voicing}
          </h3>

          <p className="mt-1 text-sm text-slate-300">
            {match.category === "ready" && "Ready to sing"}
            {match.category === "possible" &&
              "Possible match — confirm arrangement"}
            {match.category === "one_part_missing" &&
              `One part missing: ${match.missingParts.join(", ")}`}
          </p>
        </div>

        <span className="w-fit rounded-full bg-cyan-300 px-3 py-1 text-sm font-semibold text-slate-950">
          {categoryLabels[match.category]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Object.entries(match.assignments).map(([part, singers]) => (
          <div key={part} className="rounded-xl bg-slate-900/70 p-3">
            <p className="font-semibold">{part}</p>
            <p className="text-sm text-slate-300">
              {singers.map((singer) => singer.displayName).join(", ")}
            </p>
          </div>
        ))}

        {match.missingParts.map((part) => (
          <div
            key={part}
            className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-3"
          >
            <p className="font-semibold text-rose-200">{part}</p>
            <p className="text-sm text-rose-200">Missing</p>
          </div>
        ))}
      </div>

      {match.warnings.length > 0 && (
        <div className="mt-4 rounded-xl bg-amber-300/10 p-3 text-sm text-amber-200">
          {match.warnings.map((warning) => (
            <p key={warning}>⚠ {warning}</p>
          ))}
        </div>
      )}
    </article>
  );
}
