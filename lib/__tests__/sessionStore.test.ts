import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => {
  const queryQueue: Array<Record<string, unknown>> = [];
  const rpc = vi.fn();

  return {
    queryQueue,
    rpc,
    from: vi.fn((table: string) => {
      const query = queryQueue.shift();
      if (!query) throw new Error(`Unexpected table query: ${table}`);
      query.table = table;
      return query;
    }),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: supabaseMock.from,
    rpc: supabaseMock.rpc,
    channel: supabaseMock.channel,
    removeChannel: supabaseMock.removeChannel,
  },
}));

import {
  QuartetFullError,
  removeParticipant,
  removeParticipantById,
  SessionParticipantWriteError,
  upsertParticipant,
} from "../sessionStore";

function query(result: {
  data?: unknown;
  error?: unknown;
  maybeData?: unknown;
}) {
  const builder = {
    table: "",
    insert: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(async () => ({
      data: result.data ?? null,
      error: result.error ?? null,
    })),
    maybeSingle: vi.fn(async () => ({
      data: result.maybeData ?? result.data ?? null,
      error: result.error ?? null,
    })),
  };

  return builder;
}

describe("sessionStore writes", () => {
  beforeEach(() => {
    supabaseMock.queryQueue.length = 0;
    supabaseMock.from.mockClear();
    supabaseMock.rpc.mockReset();
  });

  it("upserts the current user's participant snapshot and updates session activity", async () => {
    const savedParticipant = {
      id: "participant-1",
      session_id: "session-1",
      user_id: "user-1",
      display_name: "Tim",
      repertoire: [],
      joined_at: "2026-04-28T00:00:00.000Z",
    };
    supabaseMock.rpc.mockResolvedValueOnce({
      data: savedParticipant,
      error: null,
    });

    await expect(
      upsertParticipant(
        "session-1",
        "user-1",
        "Tim",
        [],
        "2026-04-28T19:00:00.000Z"
      )
    ).resolves.toEqual(savedParticipant);

    expect(supabaseMock.rpc).toHaveBeenCalledWith("join_session_participant", {
      p_session_id: "session-1",
      p_display_name: "Tim",
      p_repertoire: [],
      p_last_activity_at: "2026-04-28T19:00:00.000Z",
      p_max_participants: 4,
    });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("rejects unverified participant upserts", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        id: "participant-1",
        session_id: "session-2",
        user_id: "user-1",
      },
      error: null,
    });

    await expect(
      upsertParticipant("session-1", "user-1", "Tim", [])
    ).rejects.toBeInstanceOf(SessionParticipantWriteError);

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("maps full quartet RPC failures to a typed error", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "This quartet is already full.",
      },
    });

    await expect(
      upsertParticipant("session-1", "user-1", "Tim", [])
    ).rejects.toBeInstanceOf(QuartetFullError);

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("accepts array-shaped participant RPC responses", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [
        {
          id: "participant-1",
          session_id: "session-1",
          user_id: "user-1",
        },
      ],
      error: null,
    });

    await expect(
      upsertParticipant("session-1", "user-1", "Tim", [])
    ).resolves.toMatchObject({
      id: "participant-1",
      session_id: "session-1",
      user_id: "user-1",
    });
  });

  it("deletes the current user's participant row and verifies it is gone", async () => {
    const lookupQuery = query({
      maybeData: {
        id: "participant-1",
        session_id: "session-1",
        user_id: "user-1",
      },
    });
    const deleteQuery = query({});
    const verifyQuery = query({ maybeData: null });
    supabaseMock.queryQueue.push(lookupQuery, deleteQuery, verifyQuery);

    await expect(removeParticipant("session-1", "user-1")).resolves.toEqual({
      id: "participant-1",
      session_id: "session-1",
      user_id: "user-1",
    });

    expect(deleteQuery.table).toBe("session_participants");
    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(deleteQuery.eq).toHaveBeenCalledWith("session_id", "session-1");
    expect(deleteQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(verifyQuery.maybeSingle).toHaveBeenCalled();
  });

  it("fails leave when the current user's participant row cannot be found", async () => {
    supabaseMock.queryQueue.push(query({ maybeData: null }));

    await expect(
      removeParticipant("session-1", "user-1")
    ).rejects.toBeInstanceOf(SessionParticipantWriteError);

    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });

  it("removes another participant through the database function and verifies deletion", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        id: "participant-2",
        session_id: "session-1",
        user_id: "user-2",
      },
      error: null,
    });
    const verifyQuery = query({ maybeData: null });
    supabaseMock.queryQueue.push(verifyQuery);

    await expect(
      removeParticipantById("session-1", "participant-2")
    ).resolves.toEqual({
      id: "participant-2",
      session_id: "session-1",
      user_id: "user-2",
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "remove_session_participant_by_id",
      {
        p_session_id: "session-1",
        p_participant_id: "participant-2",
      }
    );
    expect(verifyQuery.eq).toHaveBeenCalledWith("id", "participant-2");
  });
});
