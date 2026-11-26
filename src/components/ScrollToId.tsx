"use client";

import { useEffect } from "react";

export default function ScrollToId({ id }: { id: string }) {
  useEffect(() => {
    if (!id) return;
    const nav = performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
    const isReload = nav?.type === "reload" || (performance as any).navigation?.type === 1;
    if (isReload) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [id]);

  return null;
}
