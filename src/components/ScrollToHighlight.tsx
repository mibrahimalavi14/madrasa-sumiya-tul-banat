"use client";

import { useEffect } from "react";

export default function ScrollToHighlight() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-highlight='true']");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("highlight-blink");
    const t = setTimeout(() => el.classList.remove("highlight-blink"), 2400);
    return () => clearTimeout(t);
  }, []);

  return null;
}
