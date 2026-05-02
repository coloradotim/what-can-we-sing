import { describe, expect, it } from "vitest";
import type { RepertoireRow } from "../repertoireStore";
import {
  filterAndSortRepertoire,
  hasActiveRepertoireFilters,
  type RepertoireFilters,
} from "../repertoireView";

function row(patch: Partial<RepertoireRow> & Pick<RepertoireRow, "id" | "song_title">): RepertoireRow {
  return {
    id: patch.id,
    user_id: "user-1",
    song_title: patch.song_title,
    voicing: patch.voicing ?? "TTBB",
    arranger_name: patch.arranger_name ?? null,
    parts_known: patch.parts_known ?? ["Lead"],
    part_confidences:
      patch.part_confidences ?? [{ part: "Lead", confidence: "Good to Go" }],
    confidence: patch.confidence ?? "Good to Go",
    notes: patch.notes ?? null,
    last_sung_at: patch.last_sung_at ?? null,
    times_sung_count: patch.times_sung_count ?? 0,
    created_at: patch.created_at ?? "2026-04-01T00:00:00.000Z",
    updated_at: patch.updated_at ?? "2026-04-01T00:00:00.000Z",
  };
}

const defaultFilters: RepertoireFilters = {
  searchQuery: "",
  voicing: "",
  part: "",
  sungStatus: "all",
  sort: "title_asc",
};

describe("filterAndSortRepertoire", () => {
  it("sorts alphabetically by title", () => {
    const result = filterAndSortRepertoire(
      [row({ id: "2", song_title: "Zulu" }), row({ id: "1", song_title: "Alpha" })],
      defaultFilters
    );

    expect(result.map((item) => item.song_title)).toEqual(["Alpha", "Zulu"]);
  });

  it("sorts by date added newest and oldest", () => {
    const items = [
      row({ id: "old", song_title: "Old", created_at: "2026-01-01T00:00:00.000Z" }),
      row({ id: "new", song_title: "New", created_at: "2026-04-01T00:00:00.000Z" }),
    ];

    expect(
      filterAndSortRepertoire(items, {
        ...defaultFilters,
        sort: "created_desc",
      }).map((item) => item.id)
    ).toEqual(["new", "old"]);
    expect(
      filterAndSortRepertoire(items, {
        ...defaultFilters,
        sort: "created_asc",
      }).map((item) => item.id)
    ).toEqual(["old", "new"]);
  });

  it("sorts by last sung with not-marked placement", () => {
    const items = [
      row({ id: "never", song_title: "Never", last_sung_at: null }),
      row({ id: "old", song_title: "Old", last_sung_at: "2026-01-01T00:00:00.000Z" }),
      row({ id: "recent", song_title: "Recent", last_sung_at: "2026-04-01T00:00:00.000Z" }),
    ];

    expect(
      filterAndSortRepertoire(items, {
        ...defaultFilters,
        sort: "last_sung_desc",
      }).map((item) => item.id)
    ).toEqual(["recent", "old", "never"]);
    expect(
      filterAndSortRepertoire(items, {
        ...defaultFilters,
        sort: "last_sung_asc",
      }).map((item) => item.id)
    ).toEqual(["never", "old", "recent"]);
  });

  it("filters by search, voicing, part, and not-marked sung status", () => {
    const result = filterAndSortRepertoire(
      [
        row({
          id: "match",
          song_title: "Bright Was The Night",
          voicing: "TTBB",
          parts_known: ["Lead", "Baritone"],
          part_confidences: [
            { part: "Lead", confidence: "Good to Go" },
            { part: "Baritone", confidence: "A Little Rusty" },
          ],
          last_sung_at: null,
        }),
        row({
          id: "wrong-part",
          song_title: "Bright Morning",
          voicing: "TTBB",
          parts_known: ["Bass"],
          part_confidences: [{ part: "Bass", confidence: "Good to Go" }],
          last_sung_at: null,
        }),
        row({
          id: "wrong-voicing",
          song_title: "Bright Was The Night",
          voicing: "SATB",
          parts_known: ["Alto"],
          part_confidences: [{ part: "Alto", confidence: "Good to Go" }],
          last_sung_at: null,
        }),
        row({
          id: "already-sung",
          song_title: "Bright Was The Night",
          voicing: "TTBB",
          parts_known: ["Baritone"],
          part_confidences: [{ part: "Baritone", confidence: "Good to Go" }],
          last_sung_at: "2026-04-01T00:00:00.000Z",
        }),
      ],
      {
        searchQuery: "bright",
        voicing: "TTBB",
        part: "Baritone",
        sungStatus: "not_marked",
        sort: "title_asc",
      }
    );

    expect(result.map((item) => item.id)).toEqual(["match"]);
  });

  it("filters by marked sung status", () => {
    const result = filterAndSortRepertoire(
      [
        row({ id: "not-marked", song_title: "Mamselle", last_sung_at: null }),
        row({
          id: "marked",
          song_title: "Bright Was The Night",
          last_sung_at: "2026-04-01T00:00:00.000Z",
        }),
      ],
      { ...defaultFilters, sungStatus: "marked" }
    );

    expect(result.map((item) => item.id)).toEqual(["marked"]);
  });

  it("filters by not-marked sung status", () => {
    const result = filterAndSortRepertoire(
      [
        row({ id: "not-marked", song_title: "Mamselle", last_sung_at: null }),
        row({
          id: "marked",
          song_title: "Bright Was The Night",
          last_sung_at: "2026-04-01T00:00:00.000Z",
        }),
      ],
      { ...defaultFilters, sungStatus: "not_marked" }
    );

    expect(result.map((item) => item.id)).toEqual(["not-marked"]);
  });

  it("filters parts by functional barbershop role across arrangements", () => {
    const result = filterAndSortRepertoire(
      [
        row({
          id: "lower-lead",
          song_title: "Lower Lead",
          voicing: "TTBB",
          parts_known: ["Lead"],
          part_confidences: [{ part: "Lead", confidence: "Good to Go" }],
        }),
        row({
          id: "mixed-lead",
          song_title: "Mixed Lead",
          voicing: "SATB",
          parts_known: ["Alto"],
          part_confidences: [{ part: "Alto", confidence: "Good to Go" }],
        }),
        row({
          id: "treble-lead",
          song_title: "Treble Lead",
          voicing: "SSAA",
          parts_known: ["Soprano 2"],
          part_confidences: [{ part: "Soprano 2", confidence: "Good to Go" }],
        }),
        row({
          id: "mixed-bari",
          song_title: "Mixed Bari",
          voicing: "SATB",
          parts_known: ["Tenor"],
          part_confidences: [{ part: "Tenor", confidence: "Good to Go" }],
        }),
      ],
      { ...defaultFilters, part: "Lead" }
    );

    expect(result.map((item) => item.id)).toEqual([
      "lower-lead",
      "mixed-lead",
      "treble-lead",
    ]);
  });
});

describe("hasActiveRepertoireFilters", () => {
  it("ignores sorting and detects only active filters", () => {
    expect(
      hasActiveRepertoireFilters({ ...defaultFilters, sort: "created_desc" })
    ).toBe(false);
    expect(
      hasActiveRepertoireFilters({ ...defaultFilters, searchQuery: "hello" })
    ).toBe(true);
  });
});
