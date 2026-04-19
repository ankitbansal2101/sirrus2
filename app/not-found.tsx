import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
        <p className="max-w-md text-sm text-muted">That URL does not exist in this app build.</p>
        <Link
          href="/"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
        >
          Back to settings
        </Link>
      </main>
    </AppShell>
  );
}
