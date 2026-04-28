import { beforeEach, describe, expect, it, vi } from "vitest";

const activeQuartetMock = vi.hoisted(() => ({
  getActiveQuartet: vi.fn(),
  clearActiveQuartetIfMatches: vi.fn(),
  setActiveQuartet: vi.fn(),
}));

const profileMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getMyProfile: vi.fn(),
}));

const repertoireMock = vi.hoisted(() => ({
  getMyRepertoire: vi.fn(),
}));

const sessionMock = vi.hoisted(() => ({
  getParticipants: vi.fn(),
  upsertParticipant: vi.fn(),
}));

vi.mock("@/lib/activeQuartet", () => activeQuartetMock);
vi.mock("@/lib/profileStore", () => profileMock);
vi.mock("@/lib/repertoireStore", () => repertoireMock);
vi.mock("@/lib/sessionStore", () => sessionMock);
vi.mock("@/lib/participantEntries", () => ({
  buildParticipantEntries: (
    displayName: string,
    repertoire: Array<{
      id: string;
      user_id: string;
      song_title: string;
      voicing: string;
      arranger_name: string | null;
      parts_known: string[];
      confidence: string;
      part_confidences: Array<{ part: string; confidence: string }>;
    }>
  ) =>
    repertoire.map((item) => ({
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
    })),
}));
vi.mock("@/lib/sessionParticipantResolution", () => ({
  findParticipantByUserId: (
    participants: Array<{ user_id: string }>,
    userId: string
  ) => participants.find((participant) => participant.user_id === userId),
}));

import {
  ActiveQuartetSnapshotError,
  refreshActiveQuartetSnapshot,
} from "../activeQuartetSnapshot";

const activeQuartet = {
  sessionId: "session-1",
  code: "ABC123",
  joinedAt: "2026-04-28T18:00:00.000Z",
};

const currentParticipant = {
  id: "participant-1",
  session_id: "session-1",
  user_id: "user-1",
  display_name: "Old Name",
  repertoire: [],
  joined_at: "2026-04-28T18:00:00.000Z",
};

const repertoireRow = {
  id: "rep-1",
  user_id: "user-1",
  song_title: "Bright Was the Night",
  voicing: "TTBB",
  arranger_name: null,
  parts_known: ["Lead", "Bass"],
  part_confidences: [
    { part: "Lead", confidence: "Good to Go" },
    { part: "Bass", confidence: "Music Required" },
  ],
  confidence: "Good to Go",
  notes: "private note",
  last_sung_at: null,
  times_sung_count: 0,
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
};

describe("refreshActiveQuartetSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when there is no active quartet", async () => {
    activeQuartetMock.getActiveQuartet.mockReturnValue(null);

    await expect(refreshActiveQuartetSnapshot()).resolves.toEqual({
      status: "no_active_quartet",
    });

    expect(sessionMock.upsertParticipant).not.toHaveBeenCalled();
  });

  it("clears stale local state when the user is no longer a participant", async () => {
    activeQuartetMock.getActiveQuartet.mockReturnValue(activeQuartet);
    profileMock.getCurrentUser.mockResolvedValue({ id: "user-1" });
    sessionMock.getParticipants.mockResolvedValue([]);

    await expect(refreshActiveQuartetSnapshot()).resolves.toEqual({
      status: "not_participant",
    });

    expect(activeQuartetMock.clearActiveQuartetIfMatches).toHaveBeenCalledWith(
      "session-1"
    );
    expect(sessionMock.upsertParticipant).not.toHaveBeenCalled();
  });

  it("updates the database-backed participant snapshot from current repertoire", async () => {
    activeQuartetMock.getActiveQuartet.mockReturnValue(activeQuartet);
    profileMock.getCurrentUser.mockResolvedValue({ id: "user-1" });
    sessionMock.getParticipants.mockResolvedValue([currentParticipant]);
    profileMock.getMyProfile.mockResolvedValue({ display_name: "New Name" });
    repertoireMock.getMyRepertoire.mockResolvedValue([repertoireRow]);
    sessionMock.upsertParticipant.mockResolvedValue({
      ...currentParticipant,
      display_name: "New Name",
    });

    const result = await refreshActiveQuartetSnapshot();

    expect(result.status).toBe("updated");
    expect(sessionMock.upsertParticipant).toHaveBeenCalledWith(
      "session-1",
      "user-1",
      "New Name",
      [
        {
          repertoireId: "rep-1",
          userId: "user-1",
          displayName: "New Name",
          songTitle: "Bright Was the Night",
          voicing: "TTBB",
          arrangerName: null,
          partsKnown: ["Lead", "Bass"],
          confidence: "Good to Go",
          partConfidences: {
            Lead: "Good to Go",
            Bass: "Music Required",
          },
        },
      ],
      expect.any(String)
    );
    expect(activeQuartetMock.setActiveQuartet).toHaveBeenCalledWith({
      ...activeQuartet,
      joinedAt: expect.any(String),
    });
  });

  it("throws when the profile display name is missing", async () => {
    activeQuartetMock.getActiveQuartet.mockReturnValue(activeQuartet);
    profileMock.getCurrentUser.mockResolvedValue({ id: "user-1" });
    sessionMock.getParticipants.mockResolvedValue([currentParticipant]);
    profileMock.getMyProfile.mockResolvedValue({ display_name: "" });

    await expect(refreshActiveQuartetSnapshot()).rejects.toBeInstanceOf(
      ActiveQuartetSnapshotError
    );
    expect(sessionMock.upsertParticipant).not.toHaveBeenCalled();
  });
});
