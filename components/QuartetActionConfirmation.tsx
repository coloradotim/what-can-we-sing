type QuartetActionConfirmationProps = {
  open: boolean;
  busy: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function QuartetActionConfirmation({
  open,
  busy,
  title,
  description,
  confirmLabel,
  busyLabel,
  onCancel,
  onConfirm,
}: QuartetActionConfirmationProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 px-4 py-4 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quartet-action-title"
        aria-describedby="quartet-action-description"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 text-white shadow-2xl"
      >
        <h2 id="quartet-action-title" className="text-2xl font-semibold">
          {title}
        </h2>
        <p
          id="quartet-action-description"
          className="mt-2 text-sm text-slate-300"
        >
          {description}
        </p>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-white/10 px-5 py-3 font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-rose-200 px-5 py-3 font-semibold text-slate-950 hover:bg-rose-100 disabled:opacity-40"
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
