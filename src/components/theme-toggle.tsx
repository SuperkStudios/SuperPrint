"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";

const themes: ThemePreference[] = ["system", "light", "dark"];

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && systemDark);
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    const saved = window.localStorage.getItem("superprint-theme") as ThemePreference | null;
    const next = saved && themes.includes(saved) ? saved : "system";
    setTheme(next);
    applyTheme(next);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((window.localStorage.getItem("superprint-theme") ?? "system") === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function cycleTheme() {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    window.localStorage.setItem("superprint-theme", next);
    setTheme(next);
    applyTheme(next);
  }

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const label = theme === "system" ? "System theme" : `${theme[0].toUpperCase()}${theme.slice(1)} theme`;

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="inline-flex size-10 items-center justify-center rounded-md border bg-card/70 text-foreground shadow-sm backdrop-blur transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${label}. Click to switch theme.`}
      title={`${label}. Click to switch theme.`}
    >
      <Icon className="size-4" />
    </button>
  );
}
