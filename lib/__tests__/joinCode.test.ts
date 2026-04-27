import { describe, expect, it } from "vitest";
import { parseJoinCode } from "../joinCode";

describe("parseJoinCode", () => {
  it("accepts a raw quartet code", () => {
    expect(parseJoinCode(" 93567t ")).toBe("93567T");
  });

  it("extracts the code from a join URL", () => {
    expect(parseJoinCode("https://what-can-we-sing.vercel.app/join/93567T")).toBe(
      "93567T"
    );
  });

  it("extracts the code from a local join URL", () => {
    expect(parseJoinCode("http://localhost:3000/join/abc123")).toBe("ABC123");
  });

  it("rejects URLs that are not join links", () => {
    expect(parseJoinCode("https://what-can-we-sing.vercel.app/repertoire")).toBeNull();
  });

  it("rejects unsafe or malformed values", () => {
    expect(parseJoinCode("")).toBeNull();
    expect(parseJoinCode("https://example.com/join/has spaces")).toBeNull();
    expect(parseJoinCode("DROP TABLE")).toBeNull();
  });
});
