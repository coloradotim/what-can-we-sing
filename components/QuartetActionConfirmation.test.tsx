import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuartetActionConfirmation } from "./QuartetActionConfirmation";

const baseProps = {
  busy: false,
  title: "Leave quartet?",
  description:
    "You'll be removed from this quartet. You can rejoin later with the code if there is still room.",
  confirmLabel: "Leave quartet",
  busyLabel: "Leaving...",
  onCancel: () => undefined,
  onConfirm: () => undefined,
};

describe("QuartetActionConfirmation", () => {
  it("does not render when closed", () => {
    expect(
      renderToStaticMarkup(
        <QuartetActionConfirmation {...baseProps} open={false} />
      )
    ).toBe("");
  });

  it("renders a mobile-safe in-app confirmation dialog", () => {
    const html = renderToStaticMarkup(
      <QuartetActionConfirmation {...baseProps} open />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Leave quartet?");
    expect(html).toContain("Cancel");
    expect(html).toContain("Leave quartet");
  });

  it("shows busy copy while the action is running", () => {
    const html = renderToStaticMarkup(
      <QuartetActionConfirmation {...baseProps} open busy />
    );

    expect(html).toContain("Leaving...");
  });

  it("supports destructive repertoire delete confirmation copy", () => {
    const html = renderToStaticMarkup(
      <QuartetActionConfirmation
        open
        busy={false}
        title="Delete song?"
        description='This will remove "Mamselle" from your repertoire. This cannot be undone.'
        confirmLabel="Delete song"
        busyLabel="Deleting..."
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    );

    expect(html).toContain("Delete song?");
    expect(html).toContain("Mamselle");
    expect(html).toContain("This cannot be undone.");
    expect(html).toContain("Delete song");
  });
});
