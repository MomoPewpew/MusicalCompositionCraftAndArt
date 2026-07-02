"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";

type ThemeChoice = "system" | "light" | "dark";

function nextChoice(current: ThemeChoice): ThemeChoice {
  if (current === "system") return "dark";
  if (current === "dark") return "light";
  return "system";
}

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const label = useMemo(() => {
    if (!mounted) return "Theme";
    const t = (theme ?? "system") as ThemeChoice;
    const resolved = resolvedTheme === "dark" ? "dark" : "light";
    return t === "system" ? `System (${resolved})` : t[0].toUpperCase() + t.slice(1);
  }, [mounted, resolvedTheme, theme]);

  const current = ((theme ?? "system") as ThemeChoice) ?? "system";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextChoice(current))}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        "border-zinc-300/60 bg-white/70 text-zinc-900 hover:bg-white",
        "dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100 dark:hover:bg-zinc-950/60",
        "backdrop-blur shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
      ].join(" ")}
      aria-label="Toggle theme"
      title="Toggle theme (System → Dark → Light)"
      suppressHydrationWarning
    >
      <span
        className={[
          "inline-block h-2 w-2 rounded-full",
          !mounted
            ? "bg-zinc-400"
            : resolvedTheme === "dark"
              ? "bg-teal-400/80"
              : "bg-rose-500/70"
        ].join(" ")}
      />
      {label}
    </button>
  );
}
