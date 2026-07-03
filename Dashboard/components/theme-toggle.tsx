"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("theme", next ? "light" : "dark");
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={light ? "Switch to dark" : "Switch to light"}
      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
      style={{ border: "1px solid var(--hairline)", color: "var(--ink-2)", background: "var(--surface)" }}
    >
      {light ? <Moon size={14} strokeWidth={1.9} /> : <Sun size={15} strokeWidth={1.9} />}
    </button>
  );
}
