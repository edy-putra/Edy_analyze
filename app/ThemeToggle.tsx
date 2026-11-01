"use client";

import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);
  useEffect(() => {
    const r = document.documentElement;
    if (theme === "auto") r.removeAttribute("data-theme");
    else r.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  const items: [Theme, string][] = [["auto", "◐"], ["light", "☀"], ["dark", "☾"]];
  return (
    <div className="neo-sm flex gap-1 p-1" role="group" aria-label="Tema">
      {items.map(([t, icon]) => (
        <button key={t} onClick={() => setTheme(t)} aria-label={`Tema ${t}`} aria-pressed={theme === t}
          className={`h-9 w-9 rounded-full text-base ${theme === t ? "on" : ""}`}>{icon}</button>
      ))}
    </div>
  );
}
