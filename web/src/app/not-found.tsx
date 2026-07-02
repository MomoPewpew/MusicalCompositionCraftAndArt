import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Page not found</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        That example or chapter does not exist.
      </p>
      <Link
        href="/"
        className="inline-flex text-sm font-medium text-zinc-900 underline decoration-black/20 underline-offset-4 hover:decoration-black/40 dark:text-zinc-100 dark:decoration-white/20 dark:hover:decoration-white/40"
      >
        Back to home
      </Link>
    </div>
  );
}
