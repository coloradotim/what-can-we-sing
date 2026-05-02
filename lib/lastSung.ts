const dayMs = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatLastSungStatus(
  value: string | null | undefined,
  now = new Date()
) {
  if (!value) return "Not marked yet";

  const sungAt = new Date(value);
  if (Number.isNaN(sungAt.getTime())) return "Not marked yet";

  const today = startOfLocalDay(now);
  const sungDay = startOfLocalDay(sungAt);
  const dayDiff = Math.round((today.getTime() - sungDay.getTime()) / dayMs);

  if (dayDiff === 0) return "Today";
  if (dayDiff > 0 && dayDiff < 14) {
    return `${dayDiff} ${dayDiff === 1 ? "day" : "days"} ago`;
  }

  return sungAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
