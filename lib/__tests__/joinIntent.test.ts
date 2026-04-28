import { describe, expect, it } from "vitest";
import { intentionalJoinStorageKey } from "../joinIntent";

describe("intentionalJoinStorageKey", () => {
  it("scopes intentional join state by quartet code", () => {
    expect(intentionalJoinStorageKey("ABC123")).toBe("intentional-join:ABC123");
  });
});
