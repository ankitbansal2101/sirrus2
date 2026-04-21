"use client";

export default function CustomiseLeadFormError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg p-8 font-sans text-ink">
      <h1 className="text-lg font-semibold">Customise lead form</h1>
      <p className="mt-2 text-sm text-muted">Something went wrong while loading this screen.</p>
      <pre className="mt-4 overflow-auto rounded-lg border border-border-soft bg-surface p-3 text-xs text-red-700">
        {error.message}
      </pre>
      {error.digest ? <p className="mt-2 text-[11px] text-muted">Digest: {error.digest}</p> : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-xl border border-border-soft bg-white px-4 py-2 text-sm font-medium text-accent shadow-sm hover:bg-rail-active/30"
      >
        Try again
      </button>
    </div>
  );
}
