import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repertoireManager = readFileSync(
  join(process.cwd(), "components/RepertoireManager.tsx"),
  "utf8"
);

describe("repertoire sharing UI language", () => {
  it("offers separate copy-requester and copy-provider actions", () => {
    expect(repertoireManager).toContain("More ways to build your repertoire");
    expect(repertoireManager).toContain("aria-expanded={isMoreWaysOpen}");
    expect(repertoireManager).toContain("Show options");
    expect(repertoireManager).toContain("Hide options");
    expect(repertoireManager).toContain("Copy songs from another singer");
    expect(repertoireManager).toContain(
      "Let another singer copy songs from my repertoire"
    );
    expect(repertoireManager).toContain("Open shared repertoire");
    expect(repertoireManager).toContain("Copy request message");
    expect(repertoireManager).toContain("Create link/code");
    expect(repertoireManager).toContain("Copy code");
  });

  it("keeps detailed sharing instructions inside opened flows", () => {
    expect(repertoireManager).toContain('secondaryRepertoireTool === "copy-from-singer"');
    expect(repertoireManager).toContain('secondaryRepertoireTool === "let-singer-copy"');
    expect(repertoireManager).toContain("shared-repertoire-code-modal");
    expect(repertoireManager).toContain(
      'onClick={() => openSecondaryRepertoireTool("copy-from-singer")}'
    );
    expect(repertoireManager).toContain(
      'onClick={() => openSecondaryRepertoireTool("let-singer-copy")}'
    );
  });

  it("does not use share-my-repertoire language as the primary action", () => {
    expect(repertoireManager).not.toContain("Share repertoire");
    expect(repertoireManager).not.toContain("Create share link");
    expect(repertoireManager).not.toContain("Your repertoire share link");
  });
});
